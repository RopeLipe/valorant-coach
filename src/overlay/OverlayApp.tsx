import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InGameOverlay } from '@code/components/in-game-overlay'
import * as voice from '@/services/voice'
import * as geminiService from '@/services/geminiFileSearch'
import * as tracker from '../../services/gameEventsTracker'
import * as prediction from '../../services/predictionEngine'
import { resolvePhaseActions, type Phase } from '../../services/roundPhaseFSM'
import * as telemetry from '../../services/telemetry'
import { RAG_CONFIG } from '../../config/ragConfig'
import { getAgentName } from '../utils/agentMapping'
import { getMapName } from '../utils/valorantMappings'

type ChatMessage = { role: 'user' | 'model'; parts: Array<{ text: string }> }

// Short, conversational questions that should NOT hit Gemini — the AI was
// fabricating match context (e.g. made-up Cypher counter-play) when asked
// meta-questions like "can you hear me". Handled locally for speed + cost.
const META_QUESTIONS: Array<{ pattern: RegExp; reply: string }> = [
  { pattern: /^\s*(can you hear me|do you hear me|are you listening|are you there)\s*[?.!]*\s*$/i,
    reply: "Yes, I hear you. Ask me anything about Valorant." },
  { pattern: /^\s*(are you working|are you on|are you online|you there|you working)\s*[?.!]*\s*$/i,
    reply: "I'm online. Fire away." },
  { pattern: /^\s*(hello|hi|hey|yo|sup)\s*[.!?]*\s*$/i,
    reply: "Hey. What do you want to work on?" },
  { pattern: /^\s*(test|testing|mic check|mic test)\s*[.!?]*\s*$/i,
    reply: "Audio is working. Ask me about a round, an agent, or a map." },
  { pattern: /^\s*(what can you do|help|what do you do)\s*[?.!]*\s*$/i,
    reply: "I coach live — buys, retakes, post-plants, rotations, and matchups. Ask me any time." },
  { pattern: /^\s*(thanks|thank you|thx|ty)\s*[.!?]*\s*$/i,
    reply: "Anytime." },
]

function detectMetaQuestion(text: string): string | null {
  const t = (text || '').trim()
  if (!t || t.length > 60) return null
  for (const m of META_QUESTIONS) if (m.pattern.test(t)) return m.reply
  return null
}

export default function OverlayApp() {
  const [overlayInfo, setOverlayInfo] = useState<any>({})
  const [overlayAiQueue, setOverlayAiQueue] = useState<string[]>([])
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [debugOpen, setDebugOpen] = useState(false)
  const storeIdRef = useRef<string>('')
  const [hotkey, setHotkey] = useState<string>('Ctrl+Alt+C')
  const [responseMode, setResponseMode] = useState<'speech' | 'text' | 'both'>('both')
  const [voiceVolume, setVoiceVolume] = useState<number>(1)
  const [voiceRate, setVoiceRate] = useState<number>(1)
  // Defaults to OFF — previously every kill triggered an API request which
  // felt spammy. Users opt-in from the desktop settings panel.
  const [autoSpeakOnKill, setAutoSpeakOnKill] = useState<boolean>(false)
  const [listening, setListening] = useState<boolean>(false)
  const [settingsTrigger, setSettingsTrigger] = useState<number>(0)
  const [settingsHotkey, setSettingsHotkey] = useState<string>('Ctrl+Alt+S')
  const [thinking, setThinking] = useState<boolean>(false)
  const [ultAlerts, setUltAlerts] = useState<tracker.UltAlert[]>([])
  const [roundEndPrompt, setRoundEndPrompt] = useState<boolean>(false)
  const [hasGameContext, setHasGameContext] = useState<boolean>(true)
  const listeningRef = useRef(false)
  const lastPhaseRef = useRef<string>('unknown')
  const lastBuyRoundRef = useRef<number>(-1)
  const pendingSafeHintRef = useRef<string | null>(null)
  // #2 abort stale Gemini requests so older replies never land after newer
  const queryAbortRef = useRef<AbortController | null>(null)
  // #3 per-trigger rate limits so rapid events do not spam the API
  const lastTriggerAtRef = useRef<Record<string, number>>({})
  const AUTO_COOLDOWN_MS: Record<string, number> = {
    kill: 20000,
    'phase:shopping': 4000,
    'phase:end': 4000,
    generic: 3000,
  }
  // Cap kill-triggered prompts to one per round so a hot round can't burn
  // through budget even when the 20s cooldown would otherwise allow it.
  const lastKillTipRoundRef = useRef<number>(-1)
  // 10s dedupe: the push-to-talk hotkey sometimes double-fires the same
  // transcript; drop the second identical voice command when it lands fast.
  const lastVoiceCommandRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  // #4 debounce tracker snapshots to avoid thrashing localStorage
  const saveSnapshotTimerRef = useRef<number | null>(null)
  // #7 track whether we have initialized predictionEngine for this match
  const predictionMatchIdRef = useRef<string | null>(null)
  const lastRecordedRoundRef = useRef<number>(-1)

  function allowTrigger(key: string): boolean {
    const now = Date.now()
    const cooldown = AUTO_COOLDOWN_MS[key] ?? AUTO_COOLDOWN_MS.generic
    const last = lastTriggerAtRef.current[key] || 0
    if (now - last < cooldown) return false
    lastTriggerAtRef.current[key] = now
    return true
  }

  function scheduleTrackerSave() {
    if (saveSnapshotTimerRef.current) return
    saveSnapshotTimerRef.current = window.setTimeout(() => {
      saveSnapshotTimerRef.current = null
      try { tracker.saveState() } catch { }
    }, 1500)
  }

  // Auto-clear AI response after user-configured duration
  useEffect(() => {
    if (overlayAiQueue.length > 0) {
      const storedDuration = localStorage.getItem("coach_message_duration")
      const duration = storedDuration ? parseInt(storedDuration, 10) : 15000

      const timer = setTimeout(() => {
        setOverlayAiQueue([])
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [overlayAiQueue])

  const gameData = useMemo(() => {
    const info = overlayInfo || {}
    const mi = info.match_info || {}
    const rosterKeys = Object.keys(mi).filter((k: string) => k.startsWith('roster_'))
    const roster = rosterKeys.map((k: string) => {
      try { const raw = mi[k]; return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
    }).filter(Boolean) as any[]
    const allies = roster.filter(r => r.teammate).map(r => r.character)
    const enemies = roster.filter(r => !r.teammate).map(r => r.character)
    const agent = (info.me || {}).agent || 'unknown'
    const map = mi.map || 'unknown'
    return { map, agent, allies, enemies }
  }, [overlayInfo])

  // #1 respect coach settings toggles persisted from the desktop panel.
  // coach_auto_kill_tips is opt-IN ('1' = enabled), every other flag is
  // opt-OUT ('0' = disabled) — see DesktopSettingsPanel for the writers.
  const suppressDuringCombatRef = useRef<boolean>(true)
  useEffect(() => {
    const loadNumber = (key: string, fallback: number, min: number, max: number): number => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return fallback
        const n = parseFloat(raw)
        if (!Number.isFinite(n)) return fallback
        return Math.min(max, Math.max(min, n))
      } catch { return fallback }
    }
    const loadMode = (): 'speech' | 'text' | 'both' => {
      try {
        const raw = localStorage.getItem('coach_response_mode')
        if (raw === 'speech' || raw === 'text' || raw === 'both') return raw
      } catch { }
      return 'both'
    }
    try {
      setAutoSpeakOnKill(localStorage.getItem('coach_auto_kill_tips') === '1')
      suppressDuringCombatRef.current = localStorage.getItem('coach_suppress_during_combat') !== '0'
      setResponseMode(loadMode())
      setVoiceVolume(loadNumber('coach_voice_volume', 1, 0, 1))
      setVoiceRate(loadNumber('coach_voice_rate', 1, 0.5, 2))
    } catch { }
    // React to changes from the settings window (same-origin storage events)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'coach_auto_kill_tips') setAutoSpeakOnKill(e.newValue === '1')
      if (e.key === 'coach_suppress_during_combat') suppressDuringCombatRef.current = e.newValue !== '0'
      if (e.key === 'coach_response_mode') setResponseMode(loadMode())
      if (e.key === 'coach_voice_volume') setVoiceVolume(loadNumber('coach_voice_volume', 1, 0, 1))
      if (e.key === 'coach_voice_rate') setVoiceRate(loadNumber('coach_voice_rate', 1, 0.5, 2))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // initialize gemini lazily
  useEffect(() => {
    try { storeIdRef.current = RAG_CONFIG.defaultStoreId } catch { }
    try { geminiService.initialize() } catch { }

    // Warm up microphone permission
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(t => t.stop())
          setDebugLog(prev => [`Microphone initialized successfully`, ...prev])
        })
        .catch(err => {
          setDebugLog(prev => [`Microphone initialization failed: ${err.message}`, ...prev])
        })
    }
  }, [])

  const parseValorantPayload = useCallback((raw: any) => {
    const tryParse = (value: any): any => {
      if (!value) return null
      if (value.source === 'valorant') return value
      if (typeof value === 'string') {
        try { return JSON.parse(value) } catch { return null }
      }
      if (typeof value === 'object') {
        return tryParse(value.content ?? value.data ?? value.message ?? value.detail)
      }
      return null
    }
    const parsed = tryParse(raw)
    return parsed?.source === 'valorant' ? parsed.payload : null
  }, [])

  const queuePrompt = useCallback(async (hint: string) => {
    // Meta-questions ("can you hear me", "hello", "test") are answered locally
    // so (a) the AI stops fabricating match context for chit-chat, and (b) they
    // don't burn budget and still work when the daily cap is exhausted.
    const metaReply = detectMetaQuestion(hint)
    if (metaReply) {
      telemetry.track('ai', 'meta_short_circuit', { hint: hint.slice(0, 60) })
      if (queryAbortRef.current) {
        try { queryAbortRef.current.abort() } catch { }
        queryAbortRef.current = null
      }
      if (responseMode !== 'speech') setOverlayAiQueue([metaReply])
      else setOverlayAiQueue([])
      if (responseMode !== 'text') {
        try { voice.speak(metaReply, { rate: voiceRate, volume: voiceVolume }) } catch { }
      }
      return
    }

    // #18 Hard cap: once the daily budget is exhausted, drop the request.
    if (!budgetAllows()) {
      telemetry.track('cost', 'budget_exceeded', { hint: hint.slice(0, 60) })
      setDebugLog(prev => [`Budget cap reached — dropped: "${hint.slice(0, 40)}"`, ...prev])
      return
    }
    // #2 cancel any in-flight query so the newest trigger wins
    if (queryAbortRef.current) {
      try { queryAbortRef.current.abort() } catch { }
    }
    const controller = new AbortController()
    queryAbortRef.current = controller
    const mySignal = controller.signal

    const startedAt = Date.now()
    // Hoisted so the catch block can still attribute failures to the objective.
    const gate = tracker.getPhaseGate()
    try {
      setThinking(true)
      setHasGameContext(tracker.hasUsefulData())
      const prompt = buildCompositePrompt(hint)

      // Construct metadata filters based on game context
      const info = overlayInfo || {}
      const mi = info.match_info || {}
      const rawMap = mi.map || ''
      const rawAgent = (info.me || {}).agent || ''
      const agentName = getAgentName(rawAgent)
      const mapName = getMapName(rawMap)

      const filters: string[] = []

      // Normalize map
      const maps = ['Abyss', 'Ascent', 'Bind', 'Breeze', 'Corrode', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset']
      const queryMap = maps.find(m => hint.toLowerCase().includes(m.toLowerCase()))
      const currentMap = maps.find(m => mapName.toLowerCase().includes(m.toLowerCase()))
      const targetMap = queryMap || currentMap

      // Normalize agent
      const agents = [
        'Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 
        'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon', 'Omen', 
        'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Tejo', 'Veto', 'Viper', 
        'Vyse', 'Waylay', 'Yoru'
      ]
      const queryAgent = agents.find(a => hint.toLowerCase().includes(a.toLowerCase()))
      const currentAgent = agents.find(a => agentName.toLowerCase().includes(a.toLowerCase()))
      const targetAgent = queryAgent || currentAgent

      // 1. Agent Filter (High Priority)
      if (targetAgent) {
        filters.push(`agent = '${targetAgent}'`)
      }

      // 2. Map Filter (Conditional)
      // Only include map filter if:
      // - The user explicitly asked about a map (queryMap exists)
      // - OR there is NO agent target (general map question)
      // We avoid adding currentMap filter if the user is asking about an Agent, to prevent noise.
      if (queryMap || (!targetAgent && currentMap)) {
         if (targetMap) filters.push(`map = '${targetMap}'`)
      }

      // Always include general guides
      filters.push(`type = 'guide'`)
      filters.push(`category = 'fundamentals'`)
      filters.push(`category = 'game_sense'`)

      // #8/#11/#12 Hand off game context so the service can inject agent role,
      // real map callouts, and cache repeat objective-driven prompts.
      const trackerState = tracker.getState()
      const contextForGemini = {
        agent: targetAgent,
        map: targetMap,
        objective: gate.objective,
        economyBucket: computeEconomyBucket(trackerState),
        // Cache-key is opt-in. We only cache low-entropy, high-repeat prompts:
        // auto buy-phase and round-end reflections. Manual questions stay fresh.
        cacheKey: isAutoCacheablePrompt(hint)
          ? `${targetMap || 'any'}|${targetAgent || 'any'}|${gate.objective}|${computeEconomyBucket(trackerState)}|${hint.slice(0, 40)}`
          : undefined,
        rejectPatterns: loadRejectedPatterns(),
      }

      const options: geminiService.FileSearchOptions = {
        metadataFilter: filters.length > 0 ? filters.join(' OR ') : undefined,
        context: contextForGemini,
      }

      telemetry.track('ai', 'prompt_start', {
        objective: gate.objective,
        map: targetMap,
        agent: targetAgent,
        cached: !!contextForGemini.cacheKey,
        hintPrefix: hint.slice(0, 40),
      })

      const res = await geminiService.fileSearch(storeIdRef.current || '', prompt, options)
      // Discard the result if a newer query superseded this one
      if (mySignal.aborted) {
        telemetry.track('ai', 'prompt_aborted', { objective: gate.objective })
        return
      }
      const text = (res.text || '').trim()
      const cleanText = text.replace(/\*/g, '')

      // Budget now increments only on a resolved (non-empty) response. A failed
      // call or empty result shouldn't count against the user's daily cap.
      if (cleanText) {
        incrementBudgetUsed()
        try { (window as any).overwolf?.utils?.placeOnClipboard(cleanText + '\n\n- Generated by OWNED AI') } catch { }
      }

      if (responseMode !== 'speech') {
        setOverlayAiQueue(cleanText ? [cleanText] : [])
      } else {
        setOverlayAiQueue([])
      }
      if (responseMode !== 'text' && cleanText) {
        try { voice.speak(cleanText, { rate: voiceRate, volume: voiceVolume }) } catch { }
      }
      telemetry.track('ai', 'prompt_success', {
        objective: gate.objective,
        ms: Date.now() - startedAt,
        len: cleanText.length,
        empty: !cleanText,
      })
    } catch (err: any) {
      telemetry.track('ai', 'prompt_error', {
        objective: gate.objective,
        ms: Date.now() - startedAt,
        message: err?.message?.slice(0, 200),
      })
      // Surface the failure in the overlay so the user isn't left wondering
      // why the coach went silent. We only show text; speech-only mode users
      // would otherwise get nothing, so we fall back to a short spoken hint.
      if (!mySignal.aborted) {
        const msg = 'Coach hit a snag — try again in a moment.'
        if (responseMode !== 'speech') setOverlayAiQueue([msg])
        if (responseMode === 'speech') {
          try { voice.speak(msg, { rate: voiceRate, volume: voiceVolume }) } catch { }
        }
      }
    } finally {
      if (queryAbortRef.current === controller) queryAbortRef.current = null
      setThinking(false)
    }
  }, [responseMode, voiceRate, voiceVolume, overlayInfo])


  const handleVoiceCommand = useCallback(async () => {
    if (listeningRef.current) return
    listeningRef.current = true
    setListening(true)
    setDebugLog(prev => [`Voice command started`, ...prev])
    try {
      const result = await voice.startListening({
        maxDurationMs: 8000
      })
      const question = result.text.trim()
      setDebugLog(prev => [`Voice result: "${question}"`, ...prev])
      // ASR noise filter: very short transcripts ("uh", "hm", a single letter)
      // are almost always microphone noise and should never hit Gemini.
      if (!question || question.length < 3) {
        return
      }
      // Repeat-command dedupe: if the same transcript fires twice within 10s
      // (e.g. the push-to-talk key chatters), drop the second one.
      const now = Date.now()
      const normalized = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
      if (lastVoiceCommandRef.current.text === normalized &&
          now - lastVoiceCommandRef.current.at < 10000) {
        setDebugLog(prev => [`Dropped duplicate voice command`, ...prev])
        return
      }
      lastVoiceCommandRef.current = { text: normalized, at: now }
      // #5 During the round-end window, capture the transcript as a round
      // note into predictionEngine so it shows up in future prompts + the
      // post-match report, then still answer so the user gets feedback.
      try {
        if (tracker.getState().roundPhase === 'end') {
          prediction.addUserNote(question)
          setDebugLog(prev => [`Saved round note: "${question.slice(0, 60)}"`, ...prev])
        }
      } catch { }
      await queuePrompt(question)
    } catch (err: any) {
      const code = err?.code
      setDebugLog(prev => [`Voice error (${code}): ${err?.message}`, ...prev])
      if (code === 'cancelled' || code === 'already_listening') {
        return
      }
      if (code === 'permission_denied' || code === 'device_missing') {
        try {
          const msg = code === 'permission_denied' ? 'Microphone permission denied.' : 'No microphone found.'
          setOverlayAiQueue([msg, "Open Overwolf Hotkeys to configure or use text mode."])
          setSettingsTrigger((n) => n + 1)
          const ow: any = (window as any).overwolf
          ow?.utils?.openUrl?.('overwolf://settings/games-overlay?hotkey=voice_command&gameId=21640')
        } catch { }
        return
      }
      setOverlayAiQueue([`Voice error: ${err?.message || 'Unknown'}`])
    } finally {
      listeningRef.current = false
      setListening(false)
      setDebugLog(prev => [`Voice command finished`, ...prev])
    }
  }, [queuePrompt])

  const handleValorantPayload = useCallback((payload: any) => {
    if (!payload) return
    try {
      setDebugLog((arr) => [
        `${new Date().toLocaleTimeString()} ${payload?.type || 'unknown'}`,
        ...arr
      ].slice(0, 50))
    } catch { }
    if (payload?.type === 'info_update') {
      const info = payload.data?.info
      if (info) {
        if (info.match_info) {
          const keys = Object.keys(info.match_info)
          setDebugLog((prev) => [`Match Info Update: ${keys.join(', ')}`, ...prev].slice(0, 50))
        }

        setOverlayInfo((prev: any) => {
          const next = { ...prev }
          for (const key in info) {
            if (typeof info[key] === 'object' && info[key] !== null && !Array.isArray(info[key])) {
              next[key] = { ...(next[key] || {}), ...info[key] }
            } else {
              next[key] = info[key]
            }
          }
          return next
        })

        // ===== Feed live match data into gameEventsTracker =====
        try {
          const mi = info.match_info
          if (mi) {
            if (mi.map) tracker.processMap(mi.map)
            if (mi.team) tracker.processTeam(mi.team)
            if (mi.round_phase) {
              const roundNum = mi.round_number != null ? Number(mi.round_number) : undefined
              tracker.onRoundPhaseChange(mi.round_phase, roundNum)
            }
            // GEP ships the live score as a stringified `{ won, lost }` under
            // `mi.score`. The previous code read `mi.round_won` / `mi.round_lost`
            // which don't exist — outcome inference was always 0/0 and every
            // prediction round was classified 'loss'. Parse the real field.
            if (mi.score != null) {
              try {
                const parsed = typeof mi.score === 'string' ? JSON.parse(mi.score) : mi.score
                const won = Number(parsed?.won ?? parsed?.team_score ?? 0)
                const lost = Number(parsed?.lost ?? parsed?.enemy_score ?? 0)
                if (Number.isFinite(won) && Number.isFinite(lost)) {
                  tracker.processScore(won, lost)
                }
              } catch { }
            } else if (mi.round_won != null || mi.round_lost != null) {
              const won = Number(mi.round_won ?? 0)
              const lost = Number(mi.round_lost ?? 0)
              tracker.processScore(won, lost)
            }
            if (mi.planted_location) tracker.processSpikeEvent('planted_location', mi.planted_location)
            for (const key of Object.keys(mi)) {
              if (key.startsWith('scoreboard_') || key.startsWith('roster_')) {
                tracker.processScoreboard(key, mi[key])
              }
            }
          }
          const me = info.me
          if (me) {
            if (me.agent) tracker.processAgent(me.agent)
            if (me.health != null) tracker.processHealth(Number(me.health))
            if (me.abilities) tracker.processAbilities(me.abilities)
          }
          // Surface ult alerts + context availability to the UI
          setUltAlerts(tracker.getUltAlerts().slice(0, 3))
          setHasGameContext(tracker.hasUsefulData())
          // #4 persist tracker snapshot (debounced) so reloads restore state
          scheduleTrackerSave()
          // #7 init predictionEngine once per match from live roster, then
          // keep growing the enemy roster as GEP pushes more scoreboard rows.
          // initMatch used to be a one-shot snapshot — if the first info_update
          // only carried 2 of 5 enemies, the rest never got registered.
          const ts = tracker.getState()
          if (ts.matchId && ts.matchId !== predictionMatchIdRef.current && ts.scoreboard.length > 0) {
            const enemies = tracker.getEnemyAgents()
            prediction.initMatch(ts.matchId, ts.map || 'unknown', enemies)
            predictionMatchIdRef.current = ts.matchId
          } else if (ts.matchId && ts.matchId === predictionMatchIdRef.current) {
            const enemies = tracker.getEnemyAgents()
            if (enemies.length > 0) prediction.refreshEnemyTeam(enemies)
          }
        } catch { }
      }
    }
    if (payload?.type === 'new_events') {
      const events = payload.data?.events || []
      for (const ev of events) {
        // Route spike + kill_feed events into tracker
        try {
          if (ev.name === 'spike_planted') tracker.processSpikeEvent('planted_location', ev.data?.location || ev.data)
          else if (ev.name === 'planted_location') tracker.processSpikeEvent('planted_location', ev.data)
          else if (ev.name === 'spike_defused') tracker.processSpikeEvent('spike_defused')
          else if (ev.name === 'spike_detonated') tracker.processSpikeEvent('spike_detonated')
          else if (ev.name === 'kill_feed') tracker.processKillFeed(ev.data)
          else if (ev.name === 'match_start') {
            tracker.onMatchStart(ev.data?.matchId)
            predictionMatchIdRef.current = null
            lastRecordedRoundRef.current = -1
            lastKillTipRoundRef.current = -1
          }
          else if (ev.name === 'match_end' || ev.name === 'match_outcome') {
            tracker.onMatchEnd()
            // Matches that end while the last round is still in 'end' phase
            // used to leave the "Round Ended" card up indefinitely. Explicitly
            // dismiss it here so the UI never gets stuck across matches.
            setRoundEndPrompt(false)
          }
          else if (ev.name === 'round_start') tracker.setRoundStartTime()
        } catch { }

        // Auto post-kill coaching — opt-in, and heavily rate-limited:
        //   - 20s global cooldown (allowTrigger('kill'))
        //   - max one kill tip per round (lastKillTipRoundRef)
        //   - must be in a safe window unless the user disabled that gate
        // If the kill isn't safe we DROP it rather than defer — a post-kill
        // tip that fires 30s later, when the round has moved on, is worse
        // than silence and was a major source of "why is it spamming me?".
        if (ev.name === 'kill' && autoSpeakOnKill) {
          const gate = tracker.getPhaseGate()
          const safe = suppressDuringCombatRef.current ? gate.safeToSpeak : true
          const round = tracker.getState().currentRound
          const alreadyTippedThisRound = lastKillTipRoundRef.current === round
          if (safe && !alreadyTippedThisRound && allowTrigger('kill')) {
            lastKillTipRoundRef.current = round
            queuePrompt('Suggest quick post-kill positioning and utility follow-up.')
          }
        }
      }
    }
    if (payload?.type === 'voice_command') {
      handleVoiceCommand()
    }
    if (payload?.type === 'voice_command_state') {
      const state = payload.data?.state
      if (state === 'down') {
        handleVoiceCommand()
      } else if (state === 'up') {
        try { voice.endListening() } catch { }
      }
    }
    if (payload?.type === 'toggle_settings') {
      try { setSettingsTrigger((n) => n + 1) } catch { }
    }
    if (payload?.type === 'hotkey_unassigned') {
      try { setSettingsTrigger((n) => n + 1) } catch { }
    }
    if (payload?.type === 'hotkey_changed') {
      const name = payload?.data?.name
      const binding = payload?.data?.binding
      if (name === 'voice_command' && binding) setHotkey(binding)
      if (name === 'toggle_settings' && binding) setSettingsHotkey(binding)
    }
  }, [autoSpeakOnKill, handleVoiceCommand, queuePrompt])

  useEffect(() => {
    const ow: any = (window as any).overwolf
    const onOwMessage = (event: any) => {
      try {
        const payload = parseValorantPayload(event)
        if (payload) handleValorantPayload(payload)
      } catch { }
    }
    const onWindowMessage = (event: MessageEvent) => {
      try {
        const payload = parseValorantPayload(event.data)
        if (payload) handleValorantPayload(payload)
      } catch { }
    }
    try { ow?.windows?.onMessageReceived?.addListener(onOwMessage) } catch { }
    try { window.addEventListener('message', onWindowMessage) } catch { }
    return () => {
      try { ow?.windows?.onMessageReceived?.removeListener(onOwMessage) } catch { }
      try { window.removeEventListener('message', onWindowMessage) } catch { }
    }
  }, [handleValorantPayload, parseValorantPayload])

  useEffect(() => {
    try {
      const ow: any = (window as any).overwolf
      ow?.settings?.hotkeys?.get((res: any) => {
        try {
          const list: any[] = res?.success
            ? (
              Array.isArray(res?.hotkeys)
                ? res.hotkeys
                : [
                  ...(Array.isArray(res?.globals) ? res.globals : []),
                  ...(Array.isArray(res?.games?.[21640]) ? res.games[21640] : []),
                ]
            )
            : []
          const hk = list.find((h: any) => h?.name === 'voice_command')
          const val = hk?.binding || hk?.hotkey
          if (val) setHotkey(val)
          const sh = list.find((h: any) => h?.name === 'toggle_settings')
          const sval = sh?.binding || sh?.hotkey
          if (sval) setSettingsHotkey(sval)
        } catch { }
      })
    } catch { }
  }, [])

  // Auto-dismiss the round-end prompt 12s after it appears. Valorant's round
  // end window is ~7s, so if we haven't seen a fresh phase transition by then
  // GEP likely dropped one and the UI would otherwise stick indefinitely.
  useEffect(() => {
    if (!roundEndPrompt) return
    const timer = window.setTimeout(() => setRoundEndPrompt(false), 12000)
    return () => window.clearTimeout(timer)
  }, [roundEndPrompt])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault()
        setDebugOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const buildCompositePrompt = (userText: string) => {
    // Prefer the live-state summary from gameEventsTracker (round, phase, economy,
    // spike, abilities, kills, alive count) falling back to info_update roster
    // data for cases where the tracker hasn't populated yet.
    const useTracker = tracker.hasUsefulData()
    const info = overlayInfo || {}
    const mi = info.match_info || {}

    // Parse roster once so we can both decide if we have ANY context and build
    // the fallback block without doing the work twice.
    const rosterKeys = Object.keys(mi).filter((k: string) => k.startsWith('roster_'))
    const roster = rosterKeys.map((k: string) => {
      try { const raw = mi[k]; return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
    }).filter(Boolean) as any[]
    const rawAgent = String((info.me || {}).agent || '').trim()
    const rawMap = String(mi.map || '').trim()
    const hasAnyLiveContext = useTracker || roster.length > 0 || !!rawAgent || !!rawMap

    // No match in progress — do NOT invent context. Tell the model explicitly
    // that there's no live state so it answers as a general coach instead of
    // inventing fake enemy comps / matchups.
    if (!hasAnyLiveContext) {
      return `You are a Valorant coach. No match is currently in progress — there is no live context, no enemy team, no round state.

User Question: "${userText}"

Rules:
- Do NOT invent match context. No fake scores, no made-up enemy agents, no fabricated round state.
- If the question is about Valorant, answer as a general coach using the retrieved guides.
- If the question is casual or off-topic (e.g. "can you hear me", "hello"), answer it conversationally in one short sentence — do not launch into tactical advice.
- 1–2 sentences max. No preamble.`
    }

    // --- In-match path ---
    let contextBlock = ''
    if (useTracker) {
      contextBlock = tracker.buildContextSummary()
    } else {
      const allies = roster.filter(r => r.teammate).map(r => getAgentName(r.character)).filter(Boolean).join(', ')
      const enemies = roster.filter(r => !r.teammate).map(r => getAgentName(r.character)).filter(Boolean).join(', ')
      const agent = rawAgent ? getAgentName(rawAgent) : ''
      const map = rawMap ? getMapName(rawMap) : ''
      const parts: string[] = []
      if (map) parts.push(`Map: ${map}`)
      if (agent) parts.push(`My Agent: ${agent}`)
      if (allies) parts.push(`My Team: ${allies}`)
      if (enemies) parts.push(`Enemy Team: ${enemies}`)
      contextBlock = parts.join('\n')
    }

    const objective = tracker.buildObjectiveDirective()
    const gate = tracker.getPhaseGate()
    const focus = gate.objective

    // #7 After a few rounds the prediction engine has real data — fold its
    // learned enemy patterns (site pref, aggression, ult cadence) into the prompt.
    let patternBlock = ''
    try {
      const match = prediction.getCurrentMatch()
      if (match && match.rounds.length >= 2) {
        const summary = prediction.analyzePatterns().summary
        if (summary) patternBlock = `\n\nEnemy Patterns (learned this match):\n${summary}`
      }
    } catch { }

    // Phase-shaped task keeps answers aligned with winning objectives
    // (economy management, retakes, post-plant, rotations, reflection).
    // NOTE: matchup examples must reference the actual listed enemies — the
    // previous prompt hardcoded "Cypher" and biased the model into inventing
    // Cypher advice even when Cypher wasn't on the enemy team.
    return `Live Match Context:\n${contextBlock}${patternBlock}\n\nCoaching Focus: ${focus}\n${objective}\n\nUser Question: "${userText}"\n\nRules:\n- Reference the actual context above. Only call out matchups for agents that are listed on the enemy team — never invent agents.\n- Ground your answer in the current round state, not generic textbook plays.\n- If the question is off-topic (e.g. "can you hear me"), answer it conversationally instead of forcing tactical advice.\n- 1–2 sentences, actionable, no preamble.`
  }

  const debugEntries = debugLog.length ? debugLog : ['No overlay events yet.']

  // React to round-phase transitions: the FSM decides which side effects fire,
  // this effect only applies them. Keeps the transition logic testable.
  useEffect(() => {
    const s = tracker.getState()
    const phase = s.roundPhase as Phase
    const round = s.currentRound
    if (phase === lastPhaseRef.current) return
    const prevPhase = lastPhaseRef.current as Phase
    lastPhaseRef.current = phase
    telemetry.track('phase', 'transition', { from: prevPhase, to: phase, round })

    const actions = resolvePhaseActions({
      prevPhase,
      nextPhase: phase,
      round,
      lastBuyRound: lastBuyRoundRef.current,
      lastRecordedRound: lastRecordedRoundRef.current,
      autoBuyAdviceEnabled: localStorage.getItem('coach_auto_buy_advice') !== '0',
      hasPendingSafeHint: !!pendingSafeHintRef.current,
      safeToSpeak: tracker.getPhaseGate().safeToSpeak,
    })

    for (const act of actions) {
      switch (act.type) {
        case 'CLEAR_ROUND_END_PROMPT':
          setRoundEndPrompt(false)
          break
        case 'SHOW_ROUND_END_PROMPT':
          setRoundEndPrompt(true)
          break
        case 'AUTO_BUY_ADVICE':
          if (allowTrigger('phase:shopping')) {
            lastBuyRoundRef.current = act.round
            queuePrompt('What should I buy this round given our team economy and the enemy threat?')
          }
          break
        case 'RECORD_ROUND_FOR_PREDICTION':
          try {
            if (s.matchId) {
              lastRecordedRoundRef.current = round
              const summary = tracker.getRoundDataForPrediction()
              // Prefer direct score comparison. If tracker score is zero/zero
              // (GEP hasn't yet delivered `mi.score`) fall back to inferring
              // from the previously-recorded win count so we don't label every
              // unresolved round as a 'loss'.
              const totalNow = s.score.won + s.score.lost
              const prevRounds = prediction.getCurrentMatch()?.rounds ?? []
              const prevWins = prevRounds.filter(r => r.outcome === 'win').length
              const prevLosses = prevRounds.filter(r => r.outcome === 'loss').length
              let outcome: 'win' | 'loss' | 'unknown' = 'unknown'
              if (totalNow > prevWins + prevLosses) {
                outcome = s.score.won > prevWins ? 'win' : 'loss'
              }
              prediction.recordRound({
                round: summary.round,
                site: summary.site,
                enemyFirstKill: summary.enemyFirstKill,
                aggressivePlay: summary.aggressivePlay,
                ultsUsed: summary.ultsUsed,
                outcome,
                plantedSite: summary.site,
              })
            }
          } catch { }
          break
        case 'FLUSH_PENDING_HINT':
          if (allowTrigger('generic')) {
            const hint = pendingSafeHintRef.current
            pendingSafeHintRef.current = null
            if (hint) queuePrompt(hint)
          }
          break
      }
    }
  }, [overlayInfo, queuePrompt])

  // Hydrate tracker snapshot on first mount + prune stale snapshots
  useEffect(() => {
    try {
      tracker.pruneOldSnapshots(3)
      tracker.hydrate(tracker.getState().matchId)
    } catch { }
  }, [])

  return (
    <>
      <InGameOverlay
        hotkey={hotkey}
        mode={responseMode}
        aiText={overlayAiQueue[0] || ''}
        gameData={gameData}
        listening={listening}
        settingsTrigger={settingsTrigger}
        settingsHotkey={settingsHotkey}
        thinking={thinking}
        hasGameContext={hasGameContext}
        alerts={ultAlerts}
        showRoundEndPrompt={roundEndPrompt}
        onToggle={(next) => {
          if (!next) {
            try { voice.cancelListening() } catch { }
          }
        }}
        onRate={(rating: 'up' | 'down', text: string) => {
          // #10 Persist rating; build reject list for the next prompt.
          try {
            const key = 'coach_ratings'
            const raw = localStorage.getItem(key)
            const list = raw ? (JSON.parse(raw) as Array<{ t: number; r: string; text: string; obj: string; map: string; agent: string }>) : []
            const gate = tracker.getPhaseGate()
            const s = tracker.getState()
            list.push({ t: Date.now(), r: rating, text, obj: gate.objective, map: s.map, agent: s.myAgent })
            localStorage.setItem(key, JSON.stringify(list.slice(-200)))
            telemetry.track('ui', 'feedback', { rating, objective: gate.objective, map: s.map, agent: s.myAgent })

            if (rating === 'down') {
              const rejKey = 'coach_rejected_patterns'
              const rejRaw = localStorage.getItem(rejKey)
              const rejects = rejRaw ? (JSON.parse(rejRaw) as string[]) : []
              // Strip whitespace / stash first 90 chars — the LLM just needs
              // enough signal to avoid repeating the same advice.
              rejects.push(text.replace(/\s+/g, ' ').trim().slice(0, 90))
              localStorage.setItem(rejKey, JSON.stringify(rejects.slice(-25)))
            }
          } catch { }
        }}
      />
      <div className="fixed left-4 bottom-4 z-50 pointer-events-auto select-none">
        <button
          onClick={() => setDebugOpen((open) => !open)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/60 transition"
        >
          {debugOpen ? 'Hide Debug' : 'Show Debug'}
          {debugLog.length ? ` (${debugLog.length})` : ''}
        </button>
        {debugOpen && (
          <div className="mt-2 w-72 max-h-64 overflow-auto rounded-2xl border border-white/20 bg-black/85 text-white/80 text-[11px] leading-relaxed shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-white/70 uppercase tracking-wide text-[10px]">
              <span>Overlay Debug</span>
              <button
                className="text-white/60 hover:text-white text-[10px]"
                onClick={() => setDebugLog([])}
              >
                Clear
              </button>
            </div>
            <ul className="px-3 py-2 space-y-1">
              {debugEntries.map((entry, idx) => (
                <li key={`${entry}-${idx}`} className="font-mono break-all">
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

// ============ module helpers ============

// Coarse economy bucket — matches cache granularity. Expand as needed.
function computeEconomyBucket(s: ReturnType<typeof tracker.getState>): string {
  // Pistol rounds are their own bucket (no credits context needed for cache).
  if (s.currentRound === 1 || s.currentRound === 13) return 'pistol'
  const team = s.scoreboard.filter(p => p.teammate)
  if (team.length === 0) return 'unknown'
  const avg = team.reduce((sum, p) => sum + (p.money || 0), 0) / team.length
  if (avg < 2000) return 'eco'
  if (avg < 3500) return 'force'
  if (avg < 5000) return 'bonus'
  return 'full'
}

// Hints we generate automatically (buy / round-end) are safe to cache; free
// voice questions from the user are too variable and should always be fresh.
const AUTO_CACHEABLE_HINTS = [
  'What should I buy this round',
  'Suggest quick post-kill',
]
function isAutoCacheablePrompt(hint: string): boolean {
  return AUTO_CACHEABLE_HINTS.some(a => hint.startsWith(a))
}

function loadRejectedPatterns(): string[] {
  try {
    const raw = localStorage.getItem('coach_rejected_patterns')
    if (!raw) return []
    const arr = JSON.parse(raw) as string[]
    return Array.isArray(arr) ? arr.slice(-10) : []
  } catch { return [] }
}

// #18 Daily budget cap. Caller sets `coach_ai_budget_cap` to a call-count
// ceiling per local day; 0 or missing disables the cap. Usage resets at the
// start of each local day.
function budgetKeyForToday(): string {
  const d = new Date()
  return `coach_ai_budget_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function getBudgetCap(): number {
  try {
    const raw = localStorage.getItem('coach_ai_budget_cap')
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return 0 }
}

function getBudgetUsedToday(): number {
  try {
    const raw = localStorage.getItem(budgetKeyForToday())
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return 0 }
}

function incrementBudgetUsed(): void {
  try {
    const key = budgetKeyForToday()
    const n = getBudgetUsedToday() + 1
    localStorage.setItem(key, String(n))
  } catch { }
}

/** Returns true if another prompt can fire. False means cap exceeded. */
function budgetAllows(): boolean {
  const cap = getBudgetCap()
  if (cap <= 0) return true
  return getBudgetUsedToday() < cap
}

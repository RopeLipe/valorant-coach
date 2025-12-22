import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InGameOverlay } from '@code/components/in-game-overlay'
import * as voice from '@/services/voice'
import * as geminiService from '@/services/geminiFileSearch'
import * as gameEvents from '@/services/gameEventsTracker'
import * as predictionEngine from '../../services/predictionEngine'
import { RAG_CONFIG } from '../../config/ragConfig'
import { getAgentName } from '../utils/agentMapping'
import { getMapName } from '../utils/valorantMappings'
import { useAudioVisualizer } from '../hooks/useAudioVisualizer'

type ChatMessage = { role: 'user' | 'model'; parts: Array<{ text: string }> }

export default function OverlayApp() {
  const [overlayInfo, setOverlayInfo] = useState<any>({})
  const [overlayAiQueue, setOverlayAiQueue] = useState<string[]>([])
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [debugOpen, setDebugOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const storeIdRef = useRef<string>('')
  const [hotkey, setHotkey] = useState<string>('Ctrl+Alt+C')
  const [responseMode, setResponseMode] = useState<'speech' | 'text' | 'both'>('both')
  const [voiceVolume, setVoiceVolume] = useState<number>(1)
  const [voiceRate, setVoiceRate] = useState<number>(1)
  const [autoSpeakOnKill, setAutoSpeakOnKill] = useState<boolean>(true)
  const [listening, setListening] = useState<boolean>(false)
  const [thinking, setThinking] = useState<boolean>(false)
  const [settingsTrigger, setSettingsTrigger] = useState<number>(0)
  const [settingsHotkey, setSettingsHotkey] = useState<string>('Ctrl+Alt+S')
  const listeningRef = useRef(false)
  const lastRoundPhaseRef = useRef<string>('unknown')
  const lastShopOpenRef = useRef<number>(0)
  const [alerts, setAlerts] = useState<gameEvents.UltAlert[]>([])
  const [showRoundEndPrompt, setShowRoundEndPrompt] = useState<boolean>(false)

  // Audio visualizer for voice input feedback
  const audioData = useAudioVisualizer(listening, 16)

  // Helper to request full game state from background
  const requestFullGameState = useCallback(() => {
    try {
      (window as any).overwolf?.windows?.sendMessage(
        'background',
        { type: 'request_full_state' },
        () => { }
      )
    } catch (e) {
      console.error('Failed to request game state:', e)
    }
  }, [])

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

  // initialize gemini and set up sync
  useEffect(() => {
    try { storeIdRef.current = RAG_CONFIG.defaultStoreId } catch { }
    try { geminiService.initialize() } catch { }

    // Request initial game state immediately
    requestFullGameState()

    // Set up periodic sync every 15 seconds to ensure fresh data
    const syncInterval = setInterval(() => {
      requestFullGameState()
    }, 15000)

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

    return () => clearInterval(syncInterval)
  }, [requestFullGameState])

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
    try {
      // Sync state before processing prompt to ensure fresh data
      requestFullGameState()

      // Delay to allow sync to propagate through background service
      await new Promise(resolve => setTimeout(resolve, 500))

      setDebugLog(prev => [`queuePrompt started: "${hint.slice(0, 30)}..."`, ...prev].slice(0, 50))

      // Check if we have useful game data before making API call
      const gameState = gameEvents.getState()
      setDebugLog(prev => [
        `Game State: Round=${gameState.currentRound}, Map=${gameState.map}, Agent=${gameState.myAgent}, Scoreboard=${gameState.scoreboard.length}`,
        ...prev
      ].slice(0, 50))

      if (!gameEvents.hasUsefulData()) {
        setDebugLog(prev => [`No game data available, proceeding without context...`, ...prev].slice(0, 50))
      }

      const prompt = buildCompositePrompt(hint)
      setDebugLog(prev => [`Prompt built, length: ${prompt.length}`, ...prev].slice(0, 50))

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

      // 1b. Team Context (Synergy)
      // If the user asks about "team", "we", "us", "our", include all teammate agents
      const teamKeywords = ['team', 'we', 'us', 'our', 'strat', 'execute']
      const hasTeamContext = teamKeywords.some(k => hint.toLowerCase().includes(k))

      if (hasTeamContext) {
        const teammates = gameData.allies || []
        teammates.forEach(allyId => {
          const name = getAgentName(allyId)
          if (name && name !== 'unknown' && name !== agentName) {
            filters.push(`agent = '${name}'`)
          }
        })
      }
      // Combine map and agent filters
      const conditions: string[] = []
      if (targetMap) {
        conditions.push(`map = '${targetMap}'`)
      }
      if (filters.length > 0) {
        conditions.push(filters.length > 1 ? `(${filters.join(' OR ')})` : filters[0])
      }
      const options = conditions.length > 0 ? { metadataFilter: conditions.join(' AND ') } : undefined

      const res = await geminiService.fileSearch(storeIdRef.current || '', prompt, options)
      const text = (res.text || '').trim()

      // Clean up response to remove internal reasoning/actions if they leak through
      const cleanText = text
        .split('\n')
        .filter(line => {
          const lower = line.toLowerCase().trim()
          return !lower.startsWith('action:') &&
            !lower.startsWith('thought:') &&
            !lower.startsWith('search for') &&
            !lower.startsWith('step id:') &&
            !lower.startsWith('wait,')
        })
        .map(line => {
          // Strip "Advice 1:", "Defense:", etc.
          return line.replace(/^(Advice \d+|Option \d+|Defense|Attack|Note):/i, '').trim()
        })
        .filter(Boolean)
        .join('\n')
        .replace(/\*/g, '')
        .trim()

      // Handle empty response
      if (!cleanText) {
        setDebugLog(prev => [`Empty response from AI`, ...prev].slice(0, 50))
        setOverlayAiQueue(["Error: AI didn't respond. Try again in a moment."])
        return
      }

      if (cleanText) {
        try { (window as any).overwolf?.utils?.placeOnClipboard(cleanText + '\n\n- Generated by OWNED AI') } catch { }
      }

      // ALWAYS show text, even in speech mode, to prevent "silent failure" if audio breaks
      setOverlayAiQueue([cleanText])

      if (responseMode !== 'text' && cleanText) {
        try {
          setDebugLog(prev => [`Speaking response...`, ...prev].slice(0, 50))
          await voice.speak(cleanText, { rate: voiceRate, volume: voiceVolume })
          setDebugLog(prev => [`Speech completed`, ...prev].slice(0, 50))
        } catch (voiceErr: any) {
          console.error('Voice speak error:', voiceErr)
          setDebugLog(prev => [`Voice error: ${voiceErr?.message || String(voiceErr)}`, ...prev].slice(0, 50))
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || 'Unknown error'
      const errorLower = errorMsg.toLowerCase()
      console.error('queuePrompt error:', err)
      setDebugLog(prev => [`ERROR: ${errorMsg}`, ...prev].slice(0, 50))

      // User-friendly error messages for common issues
      let userMessage = "Error: Something went wrong. Please try again."

      if (errorLower.includes('quota') || errorLower.includes('rate limit') || errorLower.includes('429')) {
        userMessage = "Error: Servers are busy. Please wait a moment and try again."
      } else if (errorLower.includes('overloaded') || errorLower.includes('503') || errorLower.includes('unavailable')) {
        userMessage = "Error: Servers are overloaded. Please try again shortly."
      } else if (errorLower.includes('api key') || errorLower.includes('invalid')) {
        userMessage = "Error: Configuration issue. Please restart the app."
      } else if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('timeout')) {
        userMessage = "Error: Network issue. Check your internet connection."
      } else if (errorLower.includes('not found')) {
        userMessage = "Error: Knowledge base not found. Check your setup."
      }

      setOverlayAiQueue([userMessage])
    }
  }, [requestFullGameState, responseMode, voiceRate, voiceVolume, overlayInfo])

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

      // Stop listening UI immediately after speech is captured
      setListening(false)

      if (!question) {
        return
      }

      // If answering round-end prompt, record note and skip AI query
      if (showRoundEndPrompt) {
        predictionEngine.addUserNote(question)
        setDebugLog(prev => [`Recorded round note: "${question}"`, ...prev])
        setShowRoundEndPrompt(false)
        setOverlayAiQueue([`Note recorded: "${question}"`])
        return
      }

      // Start thinking UI while processing
      setThinking(true)
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
      setListening(false) // Ensure listening is off
      setThinking(false) // Ensure thinking is off
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
        // Debug: Log match_info keys to help diagnose missing data
        if (info.match_info) {
          const keys = Object.keys(info.match_info)
          setDebugLog((prev) => [`Match Info Update: ${keys.join(', ')}`, ...prev].slice(0, 50))

          // Process match_info for game events tracker
          const mi = info.match_info

          // Round phase changes - critical for state reset
          if (mi.round_phase) {
            const roundNum = mi.round_number ? parseInt(mi.round_number, 10) : undefined
            gameEvents.onRoundPhaseChange(mi.round_phase, roundNum)

            // Detect round-end for prediction engine
            if (mi.round_phase === 'end' && lastRoundPhaseRef.current !== 'end') {
              const gameState = gameEvents.getState()
              // Record round data to prediction engine
              predictionEngine.recordRound({
                round: gameState.currentRound,
                site: (gameState.thisRoundSpike?.location as 'A' | 'B' | 'C') || null,
                outcome: 'unknown',
                ultsUsed: [],
                userNote: ''
              })
              setDebugLog(prev => [`Round ${gameState.currentRound} ended - data recorded`, ...prev].slice(0, 50))

              // Trigger round-end prompt
              setShowRoundEndPrompt(true)
              // Auto-hide after 15 seconds
              setTimeout(() => setShowRoundEndPrompt(false), 15000)
            }

            // Update ult alerts on phase change
            setAlerts(gameEvents.getUltAlerts())
            lastRoundPhaseRef.current = mi.round_phase
          }

          // Initialize prediction engine on match start
          if (mi.match_id) {
            const currentMatch = predictionEngine.getCurrentMatch()
            if (!currentMatch || currentMatch.matchId !== mi.match_id) {
              const enemies = gameEvents.getState().scoreboard.filter(p => !p.teammate).map(p => p.character)
              const map = mi.map || gameEvents.getState().map
              predictionEngine.initMatch(mi.match_id, map, enemies)
              setDebugLog(prev => [`Match initialized: ${mi.match_id}`, ...prev].slice(0, 50))
            }
          }

          // Team side
          if (mi.team) {
            gameEvents.processTeam(mi.team)
          }

          // Map
          if (mi.map) {
            gameEvents.processMap(mi.map)
          }

          // Process scoreboard first to ensure agent lookup works for killfeed
          for (const key of keys) {
            if (key.startsWith('scoreboard_')) {
              try {
                gameEvents.processScoreboard(key, mi[key])
              } catch { }
            }
          }

          // Kill feed events
          if (mi.kill_feed) {
            try {
              const killData = typeof mi.kill_feed === 'string' ? JSON.parse(mi.kill_feed) : mi.kill_feed
              gameEvents.processKillFeed(killData)
              // Get the last processed kill with agent names
              const state = gameEvents.getState()
              const lastKill = state.thisRoundKills[state.thisRoundKills.length - 1]
              if (lastKill) {
                setDebugLog((prev) => [`Kill: ${lastKill.attacker} -> ${lastKill.victim}`, ...prev].slice(0, 50))
              }
            } catch { }
          }
        }

        // Process 'me' info for abilities, health, agent
        if (info.me) {
          if (info.me.abilities) {
            gameEvents.processAbilities(info.me.abilities)
          }
          if (info.me.health !== undefined) {
            gameEvents.processHealth(parseInt(info.me.health, 10) || 100)
          }
          if (info.me.agent) {
            gameEvents.processAgent(info.me.agent)
          }
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
      }
    }

    if (payload?.type === 'new_events') {
      const events = payload.data?.events || []
      for (const ev of events) {
        if (ev.name === 'kill' && autoSpeakOnKill) {
          queuePrompt('Suggest quick post-kill positioning and utility follow-up.')
        }
        // Shop open event - trigger buy advice removed per user request

      }
      // Update ult alerts after any event
      setAlerts(gameEvents.getUltAlerts())
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
    if (payload?.type === 'game_detected') {
      try { setScale(1); setTheme('dark') } catch { }
    }
  }, [autoSpeakOnKill, handleVoiceCommand, queuePrompt])

  useEffect(() => {
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
    const info = overlayInfo || {}
    const mi = info.match_info || {}
    const rosterKeys = Object.keys(mi).filter((k: string) => k.startsWith('roster_'))
    const roster = rosterKeys.map((k: string) => {
      try { const raw = mi[k]; return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
    }).filter(Boolean) as any[]
    const allies = roster.filter(r => r.teammate).map(r => getAgentName(r.character)).join(', ')
    const enemies = roster.filter(r => !r.teammate).map(r => getAgentName(r.character)).join(', ')
    const agent = getAgentName((info.me || {}).agent || 'unknown')
    const map = getMapName(mi.map || 'unknown')

    // Get full game context including team economy from game events tracker
    const gameContext = gameEvents.buildContextSummary()

    // Get enemy pattern analysis
    const patternSummary = predictionEngine.getPatternSummary()

    // Get ult alerts
    const ultAlerts = gameEvents.getUltAlerts()
    const ultAlertText = ultAlerts.length > 0
      ? ultAlerts.map(a => a.status === 'ready'
        ? `⚠️ ${a.agent} ULT READY`
        : `⚠️ ${a.agent} ult in ${a.orbsAway} orb${a.orbsAway > 1 ? 's' : ''}`
      ).join('\n')
      : ''

    // Add specific context about team composition balance
    const side = gameEvents.getState().team
    const sideContext = side !== 'unknown' ? `\n- Side: ${side.toUpperCase()}` : ''

    return `=== LIVE GAME STATE ===
${gameContext}

${patternSummary ? `=== ENEMY PATTERNS ===\n${patternSummary}\n` : ''}
${ultAlertText ? `=== ULT WARNINGS ===\n${ultAlertText}\n` : ''}
=== USER QUESTION ===
"${userText}"

=== INSTRUCTIONS ===
Provide tactical advice considering:
1. ECONOMY: Check team credits above. DO NOT suggest weapons players cannot afford.
2. ENEMY PATTERNS: Use pattern analysis if available to predict enemy behavior.
3. ULT WARNINGS: If enemy ults are ready/almost ready, factor into tactical advice.
4. MATCHUPS: Warn about specific enemy utility.
Be concise and actionable.`
  }

  const debugEntries = debugLog.length ? debugLog : ['No overlay events yet.']



  return (
    <>
      <InGameOverlay
        hotkey={hotkey}
        mode={responseMode}
        aiText={overlayAiQueue[0] || ''}
        gameData={gameEvents.getState() as any}
        hasGameContext={gameEvents.hasUsefulData()}
        listening={listening}
        thinking={thinking}
        audioLevels={audioData}
        settingsTrigger={settingsTrigger}
        settingsHotkey={settingsHotkey}
        alerts={alerts}
        showRoundEndPrompt={showRoundEndPrompt}
        onToggle={(next) => {
          if (!next) {
            try { voice.cancelListening() } catch { }
          }
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

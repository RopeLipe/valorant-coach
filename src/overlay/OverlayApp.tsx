import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InGameOverlay } from '@code/components/in-game-overlay'
import * as voice from '@/services/voice'
import * as geminiService from '@/services/geminiFileSearch'
import { RAG_CONFIG } from '../../config/ragConfig'
import { getAgentName } from '../utils/agentMapping'
import { getMapName } from '../utils/valorantMappings'

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
  const [settingsTrigger, setSettingsTrigger] = useState<number>(0)
  const [settingsHotkey, setSettingsHotkey] = useState<string>('Ctrl+Alt+S')
  const listeningRef = useRef(false)

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
    try {
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

      const options = {
        metadataFilter: filters.length > 0 ? filters.join(' OR ') : undefined
      }

      const res = await geminiService.fileSearch(storeIdRef.current || '', prompt, options)
      const text = (res.text || '').trim()
      if (responseMode !== 'speech') {
        setOverlayAiQueue(text ? [text] : [])
      } else {
        setOverlayAiQueue([])
      }
      if (responseMode !== 'text' && text) {
        try { voice.speak(text, { rate: voiceRate, volume: voiceVolume }) } catch { }
      }
    } catch { }
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
      if (!question) {
        return
      }
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
        // Debug: Log match_info keys to help diagnose missing data
        if (info.match_info) {
          const keys = Object.keys(info.match_info)
          // Only log if there are keys we haven't seen or just periodically? 
          // For now, just log it so user can see in debug panel.
          // Filter out common spammy keys if needed, but seeing all is good.
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
      }
    }
    if (payload?.type === 'new_events') {
      const events = payload.data?.events || []
      for (const ev of events) {
        if (ev.name === 'kill' && autoSpeakOnKill) {
          queuePrompt('Suggest quick post-kill positioning and utility follow-up.')
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
    if (payload?.type === 'game_detected') {
      try { setScale(1); setTheme('dark') } catch { }
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
    
    // Add specific context about team composition balance
    const allyRoles = allies.length ? `(Team: ${allies})` : ''
    const enemyRoles = enemies.length ? `(Opponents: ${enemies})` : ''
    
    return `Context:\n- My Agent: ${agent}\n- Map: ${map}\n- My Team: ${allies || 'unknown'}\n- Enemy Team: ${enemies || 'unknown'}\n\nUser Question: "${userText}"\n\nTask: Provide tactical advice considering the specific matchups. If enemies have specific utility (like Cypher trips or Breach stuns), warn me. If my team lacks specific roles (like Smokes), suggest how to adapt.`
  }

  const debugEntries = debugLog.length ? debugLog : ['No overlay events yet.']



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

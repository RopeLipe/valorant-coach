import React, { useEffect, useMemo, useRef, useState } from 'react'
import { InGameOverlay } from '@code/components/in-game-overlay'
import * as voice from '@/services/voice'
import * as geminiService from '@/services/geminiFileSearch'
import { RAG_CONFIG } from '../../config/ragConfig'

type ChatMessage = { role: 'user' | 'model'; parts: Array<{ text: string }> }

export default function OverlayApp() {
  const [overlayInfo, setOverlayInfo] = useState<any>({})
  const [overlayAiQueue, setOverlayAiQueue] = useState<string[]>([])
  const [debugLog, setDebugLog] = useState<string[]>([])
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
    try { storeIdRef.current = RAG_CONFIG.defaultStoreId } catch {}
    try { geminiService.initialize() } catch {}
  }, [])

  const parseValorantPayload = (raw: any) => {
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
  }

  const handleValorantPayload = (payload: any) => {
    if (!payload) return
    try {
      setDebugLog((arr) => [
        `${new Date().toLocaleTimeString()} ${payload?.type || 'unknown'}`,
        ...arr
      ].slice(0, 50))
    } catch {}
    if (payload?.type === 'info_update') {
      const info = payload.data?.info
      setOverlayInfo(info || {})
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
    if (payload?.type === 'toggle_settings') {
      try { setSettingsTrigger((n) => n + 1) } catch {}
    }
    if (payload?.type === 'hotkey_unassigned') {
      try { setSettingsTrigger((n) => n + 1) } catch {}
    }
    if (payload?.type === 'hotkey_changed') {
      const name = payload?.data?.name
      const binding = payload?.data?.binding
      if (name === 'voice_command' && binding) setHotkey(binding)
      if (name === 'toggle_settings' && binding) setSettingsHotkey(binding)
    }
    if (payload?.type === 'game_detected') {
      try { setScale(1); setTheme('dark') } catch {}
    }
  }

  useEffect(() => {
    const ow: any = (window as any).overwolf
    const onOwMessage = (event: any) => {
      try {
        const payload = parseValorantPayload(event)
        if (payload) handleValorantPayload(payload)
      } catch {}
    }
    const onWindowMessage = (event: MessageEvent) => {
      try {
        const payload = parseValorantPayload(event.data)
        if (payload) handleValorantPayload(payload)
      } catch {}
    }
    try { ow?.windows?.onMessageReceived?.addListener(onOwMessage) } catch {}
    try { window.addEventListener('message', onWindowMessage) } catch {}
    return () => {
      try { ow?.windows?.onMessageReceived?.removeListener(onOwMessage) } catch {}
      try { window.removeEventListener('message', onWindowMessage) } catch {}
    }
  }, [autoSpeakOnKill])

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
        } catch {}
      })
    } catch {}
  }, [])

  const buildCompositePrompt = (userText: string) => {
    const info = overlayInfo || {}
    const mi = info.match_info || {}
    const rosterKeys = Object.keys(mi).filter((k: string) => k.startsWith('roster_'))
    const roster = rosterKeys.map((k: string) => {
      try { const raw = mi[k]; return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
    }).filter(Boolean) as any[]
    const allies = roster.filter(r => r.teammate).map(r => r.character).join(', ')
    const enemies = roster.filter(r => !r.teammate).map(r => r.character).join(', ')
    const agent = (info.me || {}).agent || 'unknown'
    const map = mi.map || 'unknown'
    return `${userText}\nAgent: ${agent}\nAllies: ${allies || 'unknown'}\nEnemies: ${enemies || 'unknown'}\nMap: ${map}`
  }

  const queuePrompt = async (hint: string) => {
    try {
      const prompt = buildCompositePrompt(hint)
      const res = await geminiService.fileSearch(storeIdRef.current || '', prompt)
      const text = (res.text || '').trim()
      if (responseMode !== 'speech') {
        setOverlayAiQueue([text])
      } else {
        setOverlayAiQueue([])
      }
      if (responseMode !== 'text') {
        try { voice.speak(text, { rate: voiceRate, volume: voiceVolume }) } catch {}
      }
    } catch {}
  }

  const onAskAi = (text: string) => queuePrompt(text)

  const handleVoiceCommand = async () => {
    if (listeningRef.current) return
    listeningRef.current = true
    setListening(true)
    try {
      const result = await voice.startListening({
        maxDurationMs: 8000,
        preSpeechTimeoutMs: 1400,
        silenceAfterSpeechMs: 600,
        energyThreshold: 0.015
      })
      const question = result.text.trim()
      if (!question) {
        return
      }
      await queuePrompt(question)
    } catch (err: any) {
      const code = err?.code
      if (code === 'cancelled' || code === 'already_listening') {
        return
      }
      if (code === 'permission_denied' || code === 'device_missing') {
        try {
          setOverlayAiQueue(["Voice input not available. Open Overwolf Hotkeys to configure or use text mode."])
          setSettingsTrigger((n) => n + 1)
          const ow: any = (window as any).overwolf
          ow?.utils?.openUrl?.('overwolf://settings/games-overlay?hotkey=voice_command&gameId=21640')
        } catch {}
        return
      }
      setOverlayAiQueue(["I couldn't catch that. Release and try again, or use text mode if the issue persists."])
    } finally {
      listeningRef.current = false
      setListening(false)
    }
  }

  return (
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
          try { voice.cancelListening() } catch {}
        }
      }}
    />
  )
}

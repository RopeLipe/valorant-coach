import { useCallback, useEffect, useMemo, useState } from "react"

interface MicrophoneDevice {
  deviceId: string
  label: string
}

interface HotkeyState {
  voice_command?: string
  toggle_settings?: string
}

const VALORANT_GAME_ID = 21640

const HOTKEY_TARGETS: Array<{ name: keyof HotkeyState; label: string; description: string }> = [
  { name: "voice_command", label: "Talk to Coach", description: "Hotkey used to start a voice prompt." },
  { name: "toggle_settings", label: "Open Settings", description: "Hotkey that opens this desktop panel." }
]

function formatHotkeyDisplay(binding?: string) {
  if (!binding) return "Not bound"
  return binding.replace(/\+/g, " + ")
}

type CapturedHotkey = {
  binding: string
  virtualKey: number
  modifiers: { ctrl: boolean; alt: boolean; shift: boolean }
}

const SPECIAL_VIRTUAL_KEYS: Record<string, { label: string; code: number }> = {
  Enter: { label: "Enter", code: 13 },
  Escape: { label: "Esc", code: 27 },
  Backspace: { label: "Backspace", code: 8 },
  Tab: { label: "Tab", code: 9 },
  Space: { label: "Space", code: 32 },
  ArrowUp: { label: "ArrowUp", code: 38 },
  ArrowDown: { label: "ArrowDown", code: 40 },
  ArrowLeft: { label: "ArrowLeft", code: 37 },
  ArrowRight: { label: "ArrowRight", code: 39 },
  Delete: { label: "Delete", code: 46 },
  Insert: { label: "Insert", code: 45 },
  Home: { label: "Home", code: 36 },
  End: { label: "End", code: 35 },
  PageUp: { label: "PageUp", code: 33 },
  PageDown: { label: "PageDown", code: 34 },
}

function normalizeKey(key?: string | null) {
  if (!key) return ""
  if (key === " ") return "Space"
  if (key === "Spacebar") return "Space"
  return key
}

function keyToVirtualKey(e: KeyboardEvent): { label: string; code: number } | null {
  const rawKey = normalizeKey(e.key)
  if (!rawKey) return null
  if (SPECIAL_VIRTUAL_KEYS[rawKey]) {
    return SPECIAL_VIRTUAL_KEYS[rawKey]
  }
  if (/^F\d{1,2}$/i.test(rawKey)) {
    const num = Number(rawKey.replace(/[^\d]/g, ""))
    if (num >= 1 && num <= 24) {
      return { label: rawKey.toUpperCase(), code: 111 + num }
    }
  }
  if (rawKey.length === 1) {
    const upper = rawKey.toUpperCase()
    if (/^[A-Z0-9]$/.test(upper)) {
      return { label: upper, code: upper.charCodeAt(0) }
    }
  }
  return null
}

function captureToBinding(e: KeyboardEvent): CapturedHotkey | null {
  if (e.metaKey) {
    return null
  }
  const vk = keyToVirtualKey(e)
  if (!vk) return null
  const parts: string[] = []
  const modifiers = { ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey }
  if (modifiers.ctrl) parts.push("Ctrl")
  if (modifiers.alt) parts.push("Alt")
  if (modifiers.shift) parts.push("Shift")
  parts.push(vk.label)
  return {
    binding: parts.join("+"),
    virtualKey: vk.code,
    modifiers,
  }
}

function notifyHotkeyChange(name: keyof HotkeyState, binding: string) {
  try {
    const ow: any = (window as any).overwolf
    const payload = { source: 'valorant', payload: { type: 'hotkey_changed', data: { name, binding } } }
    ow?.windows?.obtainDeclaredWindow?.('main', (res: any) => {
      try {
        if (res?.success && res.window?.id) {
          ow.windows.sendMessage(res.window.id, 'valorant-event', payload, () => {})
        }
      } catch {}
    })
  } catch {}
}

export default function DesktopSettingsPanel() {
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([])
  const [micStatus, setMicStatus] = useState<string>("")
  const [selectedMic, setSelectedMic] = useState<string | null>(null)
  const [hotkeys, setHotkeys] = useState<HotkeyState>({})
  const [captureTarget, setCaptureTarget] = useState<keyof HotkeyState | null>(null)
  const [capturePrompt, setCapturePrompt] = useState<string | null>(null)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)

  const preferredMicStorageKey = "coach_preferred_mic_id"

  useEffect(() => {
    try {
      const stored = localStorage.getItem(preferredMicStorageKey)
      if (stored) setSelectedMic(stored)
    } catch {}
  }, [])

  const evaluatePermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      setMicPermission('unknown')
      return
    }
    try {
      setIsCheckingPermission(true)
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      const nextState = status.state === 'denied' ? 'denied' : status.state === 'granted' ? 'granted' : 'unknown'
      setMicPermission(nextState)
      status.onchange = () => {
        const derived = status.state === 'denied' ? 'denied' : status.state === 'granted' ? 'granted' : 'unknown'
        setMicPermission(derived)
      }
    } catch {
      setMicPermission('unknown')
    } finally {
      setIsCheckingPermission(false)
    }
  }, [])

  const refreshMics = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setMicStatus("Microphone enumeration is not supported in this environment.")
      return
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((d) => d.kind === "audioinput").map((d) => ({
        deviceId: d.deviceId,
        label: d.label || "Microphone"
      }))
      setMicrophones(inputs)
      if (!inputs.length) {
        setMicStatus("No microphones detected. Grant permission or plug in a device.")
      } else {
        setMicStatus(`Found ${inputs.length} microphone${inputs.length === 1 ? "" : "s"}.`)
        if (selectedMic && !inputs.find((mic) => mic.deviceId === selectedMic)) {
          setSelectedMic(null)
          try { localStorage.removeItem(preferredMicStorageKey) } catch {}
          setMicStatus("Saved microphone missing. Reverting to Windows default.")
        }
      }
    } catch (err) {
      console.error("Failed to enumerate microphones", err)
      setMicStatus("Unable to list microphones. Please grant microphone permission.")
      if ((err as any)?.name === 'NotAllowedError') {
        setMicPermission('denied')
      }
    }
  }, [preferredMicStorageKey, selectedMic])

  const requestMicPermission = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicStatus("Microphone APIs unavailable inside this preview build.")
      return
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await refreshMics()
      setMicStatus("Permission granted. Select your preferred microphone below.")
      setMicPermission('granted')
    } catch (err) {
      console.error("Mic permission error", err)
      setMicStatus("Microphone permission denied. Allow access in Windows privacy settings.")
      setMicPermission('denied')
    }
  }

  useEffect(() => {
    evaluatePermission()
    refreshMics()
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return
    const handler = () => refreshMics()
    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
    }
  }, [evaluatePermission, refreshMics])

  const handleMicChange = (id: string) => {
    setSelectedMic(id)
    try {
      localStorage.setItem(preferredMicStorageKey, id)
      setMicStatus("Saved preferred microphone for voice prompts.")
    } catch {}
  }

  const loadHotkeys = () => {
    try {
      const ow: any = (window as any).overwolf
      ow?.settings?.hotkeys?.get?.((res: any) => {
        try {
          if (!res?.success) return
          const map: HotkeyState = {}
          const list: any[] = Array.isArray(res.hotkeys)
            ? res.hotkeys
            : [
                ...(Array.isArray(res.globals) ? res.globals : []),
                ...(Array.isArray(res.games?.[VALORANT_GAME_ID]) ? res.games[VALORANT_GAME_ID] : []),
              ]
          for (const hk of list) {
            const binding = hk?.binding || hk?.hotkey
            if (!binding) continue
            if (hk?.name === "voice_command") map.voice_command = binding
            if (hk?.name === "toggle_settings") map.toggle_settings = binding
          }
          setHotkeys(map)
        } catch {}
      })
    } catch {}
  }

  useEffect(() => {
    loadHotkeys()
  }, [])

  useEffect(() => {
    if (!captureTarget) return

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.metaKey) {
        setHotkeyError("Windows key is not supported for Overwolf hotkeys.")
        return
      }
      const combo = captureToBinding(e)
      if (!combo) {
        setHotkeyError("Key not supported. Use letters, numbers, arrows, or function keys with Ctrl/Alt/Shift if needed.")
        return
      }
      setHotkeyError(null)
      assignHotkey(captureTarget, combo)
      setCaptureTarget(null)
      setCapturePrompt(null)
    }

    window.addEventListener("keydown", onKeyDown, true)
    setCapturePrompt("Press the new hotkey (press Esc to cancel)")

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCaptureTarget(null)
        setCapturePrompt(null)
      }
    }

    window.addEventListener("keyup", onKeyUp, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keyup", onKeyUp, true)
      setCapturePrompt(null)
    }
  }, [captureTarget])

  const assignHotkey = (name: keyof HotkeyState, combo: CapturedHotkey) => {
    try {
      const ow: any = (window as any).overwolf
      if (!ow?.settings?.hotkeys?.assign) {
        setHotkeyError("Hotkey assignment is only available inside the Overwolf runtime.")
        return
      }
      const payload = {
        name,
        gameId: VALORANT_GAME_ID,
        virtualKey: combo.virtualKey,
        modifiers: combo.modifiers,
      }
      ow.settings.hotkeys.assign(payload, (res: any) => {
        if (res?.status === "success" || res?.success) {
          setHotkeys((prev) => ({ ...prev, [name]: combo.binding }))
          setHotkeyError(null)
          notifyHotkeyChange(name, combo.binding)
          loadHotkeys()
        } else {
          const reason = res?.reason || res?.error || "Hotkey assignment failed"
          setHotkeyError(reason)
        }
      })
    } catch (err) {
      console.error("assignHotkey", err)
      setHotkeyError("Unexpected error while assigning hotkey.")
    }
  }

  const activeMicLabel = useMemo(() => {
    if (!selectedMic) return "System default"
    return microphones.find((m) => m.deviceId === selectedMic)?.label || "Custom device"
  }, [selectedMic, microphones])

  return (
    <aside className="w-full max-w-sm border-l border-white/5 bg-black/40 text-white flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-lg font-semibold">Desktop Settings</h2>
        <p className="text-xs text-white/70 mt-1">Manage microphones, hotkeys, and runtime preferences while you are out of game.</p>
      </div>

      <div className="flex-1 overflow-auto space-y-6 px-5 py-4">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Microphone Source</h3>
            <button className="text-xs text-white/70 hover:text-white" onClick={refreshMics}>Refresh</button>
          </div>
          <p className="text-xs text-white/60 mt-1">Pick which microphone feeds voice prompts. This selection is shared with the in-game overlay.</p>
          <div className="mt-2 text-xs text-white/60">
            Permission status: {isCheckingPermission ? 'Checking…' : micPermission === 'granted' ? 'Granted' : micPermission === 'denied' ? 'Denied via Windows/Overwolf' : 'Unknown'}
          </div>
          <select
            className="w-full mt-3 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            value={selectedMic || ""}
            onChange={(e) => handleMicChange(e.target.value)}
          >
            <option value="">Use Windows default</option>
            {microphones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>{mic.label || 'Microphone'}</option>
            ))}
          </select>
          <div className="mt-2 text-xs text-white/70">Current: {activeMicLabel}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
            <button className="px-3 py-1 rounded-full border border-white/20 hover:bg-white/10" onClick={requestMicPermission}>Grant Permission</button>
            <span>{micStatus}</span>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hotkeys</h3>
            {capturePrompt && <span className="text-xs text-amber-300">{capturePrompt}</span>}
          </div>
          <div className="space-y-4 mt-3">
            {HOTKEY_TARGETS.map(({ name, label, description }) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">{label}</div>
                <div className="mt-1 text-sm font-semibold">{formatHotkeyDisplay(hotkeys[name])}</div>
                <p className="text-xs text-white/50 mt-1">{description}</p>
                <button
                  className="mt-3 px-3 py-1.5 rounded-full border border-white/30 text-xs hover:bg-white/10"
                  onClick={() => {
                    setHotkeyError(null)
                    setCaptureTarget(name)
                  }}
                >
                  {captureTarget === name ? 'Press combo…' : 'Change hotkey'}
                </button>
              </div>
            ))}
          </div>
          {hotkeyError && <div className="mt-2 text-xs text-red-300">{hotkeyError}</div>}
        </section>

        <section>
          <h3 className="text-sm font-semibold">Need to adjust more?</h3>
          <p className="text-xs text-white/60 mt-1">Use the Overwolf settings window if you want to tweak streaming, audio routing, or enable push-to-talk at the OS level.</p>
          <button
            className="mt-3 px-3 py-1.5 rounded-full border border-white/30 text-xs hover:bg-white/10"
            onClick={() => {
              try {
                const ow: any = (window as any).overwolf
                ow?.utils?.openUrl?.('overwolf://settings/audio')
              } catch {}
            }}
          >
            Open Overwolf Audio Settings
          </button>
        </section>
      </div>
    </aside>
  )
}

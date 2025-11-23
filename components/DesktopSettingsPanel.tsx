import { useCallback, useEffect, useMemo, useState } from "react"
import DiagnosticsChecklist from "./DiagnosticsChecklist"
import type { DiagnosticResult } from "../services/diagnostics"
import { X, Mic, Keyboard, Settings, Clock } from "lucide-react"

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
          ow.windows.sendMessage(res.window.id, 'valorant-event', payload, () => { })
        }
      } catch { }
    })
  } catch { }
}

interface DesktopSettingsPanelProps {
  diagnostics: DiagnosticResult[]
  diagnosticsRunning: boolean
  onRunDiagnostics: () => Promise<void> | void
}

export default function DesktopSettingsPanel({
  diagnostics,
  diagnosticsRunning,
  onRunDiagnostics
}: DesktopSettingsPanelProps) {
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([])
  const [micStatus, setMicStatus] = useState<string>("")
  const [selectedMic, setSelectedMic] = useState<string | null>(null)
  const [hotkeys, setHotkeys] = useState<HotkeyState>({})
  const [captureTarget, setCaptureTarget] = useState<keyof HotkeyState | null>(null)
  const [capturePrompt, setCapturePrompt] = useState<string | null>(null)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [messageDuration, setMessageDuration] = useState<number>(6000)
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)

  const preferredMicStorageKey = "coach_preferred_mic_id"
  const messageDurationKey = "coach_message_duration"

  useEffect(() => {
    try {
      const storedMic = localStorage.getItem(preferredMicStorageKey)
      if (storedMic) setSelectedMic(storedMic)

      const storedDuration = localStorage.getItem(messageDurationKey)
      if (storedDuration) {
        const val = parseInt(storedDuration, 10)
        if (!isNaN(val) && val >= 3000 && val <= 15000) {
          setMessageDuration(val)
        }
      }
    } catch { }
  }, [])

  const handleDurationChange = (val: number) => {
    setMessageDuration(val)
    try {
      localStorage.setItem(messageDurationKey, val.toString())
    } catch { }
  }

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
          try { localStorage.removeItem(preferredMicStorageKey) } catch { }
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
    } catch { }
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
        } catch { }
      })
    } catch { }
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
    <div className="w-[600px] max-h-[85vh] flex flex-col glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0F1115]/95">
      <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
            <Settings className="w-6 h-6 text-white/80" />
            Settings
          </h2>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">Configuration & Diagnostics</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">


        {/* Microphone Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Mic className="w-4 h-4 text-white/60" />
              Microphone Source
            </h3>
            <button
              className="text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
              onClick={refreshMics}
            >
              Refresh Devices
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="mb-4">
              <label className="text-xs text-white/60 font-medium mb-2 block">Select Input Device</label>
              <select
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                value={selectedMic || ""}
                onChange={(e) => handleMicChange(e.target.value)}
              >
                <option value="">Use Windows Default</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>{mic.label || 'Microphone'}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/40">Status:</span>
                <span className={`font-bold ${micPermission === 'granted' ? 'text-white' : 'text-white/60'}`}>
                  {isCheckingPermission ? 'Checking...' : micPermission === 'granted' ? 'Active' : 'Permission Needed'}
                </span>
              </div>
              {micPermission !== 'granted' && (
                <button
                  className="px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                  onClick={requestMicPermission}
                >
                  Grant Permission
                </button>
              )}
            </div>
            {micStatus && <div className="mt-3 text-[10px] text-white/30 border-t border-white/5 pt-2">{micStatus}</div>}
          </div>
        </section>

        {/* Hotkeys Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-white/60" />
              Hotkeys
            </h3>
            {capturePrompt && <span className="text-xs font-bold text-white animate-pulse">{capturePrompt}</span>}
          </div>

          <div className="grid gap-3">
            {HOTKEY_TARGETS.map(({ name, label, description }) => (
              <div key={name} className="group flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 transition-all">
                <div>
                  <div className="text-sm font-bold text-white">{label}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{description}</div>
                </div>
                <button
                  className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${captureTarget === name
                    ? "bg-white text-black scale-105"
                    : "bg-black/40 text-white border border-white/10 hover:border-white/30"
                    }`}
                  onClick={() => {
                    setHotkeyError(null)
                    setCaptureTarget(name)
                  }}
                >
                  {captureTarget === name ? 'PRESS KEY...' : formatHotkeyDisplay(hotkeys[name])}
                </button>
              </div>
            ))}
          </div>
          {hotkeyError && <div className="mt-3 text-xs text-white/60 bg-white/5 p-2 rounded border border-white/10">{hotkeyError}</div>}
        </section>

        {/* Preferences Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/60" />
              Preferences
            </h3>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60 font-medium">Message Display Time</label>
              <span className="text-xs font-bold text-white">{messageDuration / 1000}s</span>
            </div>
            <input
              type="range"
              min="3000"
              max="15000"
              step="1000"
              value={messageDuration}
              onChange={(e) => handleDurationChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <p className="text-[10px] text-white/30 mt-2">
              How long AI responses and errors stay on screen before fading out.
            </p>
          </div>
        </section>

        {/* Advanced Section */}
        <section className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Advanced Audio</h3>
              <p className="text-xs text-white/40 mt-1">Configure output devices and system-level settings.</p>
            </div>
            <button
              className="px-4 py-2 rounded-lg border border-white/10 text-xs font-bold text-white hover:bg-white/5 transition-colors"
              onClick={() => {
                try {
                  const ow: any = (window as any).overwolf
                  ow?.utils?.openUrl?.('overwolf://settings/audio')
                } catch { }
              }}
            >
              Open Overwolf Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

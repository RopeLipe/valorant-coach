"use client"

import { useState, useEffect } from "react"
import { Mic } from "lucide-react"
import { ScrollArea } from "@ui/scroll-area"
import { Slider } from "@ui/slider"

export function InGameOverlay({ listening=false, onToggle, hotkey, mode='both', aiText='', onModeChange, voiceVolume=1, voiceRate=1, onVoiceVolumeChange, onVoiceRateChange, autoSpeakOnKill=true, onAutoSpeakOnKillChange, gameData, settingsTrigger=0, settingsHotkey, debugLog=[] }: { listening?: boolean; onToggle?: (next: boolean) => void; hotkey?: string; mode?: 'speech' | 'text' | 'both'; aiText?: string; onModeChange?: (m: 'speech' | 'text' | 'both') => void; voiceVolume?: number; voiceRate?: number; onVoiceVolumeChange?: (v: number) => void; onVoiceRateChange?: (v: number) => void; autoSpeakOnKill?: boolean; onAutoSpeakOnKillChange?: (v: boolean) => void; gameData?: { map: string; agent: string; allies: string[]; enemies: string[] }; settingsTrigger?: number; settingsHotkey?: string; debugLog?: string[] }) {
  const [isListening, setIsListening] = useState(listening)
  const [currentTip, setCurrentTip] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelType, setPanelType] = useState<'settings' | 'answer' | 'debug' | null>(null)

  const suggestions = [
    "Ask about enemy positions",
    "Request ability combos",
    "Get site execute tips",
    "Learn optimal crosshair placement",
    "Need help with agent selection?",
    "Want to know the best gun for this round?",
  ]

  useEffect(() => {
    if ((mode === 'text' || mode === 'both') && aiText && aiText.trim()) {
      setPanelType('answer')
      setPanelOpen(true)
    }
  }, [aiText, mode])

  useEffect(() => {
    if (settingsTrigger > 0) {
      setPanelType('settings')
      setPanelOpen(true)
    }
  }, [settingsTrigger])

  useEffect(() => { setIsListening(listening) }, [listening])

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true)
      setTimeout(() => {
        setCurrentTip((prev) => (prev + 1) % suggestions.length)
        setIsFading(false)
      }, 300)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const hasAnswer = mode !== 'speech' && !!aiText?.trim()
  const showCard = hasAnswer || isListening || panelOpen
  const isSettingsView = panelOpen && panelType === 'settings'
  const isDebugView = panelOpen && panelType === 'debug'
  const isAnswerView = panelOpen && panelType === 'answer'

  const closePanel = () => {
    setPanelOpen(false)
    setPanelType(null)
  }

  const primaryTitle = (() => {
    if (isSettingsView) return 'Overlay Settings'
    if (isDebugView) return 'Debug Console'
    if (hasAnswer || isAnswerView) return 'Valorant Coach'
    if (isListening) return 'Listening…'
    return 'Voice Command'
  })()

  const primarySubtitle = (() => {
    if (isSettingsView) return 'Choose speech, text, or both and fine-tune audio playback.'
    if (isDebugView) return 'Latest overlay events and telemetry.'
    if (hasAnswer || isAnswerView) return 'Fresh tactical insight tailored to your current match.'
    if (isListening) return 'Stay still for a moment while I capture your question.'
    return `Press ${hotkey || 'Ctrl+Alt+C'} to speak • Settings: ${settingsHotkey || 'Ctrl+Alt+S'}`
  })()

  const renderPanelContent = () => {
    if (isSettingsView) {
      return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">Response Mode</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['speech', 'text', 'both'] as const).map((m) => (
                <button
                  key={m}
                  className={`px-3 py-2 rounded-xl text-[11px] font-semibold transition ${
                    mode === m ? 'bg-white text-black shadow' : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                  onClick={() => onModeChange?.(m)}
                >
                  {m === 'speech' ? 'Voice' : m === 'text' ? 'Text' : 'Hybrid'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/60 mt-2">Decide how the coach answers when you hit your talk-to-AI key.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">Voice Volume</div>
              <Slider value={[Math.round((voiceVolume ?? 1) * 100)]} min={0} max={100} onValueChange={(vals: number[]) => onVoiceVolumeChange?.((vals?.[0] || 0) / 100)} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">Voice Speed</div>
              <Slider value={[Math.round((voiceRate ?? 1) * 100)]} min={50} max={150} onValueChange={(vals: number[]) => onVoiceRateChange?.((vals?.[0] || 100) / 100)} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] text-white/80">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-white" checked={autoSpeakOnKill} onChange={(e) => onAutoSpeakOnKillChange?.(e.target.checked)} />
              Auto speak after kills
            </label>
            <button className="px-3 py-1.5 rounded-full text-[11px] bg-white text-black font-semibold" onClick={closePanel}>Done</button>
          </div>
        </div>
      )
    }

    if (isDebugView) {
      return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <ScrollArea className="max-h-40">
            <div className="text-[11px] text-white/70 space-y-1 leading-relaxed">
              {debugLog.length === 0 && <p className="text-white/40">No events captured yet.</p>}
              {debugLog.map((line, idx) => (
                <p key={idx} className="whitespace-pre-wrap">{line}</p>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end mt-3">
            <button className="px-3 py-1.5 rounded-full text-[11px] bg-white text-black font-semibold" onClick={closePanel}>Close</button>
          </div>
        </div>
      )
    }

    if (isAnswerView && hasAnswer) {
      return (
        <div className="space-y-3">
          <div className="text-[11px] text-white/70">Map: <span className="text-white">{gameData?.map || 'unknown'}</span> • Agent: <span className="text-white">{gameData?.agent || 'unknown'}</span></div>
          <div className="text-[11px] text-white/60">Allies: <span className="text-white/80">{(gameData?.allies || []).join(', ') || 'unknown'}</span></div>
          <div className="text-[11px] text-white/60">Enemies: <span className="text-white/80">{(gameData?.enemies || []).join(', ') || 'unknown'}</span></div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-h-40">
            <ScrollArea className="max-h-32">
              <div className="text-sm text-white/90 whitespace-pre-wrap leading-snug">
                {aiText}
              </div>
            </ScrollArea>
          </div>
          <div className="flex justify-end">
            <button className="px-3 py-1.5 rounded-full text-[11px] bg-white text-black font-semibold" onClick={closePanel}>Close</button>
          </div>
        </div>
      )
    }

    if (hasAnswer) {
      return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-h-40">
          <ScrollArea className="max-h-32">
            <div className="text-sm text-white/90 whitespace-pre-wrap leading-snug">
              {aiText}
            </div>
          </ScrollArea>
        </div>
      )
    }

    if (isListening) {
      return (
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center justify-center gap-1 h-10">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-white rounded-full animate-pulse transition-all"
                style={{
                  height: `${15 + Math.random() * 25}px`,
                  animationDelay: `${i * 80}ms`,
                  animationDuration: "0.6s",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => { setIsListening(false); onToggle?.(false) }}
            className="flex-shrink-0 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/50 text-[10px] font-semibold uppercase tracking-widest text-white"
          >
            Stop
          </button>
        </div>
      )
    }

    return (
      <div className="text-[11px] text-white/70">{suggestions[currentTip]}</div>
    )
  }

  return (
    <div className="relative pointer-events-none">
      <div className="absolute top-4 right-4 animate-fade-in pointer-events-auto">
        <div
          className={`backdrop-blur-md bg-black/90 transition-all duration-300 ease-out ${
            showCard
              ? 'rounded-3xl w-[360px] border border-white/30 shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
              : 'rounded-full border border-white/40 hover:border-white/60'
          } ${isListening ? 'border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]' : ''}`}
        >
          <div className={`px-5 py-4 ${showCard ? 'space-y-4' : ''}`}>
            {!showCard ? (
              <div className="flex items-center gap-5">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div
                    className={`text-sm text-white font-medium whitespace-nowrap transition-all duration-300 ease-out mx-0 px-0 my-0.5 ${
                      isFading ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
                    }`}
                  >
                    {mode !== 'speech' && aiText ? aiText : suggestions[currentTip]}
                  </div>
                  <div className="text-[10px] text-white/50 mt-0.5 tracking-wide">Press {hotkey || 'Ctrl+Alt+C'} to Speak to Me</div>
                </div>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center pointer-events-none">
                  <Mic className="w-5 h-5 text-black" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white/90">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold leading-snug">{primaryTitle}</div>
                    <div className="text-[11px] text-white/60 mt-0.5 leading-relaxed">{primarySubtitle}</div>
                  </div>
                  {panelOpen ? (
                    <button
                      onClick={closePanel}
                      className="px-3 py-1 rounded-full text-[11px] bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
                {renderPanelContent()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

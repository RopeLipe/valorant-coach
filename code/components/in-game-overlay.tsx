"use client"

import { useState, useEffect, useRef } from "react"
import { Mic } from "lucide-react"
import { Collapsible, CollapsibleContent } from "@ui/collapsible"
import { ScrollArea } from "@ui/scroll-area"
import { Slider } from "@ui/slider"

export function InGameOverlay({ listening=false, onToggle, hotkey, mode='both', aiText='', onModeChange, voiceVolume=1, voiceRate=1, onVoiceVolumeChange, onVoiceRateChange, autoSpeakOnKill=true, onAutoSpeakOnKillChange, gameData, settingsTrigger=0, settingsHotkey, debugLog=[] }: { listening?: boolean; onToggle?: (next: boolean) => void; hotkey?: string; mode?: 'speech' | 'text' | 'both'; aiText?: string; onModeChange?: (m: 'speech' | 'text' | 'both') => void; voiceVolume?: number; voiceRate?: number; onVoiceVolumeChange?: (v: number) => void; onVoiceRateChange?: (v: number) => void; autoSpeakOnKill?: boolean; onAutoSpeakOnKillChange?: (v: boolean) => void; gameData?: { map: string; agent: string; allies: string[]; enemies: string[] }; settingsTrigger?: number; settingsHotkey?: string; debugLog?: string[] }) {
  const [isListening, setIsListening] = useState(listening)
  const [currentTip, setCurrentTip] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const textRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
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
    if (measureRef.current && !isListening) {
      const width = measureRef.current.offsetWidth
      setMeasuredWidth(width)
    }
  }, [currentTip, isListening, aiText, mode])

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

  return (
    <div className="relative pointer-events-none">
      <div className="absolute opacity-0 pointer-events-none">
        <div ref={measureRef} className="px-6 py-4 inline-flex">
          <div className="flex items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium whitespace-nowrap">{mode !== 'speech' && aiText ? aiText : suggestions[currentTip]}</div>
              <div className="text-[10px] text-white/50 mt-0.5 tracking-wide">Press {hotkey || 'Ctrl+Alt+C'} to Speak to Me</div>
              <div className="mt-1 flex items-center gap-1">
                <button
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/70 hover:bg-white/10 hover:text-white pointer-events-auto"
                  onClick={() => { setPanelType('settings'); setPanelOpen(true) }}
                >Settings</button>
                <button
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/70 hover:bg-white/10 hover:text-white pointer-events-auto"
                  onClick={() => { setPanelType('debug'); setPanelOpen(true) }}
                >Debug</button>
              </div>
            </div>
            <div className="w-10 h-10" />
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 animate-fade-in pointer-events-auto">
        <div
          ref={containerRef}
          className={`backdrop-blur-md bg-black/90 rounded-full transition-all duration-500 ease-out ${
            isListening
              ? "border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              : "border border-white/40 hover:border-white/60"
          }`}
          style={!isListening ? { width: `${measuredWidth}px` } : { width: "320px" }}
        >
          {/* Content Area */}
          <div className="px-6 py-4">
            {!isListening ? (
              <div className="flex items-center gap-5">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div
                    ref={textRef}
                    className={`text-sm text-white font-medium whitespace-nowrap transition-all duration-300 ease-out mx-0 px-0 my-0.5 ${
                      isFading ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
                    }`}
                  >
                    {mode !== 'speech' && aiText ? aiText : suggestions[currentTip]}
                  </div>
                  <div className="text-[10px] text-white/50 mt-0.5 tracking-wide">Press {hotkey || 'Ctrl+Alt+C'} to Speak to Me</div>
                  <div className="mt-1" />
                </div>
                
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center pointer-events-none">
                  <Mic className="w-5 h-5 text-black" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {/* Waveform visualization */}
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

                {/* Stop button */}
                <button
                  onClick={() => { setIsListening(false); onToggle?.(false) }}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/40 flex items-center justify-center transition-all text-[9px] font-bold text-white tracking-widest"
                >
                  STOP
                </button>
              </div>
            )}
          </div>

          {/* Bottom accent line */}
          {isListening && (
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white to-transparent animate-pulse" />
          )}
          <Collapsible open={panelOpen}>
            <CollapsibleContent
              className={`overflow-hidden transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95`}
              style={!isListening ? { width: `${measuredWidth}px` } : { width: "320px" }}
            >
              <div className="rounded-b-2xl border-t border-white/20 bg-black/80 backdrop-blur-md">
                {panelType === 'settings' && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="text-xs font-semibold text-white/80">Response Mode</div>
                    <div className="flex items-center gap-2">
                      <button className={`px-2 py-1 rounded-full text-[11px] ${mode === 'speech' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70'}`} onClick={() => onModeChange?.('speech')}>Speech</button>
                      <button className={`px-2 py-1 rounded-full text-[11px] ${mode === 'text' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70'}`} onClick={() => onModeChange?.('text')}>Text</button>
                      <button className={`px-2 py-1 rounded-full text-[11px] ${mode === 'both' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70'}`} onClick={() => onModeChange?.('both')}>Both</button>
                    </div>
                    <div className="text-xs font-semibold text-white/80">Voice</div>
                    <div className="space-y-2">
                      <div className="text-[10px] text-white/60">Volume</div>
                      <Slider value={[Math.round((voiceVolume ?? 1) * 100)]} min={0} max={100} onValueChange={(vals: number[]) => onVoiceVolumeChange?.((vals?.[0] || 0) / 100)} />
                      <div className="text-[10px] text-white/60">Rate</div>
                      <Slider value={[Math.round((voiceRate ?? 1) * 100)]} min={50} max={150} onValueChange={(vals: number[]) => onVoiceRateChange?.((vals?.[0] || 100) / 100)} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <label className="text-[12px] text-white/80 flex items-center gap-2">
                        <input type="checkbox" className="accent-white" checked={autoSpeakOnKill} onChange={(e) => onAutoSpeakOnKillChange?.(e.target.checked)} />
                        Auto speak after kills
                      </label>
                      <button className="px-3 py-1.5 rounded-full text-[11px] bg-white text-black font-semibold" onClick={() => setPanelOpen(false)}>Save</button>
                    </div>
                  </div>
                )}
                {panelType === 'answer' && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/70">Map: <span className="text-white">{gameData?.map || 'unknown'}</span> • Agent: <span className="text-white">{gameData?.agent || 'unknown'}</span></div>
                      <button className="px-2 py-1 rounded-full text-[11px] bg-white text-black font-semibold" onClick={() => { setPanelOpen(false); setPanelType(null) }}>Close</button>
                    </div>
                    <div className="text-[11px] text-white/60">Allies: <span className="text-white/80">{(gameData?.allies || []).join(', ') || 'unknown'}</span></div>
                    <div className="text-[11px] text-white/60">Enemies: <span className="text-white/80">{(gameData?.enemies || []).join(', ') || 'unknown'}</span></div>
                    <ScrollArea className="max-h-40">
                      <div className="text-sm text-white leading-snug whitespace-pre-wrap">
                        {aiText}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                {panelType === 'debug' && (
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/70">Debug Log</div>
                      <button className="px-2 py-1 rounded-full text-[11px] bg-white text-black font-semibold" onClick={() => { setPanelOpen(false); setPanelType(null) }}>Close</button>
                    </div>
                    <ScrollArea className="max-h-40">
                      <div className="text-[11px] text-white/70 space-y-1">
                        {debugLog.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}

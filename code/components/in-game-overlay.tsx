"use client"

import { useState, useEffect } from "react"
import { Mic } from "lucide-react"
import { ScrollArea } from "@ui/scroll-area"

type OverlayProps = {
  listening?: boolean
  onToggle?: (next: boolean) => void
  hotkey?: string
  mode?: 'speech' | 'text' | 'both'
  aiText?: string
  gameData?: { map: string; agent: string; allies: string[]; enemies: string[] }
  settingsTrigger?: number
  settingsHotkey?: string
}

export function InGameOverlay({ listening=false, onToggle, hotkey, mode='both', aiText='', gameData, settingsTrigger=0, settingsHotkey }: OverlayProps) {
  const [isListening, setIsListening] = useState(listening)
  const [currentTip, setCurrentTip] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState(false)

  const suggestions = [
    "Ask about enemy positions",
    "Request ability combos",
    "Get site execute tips",
    "Learn optimal crosshair placement",
    "Need help with agent selection?",
    "Want to know the best gun for this round?",
  ]

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

  useEffect(() => {
    if (settingsTrigger > 0) {
      setSettingsNotice(true)
      const timer = setTimeout(() => setSettingsNotice(false), 6000)
      return () => clearTimeout(timer)
    }
  }, [settingsTrigger])

  const hasAnswer = mode !== 'speech' && !!aiText?.trim()
  const showCard = hasAnswer || isListening || settingsNotice

  const title = (() => {
    if (hasAnswer) return 'Valorant Coach'
    if (settingsNotice) return 'Settings Available on Desktop'
    if (isListening) return 'Listening…'
    return 'Voice Command'
  })()

  const subtitle = (() => {
    if (hasAnswer) return 'Fresh tactical insight tailored to your current match.'
    if (settingsNotice) return `Use the Desktop Coach (hotkey ${settingsHotkey || 'Ctrl+Alt+S'}) to adjust voices, response mode, and automations.`
    if (isListening) return `Hold ${hotkey || 'Ctrl+Alt+C'} while you speak. I stop as soon as you finish.`
    return `Press ${hotkey || 'Ctrl+Alt+C'} to speak.`
  })()

  const renderBody = () => {
    if (hasAnswer) {
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
        </div>
      )
    }

    if (isListening) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1 h-10">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-white rounded-full animate-pulse transition-all"
                style={{
                  height: `${18 + Math.random() * 22}px`,
                  animationDelay: `${i * 70}ms`,
                  animationDuration: "0.5s",
                }}
              />
            ))}
          </div>
          <div className="text-[10px] text-white/65 text-center uppercase tracking-wide">
            Hold {hotkey || 'Ctrl+Alt+C'} to talk · Release to send
          </div>
        </div>
      )
    }

    if (settingsNotice) {
      return (
        <div className="text-[11px] text-white/75 leading-relaxed bg-white/5 border border-white/10 rounded-2xl p-3">
          Desktop Coach is now open for configuration. Any overlay settings live there so this bubble can stay focused on intel.
        </div>
      )
    }

    return <div className="text-[11px] text-white/70">{suggestions[currentTip]}</div>
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
                    <div className="text-sm text-white font-semibold leading-snug">{title}</div>
                    <div className="text-[11px] text-white/60 mt-0.5 leading-relaxed">{subtitle}</div>
                  </div>
                </div>
                {renderBody()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

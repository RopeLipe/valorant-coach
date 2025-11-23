"use client"

import { useState, useEffect, useMemo } from "react"
import { Mic, Sparkles, Bot } from "lucide-react"
import { ScrollArea } from "@ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { AGENT_LIST, AgentAsset } from "../../src/utils/agentAssets"

const SUGGESTIONS = [
  "Ask about enemy positions",
  "Request ability combos",
  "Get site execute tips",
  "Learn optimal crosshair placement",
  "Need help with agent selection?",
  "Want to know the best gun for this round?",
]

const LISTENING_BARS = [18, 26, 22, 32, 20, 30, 24, 28]

type OverlayProps = {
  listening?: boolean
  onToggle?: (next: boolean) => void
  hotkey?: string
  mode?: 'speech' | 'text' | 'both'
  aiText?: string
  gameData?: { map: string; agent: string; allies: string[]; enemies: string[] }
  settingsTrigger?: number
  settingsHotkey?: string
  thinking?: boolean
}

// Helper to parse text and replace keywords with rich UI
function parseRichText(text: string) {
  if (!text) return null

  // 1. Identify all tokens (Agent Names, Ability Names)
  // We'll create a map of tokens to their assets and colors
  const tokens: { term: string, icon: string, color: string, type: 'agent' | 'ability' }[] = []

  AGENT_LIST.forEach(agent => {
    const colors = agent.backgroundGradientColors || ['#ff4655', '#000000']
    const primaryColor = `#${colors[0]}`

    // Agent Name
    tokens.push({
      term: agent.displayName,
      icon: agent.displayIcon,
      color: primaryColor,
      type: 'agent'
    })

    // Abilities
    if (agent.abilities) {
      agent.abilities.forEach(ability => {
        if (ability.displayName && ability.displayName !== 'Info') {
          tokens.push({
            term: ability.displayName,
            icon: ability.displayIcon,
            color: primaryColor,
            type: 'ability'
          })
        }
      })
    }
  })

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // 2. Replace tokens in text
  // We sort by length descending to match longest terms first (avoid partial matches)
  tokens.sort((a, b) => b.term.length - a.term.length)

  const parts: (string | JSX.Element)[] = [text]

  tokens.forEach(token => {
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (typeof part === 'string') {
        // Split by the term (case insensitive)
        const regex = new RegExp(`(${token.term})`, 'gi')
        const split = part.split(regex)

        if (split.length > 1) {
          // Replace the string part with an array of string + elements
          const newParts: (string | JSX.Element)[] = []
          split.forEach((chunk, idx) => {
            if (chunk.toLowerCase() === token.term.toLowerCase()) {
              newParts.push(
                <span
                  key={`${token.term}-${i}-${idx}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md align-middle text-xs font-bold text-white shadow-sm transform hover:scale-105 transition-transform cursor-default select-none"
                  style={{
                    backgroundColor: hexToRgba(token.color, 0.3),
                    border: `1px solid ${hexToRgba(token.color, 0.5)}`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  <img src={token.icon} alt="" className="w-3.5 h-3.5 object-contain drop-shadow-sm" />
                  {chunk}
                </span>
              )
            } else if (chunk) {
              newParts.push(chunk)
            }
          })

          // Splice in the new parts
          parts.splice(i, 1, ...newParts)
          // Skip the newly added parts
          i += newParts.length - 1
        }
      }
    }
  })

  return <>{parts}</>
}

export function InGameOverlay({ listening = false, onToggle, hotkey, mode = 'both', aiText = '', gameData, settingsTrigger = 0, settingsHotkey, thinking = false }: OverlayProps) {
  const [isListening, setIsListening] = useState(listening)
  const [currentTip, setCurrentTip] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState(false)

  useEffect(() => { setIsListening(listening) }, [listening])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIsFading(true)
      setTimeout(() => {
        setCurrentTip((prev: number) => (prev + 1) % SUGGESTIONS.length)
        setIsFading(false)
      }, 300)
    }, 4000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (settingsTrigger > 0) {
      setSettingsNotice(true)
      const timer = setTimeout(() => setSettingsNotice(false), 6000)
      return () => clearTimeout(timer)
    }
  }, [settingsTrigger])

  const hasAnswer = useMemo(() => mode !== 'speech' && !!aiText?.trim(), [aiText, mode])
  const showCard = hasAnswer || isListening || settingsNotice || thinking

  const { title, subtitle } = useMemo(() => {
    if (hasAnswer) {
      return {
        title: 'Valorant Coach',
        subtitle: 'Fresh tactical insight tailored to your current match.'
      }
    }
    if (settingsNotice) {
      return {
        title: 'Settings Available on Desktop',
        subtitle: `Use the Desktop Coach (hotkey ${settingsHotkey || 'Ctrl+Alt+S'}) to adjust voices, response mode, and automations.`
      }
    }
    if (thinking) {
      return {
        title: 'Owny is thinking...',
        subtitle: 'Analyzing match context...'
      }
    }
    if (isListening) {
      return {
        title: 'Listening…',
        subtitle: `Hold ${hotkey || 'Ctrl+Alt+C'} while you speak. I stop as soon as you finish.`
      }
    }
    return {
      title: 'Voice Command',
      subtitle: `Press ${hotkey || 'Ctrl+Alt+C'} to speak.`
    }
  }, [hasAnswer, hotkey, isListening, settingsHotkey, thinking])

  const renderBody = () => {
    if (hasAnswer) {
      return (
        <motion.div
          layout="position"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="space-y-3"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-h-40">
            <ScrollArea className="max-h-32">
              <div className="text-sm text-white/90 whitespace-pre-wrap leading-snug">
                {parseRichText(aiText)}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )
    }

    if (isListening) {
      return (
        <motion.div
          layout="position"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-center gap-1 h-10">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-white rounded-full animate-pulse transition-all"
                style={{
                  height: `${LISTENING_BARS[i % LISTENING_BARS.length]}px`,
                  animationDelay: `${(i % LISTENING_BARS.length) * 70}ms`,
                  animationDuration: "0.7s",
                }}
              />
            ))}
          </div>
          <div className="text-[10px] text-white/65 text-center uppercase tracking-wide">
            Hold {hotkey || 'Ctrl+Alt+C'} to talk · Release to send
          </div>
        </motion.div>
      )
    }

    if (thinking) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center py-4"
        >
          <div className="flex gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0 }}
              className="w-2 h-2 bg-white rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
              className="w-2 h-2 bg-white rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
              className="w-2 h-2 bg-white rounded-full"
            />
          </div>
        </motion.div>
      )
    }

    if (settingsNotice) {
      return (
        <div className="text-[11px] text-white/75 leading-relaxed bg-white/5 border border-white/10 rounded-2xl p-3">
          Desktop Coach is now open for configuration. Any overlay settings live there so this bubble can stay focused on intel.
        </div>
      )
    }

    return <div className="text-[11px] text-white/70">{SUGGESTIONS[currentTip]}</div>
  }

  return (
    <div className="relative pointer-events-none">
      <div className="absolute top-4 right-4 pointer-events-auto">
        <AnimatePresence mode="wait">
          <motion.div
            layout
            initial={false}
            animate={{
              width: showCard ? 360 : 'auto',
              borderRadius: showCard ? 24 : 9999,
              height: 'auto'
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8
            }}
            className={`backdrop-blur-xl bg-black/80 border border-white/20 overflow-hidden ${showCard ? 'shadow-[0_12px_40px_rgba(0,0,0,0.45)]' : 'hover:border-white/50'
              } ${isListening ? 'border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]' : ''}`}
          >
            <div className={`px-5 py-4 ${showCard ? 'space-y-4' : ''}`}>
              {!showCard ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-5"
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div
                      className={`text-sm text-white font-medium whitespace-nowrap transition-all duration-300 ease-out mx-0 px-0 my-0.5 ${isFading ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
                        }`}
                    >
                      {mode !== 'speech' && aiText ? aiText : SUGGESTIONS[currentTip]}
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5 tracking-wide">Press {hotkey || 'Ctrl+Alt+C'} to Speak to Me</div>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center pointer-events-none">
                    <Mic className="w-5 h-5 text-black" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-sm font-bold text-white leading-none tracking-wide">OWNED AI</h1>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                          {listening ? 'Listening' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {renderBody()}
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

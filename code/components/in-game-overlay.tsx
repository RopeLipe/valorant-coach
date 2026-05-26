"use client"

import { useState, useEffect, useMemo } from "react"
import { Mic, Sparkles, Bot, Brain, XCircle, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react"
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

const AudioWaveformVisualizer: React.FC<{ active: boolean; levels?: number[] }> = ({ active, levels }) => {
  const defaultBars = [6, 16, 12, 22, 10, 18, 8, 14, 4];
  const bars = (levels && levels.length >= 8) 
    ? levels.slice(0, 9).map(v => Math.max(4, Math.round(v * 28)))
    : defaultBars;

  return (
    <div className="flex items-center gap-[3px] h-6 justify-center">
      {bars.map((maxHeight, idx) => (
        <motion.div
          key={idx}
          animate={active ? {
            height: [4, maxHeight, 4],
          } : {
            height: 4
          }}
          transition={{
            repeat: Infinity,
            duration: 0.6 + idx * 0.08,
            ease: "easeInOut"
          }}
          className="w-[3px] bg-white rounded-full"
          style={{ height: 4 }}
        />
      ))}
    </div>
  );
};

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
  isError?: boolean
  hasGameContext?: boolean
  audioLevels?: number[]
  alerts?: { agent: string; status: 'ready' | 'almost'; orbsAway: number }[]
  showRoundEndPrompt?: boolean
  onRate?: (rating: 'up' | 'down', aiText: string) => void
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
        // Split by the term (case insensitive) with word boundaries
        const regex = new RegExp(`\\b(${token.term})\\b`, 'gi')
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

export function InGameOverlay(props: OverlayProps) {
  const { listening = false, onToggle, hotkey, mode = 'both', aiText = '', gameData, settingsTrigger = 0, settingsHotkey, thinking = false, isError = false, hasGameContext = true, audioLevels, alerts = [], showRoundEndPrompt = false, onRate } = props
  const [isListening, setIsListening] = useState(listening)
  const [currentTip, setCurrentTip] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState(false)
  const [lastRating, setLastRating] = useState<'up' | 'down' | null>(null)
  // Reset the rating state whenever a new answer arrives
  useEffect(() => { setLastRating(null) }, [aiText])

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
  const showCard = hasAnswer || isListening || settingsNotice || thinking || showRoundEndPrompt

  const { title, subtitle } = useMemo(() => {
    if (showRoundEndPrompt) {
      return {
        title: 'Round Ended',
        subtitle: 'Tell me what happened to improve my predictions.'
      }
    }
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
        title: 'Owned is thinking...',
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
  }, [hasAnswer, hotkey, isListening, settingsHotkey, thinking, showRoundEndPrompt])

  const renderBody = () => {
    if (showRoundEndPrompt) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-2 space-y-3"
        >
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white/10 border border-white/20 ${listening ? 'animate-pulse bg-red-500/20 border-red-500/50' : ''}`}>
              <Mic className={`w-6 h-6 ${listening ? 'text-red-400' : 'text-white/80'}`} />
            </div>
            {listening && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-white">"They rushed A site..."</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Hold {hotkey || 'Ctrl+Alt+C'} to record note</p>
          </div>
        </motion.div>
      )
    }

    if (hasAnswer) {
      const rate = (r: 'up' | 'down') => {
        if (lastRating) return
        setLastRating(r)
        try { onRate?.(r, aiText) } catch { }
      }
      return (
        <motion.div
          layout="position"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="space-y-3"
        >
          <div className={`border rounded-2xl p-4 max-h-60 shadow-lg backdrop-blur-md ${isError ? 'bg-black/40 border-red-500/20' : 'bg-black/60 border-white/10'}`}>
            <ScrollArea className="max-h-48 pr-2">
              <div className="text-base text-white font-medium whitespace-pre-wrap leading-relaxed tracking-wide drop-shadow-sm">
                {parseRichText(aiText)}
              </div>
            </ScrollArea>
            {!isError && (
              <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-white/5">
                <span className="text-[9px] text-white/30 uppercase tracking-wider mr-1">
                  {lastRating ? 'Thanks' : 'Helpful?'}
                </span>
                <button
                  aria-label="Mark helpful"
                  disabled={!!lastRating}
                  onClick={() => rate('up')}
                  className={`p-1.5 rounded-md transition-colors ${lastRating === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/5 text-white/50 hover:text-white'}`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label="Mark unhelpful"
                  disabled={!!lastRating}
                  onClick={() => rate('down')}
                  className={`p-1.5 rounded-md transition-colors ${lastRating === 'down' ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/5 text-white/50 hover:text-white'}`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
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
            {/* Use real audio levels if available, otherwise fallback to static bars */}
            {(props.audioLevels && props.audioLevels.length > 0 ? props.audioLevels : new Array(16).fill(0.1)).map((level: number, i: number) => (
              <motion.div
                key={i}
                className="w-0.5 bg-white rounded-full transition-all shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                animate={{
                  height: Math.max(4, level * 24), // Scale 0-1 to 4px-28px
                  opacity: Math.max(0.3, level + 0.2)
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  mass: 0.5
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
          className="flex flex-col items-center justify-center py-4 space-y-4"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10">
            <Brain className="w-6 h-6 text-white animate-pulse" />
            <div className="absolute inset-0 bg-white/5 animate-ping rounded-xl opacity-20" />
          </div>
          <div className="space-y-2 text-center w-full">
            <AudioWaveformVisualizer active={true} />
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-mono mt-1">Analyzing Match Context</p>
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
      <div className="absolute top-4 right-4 pointer-events-auto flex flex-col items-end gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            layout
            initial={false}
            animate={{
              width: showCard ? 420 : 'auto',
              borderRadius: showCard ? 24 : 9999,
              height: 'auto'
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8
            }}
            className={`backdrop-blur-xl overflow-hidden ${isError
              ? 'bg-black/90 border border-red-500/30 shadow-[0_0_40px_rgba(220,38,38,0.15)]'
              : `bg-[#050505]/75 border border-white/10 ${showCard ? 'shadow-[0_0_25px_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.6)]' : 'hover:border-white/30'}`
              } ${isListening ? 'border border-white shadow-[0_0_35px_rgba(255,255,255,0.18)]' : ''}`}
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
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-md border shadow-inner ${isError ? 'bg-red-500/10 border-red-500/20' : 'bg-white/10 border-white/10'}`}>
                      {isError ? <XCircle className="w-5 h-5 text-red-500" /> : <Bot className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h1 className={`text-sm font-bold leading-none tracking-wide ${isError ? 'text-red-500' : 'text-white'}`}>
                        {isError ? 'SYSTEM ALERT' : (showRoundEndPrompt ? 'ROUND ANALYSIS' : 'OWNED AI')}
                      </h1>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${listening ? 'bg-red-500 animate-pulse' : (isError ? 'bg-red-500' : 'bg-green-500')}`} />
                        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                          {listening ? 'Listening' : (isError ? 'Error' : 'Ready')}
                        </span>
                        {!hasGameContext && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[9px] font-bold uppercase tracking-wider border border-amber-500/30">
                            No Game Context
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {renderBody()}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[8px] text-white/20 leading-tight font-sans text-center">
                      Owned isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Alerts Section */}
        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-2 w-[420px]"
            >
              {alerts.map((alert, idx) => (
                <motion.div
                  key={`${alert.agent}-${idx}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-md border shadow-lg ${alert.status === 'ready'
                      ? 'bg-red-500/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                      : 'bg-amber-500/10 border-amber-500/30'
                    }`}
                >
                  <div className={`p-1.5 rounded-lg ${alert.status === 'ready' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                    <AlertTriangle className={`w-4 h-4 ${alert.status === 'ready' ? 'text-red-400' : 'text-amber-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs font-bold uppercase tracking-wider ${alert.status === 'ready' ? 'text-red-100' : 'text-amber-100'}`}>
                      {alert.agent} Ult {alert.status === 'ready' ? 'Ready' : 'Soon'}
                    </div>
                    <div className="text-[10px] text-white/60">
                      {alert.status === 'ready' ? 'Watch for usage' : `${alert.orbsAway} orb${alert.orbsAway > 1 ? 's' : ''} away`}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

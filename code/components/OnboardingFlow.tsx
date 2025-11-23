import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Keyboard, CheckCircle, ArrowRight, Sparkles, ShieldCheck, Settings, User, ChevronRight } from 'lucide-react'
import { Button } from '@ui/button'
import { Card } from '@ui/card'
import { RiotService } from '../../services/riotService'
import Particles from './react-bits/Particles'
import ShinyText from './react-bits/ShinyText'
import DecryptedText from './react-bits/DecryptedText'

interface OnboardingFlowProps {
    onComplete: (riotId?: string) => void
}

const steps = [
    { id: 'welcome', title: 'Welcome', icon: Sparkles },
    { id: 'riot_id', title: 'Riot ID', icon: User },
    { id: 'mic', title: 'Microphone', icon: Mic },
    { id: 'hotkeys', title: 'Hotkeys', icon: Keyboard },
    { id: 'preferences', title: 'Preferences', icon: Settings },
    { id: 'finish', title: 'Ready', icon: CheckCircle },
]

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [messageDuration, setMessageDuration] = useState<number>(5000)
    const [riotIdInput, setRiotIdInput] = useState("")
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [isCheckingRiotId, setIsCheckingRiotId] = useState(false)

    const MOCK_SUGGESTIONS = ["Z1n3x#NA1", "TenZ#NA1", "Demon1#NA1", "Shroud#NA1"]
    const [knownPlayers, setKnownPlayers] = useState<string[]>([])

    useEffect(() => {
        RiotService.getKnownPlayers().then(players => {
            if (players.length > 0) setKnownPlayers(players)
        })
    }, [])

    useEffect(() => {
        const searchUser = async () => {
            if (riotIdInput && riotIdInput.includes('#')) {
                const [name, tag] = riotIdInput.split('#')
                if (name && tag) {
                    try {
                        setIsCheckingRiotId(true)
                        const account = await RiotService.getAccount(name, tag)
                        if (account) {
                            const fullName = `${account.gameName}#${account.tagLine}`
                            setSuggestions(prev => {
                                if (prev.includes(fullName)) return prev
                                return [fullName, ...prev]
                            })
                            setShowSuggestions(true)
                        }
                    } catch (e: any) {
                        if (e.message && e.message.includes('401')) {
                            // API Key expired or invalid
                            console.warn("Riot API Key invalid or expired.")
                            // We can still proceed, just won't get suggestions
                        }
                    } finally {
                        setIsCheckingRiotId(false)
                    }
                }
            }
        }

        const timer = setTimeout(searchUser, 500)

        if (riotIdInput) {
            const source = knownPlayers.length > 0 ? knownPlayers : MOCK_SUGGESTIONS
            const filtered = source.filter(s => s.toLowerCase().includes(riotIdInput.toLowerCase()))
            setSuggestions(filtered)
            setShowSuggestions(true)
        } else {
            setSuggestions([])
            setShowSuggestions(false)
        }

        return () => clearTimeout(timer)
    }, [riotIdInput, knownPlayers])

    // Hotkey State
    const [hotkeys, setHotkeys] = useState<Record<string, string>>({})
    const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null)

    useEffect(() => {
        const fetchHotkeys = () => {
            try {
                const ow = (window as any).overwolf
                ow?.settings?.hotkeys?.get((res: any) => {
                    if (res?.success) {
                        let list: any[] = []
                        if (Array.isArray(res.hotkeys)) {
                            list = res.hotkeys
                        } else if (res.globals || res.games) {
                            list = [
                                ...(Array.isArray(res.globals) ? res.globals : []),
                                ...(res.games && res.games[21640] && Array.isArray(res.games[21640]) ? res.games[21640] : [])
                            ]
                        }
                        const newHotkeys: Record<string, string> = {}
                        list.forEach((h: any) => {
                            if (h.name && (h.binding || h.hotkey)) {
                                newHotkeys[h.name] = h.binding || h.hotkey
                            }
                        })
                        setHotkeys((prev: Record<string, string>) => ({ ...prev, ...newHotkeys }))
                    }
                })
            } catch { }
        }
        fetchHotkeys()
        const interval = setInterval(fetchHotkeys, 2000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!recordingHotkey) return
            e.preventDefault()
            e.stopPropagation()

            const keys = []
            if (e.ctrlKey) keys.push('Ctrl')
            if (e.altKey) keys.push('Alt')
            if (e.shiftKey) keys.push('Shift')
            if (e.metaKey) keys.push('Win')

            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

            const key = e.key.toUpperCase()
            if (!keys.includes(key)) keys.push(key)

            const binding = keys.join('+')

            setHotkeys(prev => ({ ...prev, [recordingHotkey]: binding }))
            setRecordingHotkey(null)

            try {
                const ow = (window as any).overwolf
                if (ow?.settings?.hotkeys?.assign) {
                    const assignObj = {
                        name: recordingHotkey,
                        gameId: 21640,
                        virtualKey: e.keyCode,
                        modifiers: {
                            ctrl: e.ctrlKey,
                            alt: e.altKey,
                            shift: e.shiftKey
                        }
                    }
                    ow.settings.hotkeys.assign(assignObj, (res: any) => {
                        if (!res?.success) {
                            console.error("Failed to assign hotkey", JSON.stringify(res))
                        }
                    })
                }
            } catch (e) {
                console.error("Error assigning hotkey", e)
            }
        }

        if (recordingHotkey) {
            window.addEventListener('keydown', handleKeyDown)
        }
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [recordingHotkey])

    useEffect(() => {
        if (steps[currentStep].id === 'mic') {
            checkMicPermission()
        }
    }, [currentStep])

    useEffect(() => {
        let audioCtx: AudioContext | null = null
        let stream: MediaStream | null = null
        let animationId: number

        if (steps[currentStep].id === 'mic' && micPermission === 'granted') {
            const init = async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
                    audioCtx = new AudioContextClass()
                    const source = audioCtx.createMediaStreamSource(stream)
                    const analyser = audioCtx.createAnalyser()
                    analyser.fftSize = 64
                    source.connect(analyser)

                    const bufferLength = analyser.frequencyBinCount
                    const dataArray = new Uint8Array(bufferLength)

                    const render = () => {
                        analyser.getByteFrequencyData(dataArray)
                        if (canvasRef.current) {
                            const ctx = canvasRef.current.getContext('2d')
                            if (ctx) {
                                const w = canvasRef.current.width
                                const h = canvasRef.current.height
                                ctx.clearRect(0, 0, w, h)

                                const barWidth = (w / bufferLength) * 0.8
                                const gap = (w / bufferLength) * 0.2
                                let x = 0

                                for (let i = 0; i < bufferLength; i++) {
                                    const value = dataArray[i]
                                    const percent = value / 255
                                    const barHeight = percent * h

                                    // Black and White theme: White bars with varying opacity
                                    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.8})`

                                    ctx.beginPath()
                                    // @ts-ignore
                                    if (ctx.roundRect) {
                                        ctx.roundRect(x, h / 2 - barHeight / 2, barWidth, barHeight, [2])
                                    } else {
                                        ctx.rect(x, h / 2 - barHeight / 2, barWidth, barHeight)
                                    }
                                    ctx.fill()

                                    x += barWidth + gap
                                }
                            }
                        }
                        animationId = requestAnimationFrame(render)
                    }
                    render()
                } catch (e) {
                    console.error("Mic test failed", e)
                }
            }
            init()
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId)
            if (audioCtx) audioCtx.close()
            if (stream) stream.getTracks().forEach(track => track.stop())
        }
    }, [currentStep, micPermission])

    const checkMicPermission = async () => {
        if (!navigator.mediaDevices?.getUserMedia) return
        try {
            const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
            setMicPermission(status.state === 'granted' ? 'granted' : 'denied')
            status.onchange = () => {
                setMicPermission(status.state === 'granted' ? 'granted' : 'denied')
            }
        } catch {
            setMicPermission('unknown')
        }
    }

    const requestMic = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true })
            setMicPermission('granted')
        } catch {
            setMicPermission('denied')
        }
    }

    const handleDurationChange = (val: number) => {
        setMessageDuration(val)
        try {
            localStorage.setItem('coach_message_duration', val.toString())
        } catch { }
    }

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            onComplete(riotIdInput)
        }
    }

    const StepContent = () => {
        const step = steps[currentStep]
        switch (step.id) {
            case 'welcome':
                return (
                    <div className="text-center space-y-8">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                        >
                            <Sparkles className="w-12 h-12 text-black" />
                        </motion.div>
                        <div>
                            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">
                                <ShinyText text="Welcome to OWNED" disabled={false} speed={3} className="custom-class" />
                            </h2>
                            <div className="text-white/60 max-w-md mx-auto text-lg">
                                <DecryptedText
                                    text="Your personal AI Valorant coach. Let's get you set up for victory."
                                    animateOn="view"
                                    revealDirection="center"
                                />
                            </div>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Button
                                onClick={nextStep}
                                className="bg-white text-black hover:bg-gray-200 px-10 py-6 text-lg font-bold rounded-full transition-all hover:scale-105"
                            >
                                Get Started
                            </Button>
                        </motion.div>
                    </div>
                )
            case 'riot_id':
                return (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">
                                <DecryptedText text="Connect Riot Account" animateOn="view" />
                            </h2>
                            <p className="text-white/60">Enter your Riot ID to fetch your stats.</p>
                        </div>
                        <div className="max-w-md mx-auto relative group">
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    value={riotIdInput}
                                    onChange={(e) => setRiotIdInput(e.target.value)}
                                    placeholder="GameName #Tag"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 focus:bg-black/60 transition-all"
                                />
                                {isCheckingRiotId && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            {/* Error Message for API issues */}
                            {riotIdInput.includes('#') && !isCheckingRiotId && suggestions.length === 0 && (
                                <div className="text-center mt-2">
                                    <p className="text-red-400 text-xs">
                                        Could not find player. (API might be unavailable)
                                    </p>
                                </div>
                            )}
                            <AnimatePresence>
                                {showSuggestions && suggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-[#0F1115] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20"
                                    >
                                        {suggestions.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => {
                                                    setRiotIdInput(s)
                                                    setShowSuggestions(false)
                                                }}
                                                className="w-full text-left px-4 py-3 text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                                            >
                                                <User className="w-4 h-4 opacity-50" />
                                                {s}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )
            case 'mic':
                return (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">Voice Setup</h2>
                            <p className="text-white/60">We need access to your microphone to hear your questions.</p>
                        </div>
                        <div className="p-8 bg-black/40 rounded-2xl border border-white/10 flex flex-col items-center gap-6 backdrop-blur-sm">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${micPermission === 'granted' ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-white/40'}`}>
                                <Mic className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-white text-lg mb-1">
                                    {micPermission === 'granted' ? 'Microphone Active' : 'Permission Needed'}
                                </div>
                                <div className="text-sm text-white/40">
                                    {micPermission === 'granted' ? 'Speak now to test your levels.' : 'Click below to grant access.'}
                                </div>
                            </div>
                            {micPermission === 'granted' && (
                                <div className="w-full h-24 bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative border border-white/5">
                                    <canvas ref={canvasRef} width={300} height={96} className="w-full h-full" />
                                </div>
                            )}
                            {micPermission !== 'granted' && (
                                <Button onClick={requestMic} className="bg-white text-black hover:bg-gray-200 px-8">
                                    Grant Permission
                                </Button>
                            )}
                        </div>
                    </div>
                )
            case 'hotkeys':
                return (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">
                                <ShinyText text="Quick Controls" speed={4} />
                            </h2>
                            <p className="text-white/60">Click to customize your hotkeys.</p>
                        </div>
                        <div className="grid gap-4">
                            {[
                                { id: 'voice_command', label: 'Talk to OWNED AI', default: 'Ctrl+Alt+C' },
                                { id: 'toggle_settings', label: 'Open Settings', default: 'Ctrl+Alt+S' }
                            ].map((hk) => (
                                <motion.div
                                    key={hk.id}
                                    className={`relative overflow-hidden p-5 rounded-xl border transition-all duration-300 cursor-pointer group ${recordingHotkey === hk.id
                                        ? 'bg-white/10 border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                                        : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/20'
                                        }`}
                                    onClick={() => setRecordingHotkey(hk.id)}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-lg transition-colors ${recordingHotkey === hk.id ? 'bg-white text-black' : 'bg-white/5 text-white'}`}>
                                                <Keyboard className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-white text-lg">{hk.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {recordingHotkey === hk.id ? (
                                                <span className="text-sm font-mono text-white animate-pulse">Press keys...</span>
                                            ) : (
                                                (hotkeys[hk.id] || hk.default).split('+').map((k: string, i: number) => (
                                                    <kbd key={i} className="px-3 py-1.5 bg-white/10 rounded-md text-sm font-mono text-white border border-white/10 min-w-[32px] text-center shadow-sm">
                                                        {k}
                                                    </kbd>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        <div className="flex justify-center">
                            <button
                                onClick={() => setHotkeys({ 'voice_command': 'Ctrl+Alt+C', 'toggle_settings': 'Ctrl+Alt+S' })}
                                className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider font-bold"
                            >
                                <Settings className="w-3 h-3" /> Reset Defaults
                            </button>
                        </div>
                    </div>
                )
            case 'preferences':
                return (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">Preferences</h2>
                            <p className="text-white/60">Customize your experience.</p>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-6">
                                <label className="text-base font-bold text-white">Message Display Time</label>
                                <span className="text-base font-mono text-white bg-white/10 px-3 py-1 rounded-md">{messageDuration / 1000}s</span>
                            </div>
                            <div className="relative h-2 bg-white/10 rounded-full mb-6">
                                <div
                                    className="absolute top-0 left-0 h-full bg-white rounded-full"
                                    style={{ width: `${((messageDuration - 3000) / 12000) * 100}%` }}
                                />
                                <input
                                    type="range"
                                    min="3000"
                                    max="15000"
                                    step="1000"
                                    value={messageDuration}
                                    onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg pointer-events-none transition-all"
                                    style={{ left: `calc(${((messageDuration - 3000) / 12000) * 100}% - 12px)` }}
                                />
                            </div>
                            <p className="text-sm text-white/40">
                                Controls how long the AI's response stays on screen before fading out.
                            </p>
                        </div>
                    </div>
                )
            case 'finish':
                return (
                    <div className="text-center space-y-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                            className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)]"
                        >
                            <CheckCircle className="w-12 h-12 text-black" />
                        </motion.div>
                        <div>
                            <h2 className="text-4xl font-black text-white mb-4">
                                <DecryptedText text="All Set!" animateOn="view" revealDirection="center" speed={100} />
                            </h2>
                            <p className="text-white/60 max-w-md mx-auto text-lg">
                                You're ready to dominate. Launch Valorant and OWNED AI will be waiting.
                            </p>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Button
                                onClick={() => onComplete(riotIdInput)}
                                className="bg-white text-black hover:bg-gray-200 px-12 py-6 text-xl font-bold rounded-full transition-all hover:scale-105 shadow-xl shadow-white/10"
                            >
                                Enter Dashboard
                            </Button>
                        </motion.div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-8 overflow-hidden font-sans">
            {/* Background Particles */}
            <div className="absolute inset-0 z-0">
                <Particles
                    particleCount={150}
                    particleSpread={10}
                    speed={0.2}
                    particleColors={['#ffffff', '#aaaaaa']}
                    moveParticlesOnHover={true}
                    particleHoverFactor={1}
                    alphaParticles={true}
                    particleBaseSize={100}
                    sizeRandomness={1}
                    cameraDistance={20}
                    disableRotation={false}
                    className="w-full h-full opacity-30"
                />
            </div>

            {/* Radial Gradient Overlay for depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] pointer-events-none z-0" />

            <Card className="w-full max-w-3xl glass-card border-white/10 bg-[#0F1115]/80 shadow-2xl overflow-hidden relative z-10 backdrop-blur-xl">
                {/* Progress Bar */}
                {currentStep > 0 && currentStep < steps.length - 1 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                        <motion.div
                            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            initial={{ width: '0%' }}
                            animate={{ width: `${((currentStep) / (steps.length - 1)) * 100}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                )}

                <div className="p-12 min-h-[600px] flex flex-col relative">
                    {/* Header Navigation (Hidden on Welcome/Finish for cleaner look) */}
                    {currentStep > 0 && currentStep < steps.length - 1 && (
                        <div className="flex justify-between items-center mb-12">
                            <div className="flex gap-3">
                                {steps.slice(1, -1).map((s, i) => {
                                    const stepIndex = i + 1
                                    return (
                                        <div
                                            key={s.id}
                                            className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${stepIndex === currentStep ? 'bg-white scale-125 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : stepIndex < currentStep ? 'bg-white/40' : 'bg-white/10'}`}
                                        />
                                    )
                                })}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => onComplete(riotIdInput)} className="text-white/40 hover:text-white hover:bg-transparent">
                                Skip Setup
                            </Button>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="w-full"
                            >
                                {StepContent()}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Navigation (Hidden on Welcome/Finish) */}
                    {currentStep > 0 && currentStep < steps.length - 1 && (
                        <div className="mt-12 flex justify-between items-center">
                            <Button
                                variant="ghost"
                                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                className="text-white/60 hover:text-white hover:bg-white/5"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={nextStep}
                                className="bg-white text-black hover:bg-gray-200 px-8 font-bold rounded-full group"
                            >
                                Next
                                <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}

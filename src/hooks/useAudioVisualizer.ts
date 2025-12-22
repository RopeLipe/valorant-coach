import { useState, useEffect, useRef } from 'react'

export function useAudioVisualizer(isListening: boolean, barCount: number = 16) {
    const [audioData, setAudioData] = useState<number[]>(new Array(barCount).fill(0))
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const rafRef = useRef<number | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        if (!isListening) {
            // Cleanup
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect()
                sourceRef.current = null
            }
            if (analyserRef.current) {
                analyserRef.current.disconnect()
                analyserRef.current = null
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }
            if (audioContextRef.current) {
                audioContextRef.current.close()
                audioContextRef.current = null
            }
            setAudioData(new Array(barCount).fill(0))
            return
        }

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                streamRef.current = stream

                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
                const audioContext = new AudioContextClass()
                audioContextRef.current = audioContext

                const analyser = audioContext.createAnalyser()
                analyser.fftSize = 64 // Small FFT size for fewer bars/better performance
                analyser.smoothingTimeConstant = 0.5 // Smooth out the jitter
                analyserRef.current = analyser

                const source = audioContext.createMediaStreamSource(stream)
                source.connect(analyser)
                sourceRef.current = source

                const bufferLength = analyser.frequencyBinCount
                const dataArray = new Uint8Array(bufferLength)

                const update = () => {
                    if (!analyserRef.current) return

                    analyserRef.current.getByteFrequencyData(dataArray)

                    // Downsample to barCount
                    // We only care about the lower frequencies mostly for voice
                    const relevantData = dataArray.slice(0, Math.floor(bufferLength / 2))
                    const step = Math.floor(relevantData.length / barCount)
                    const newData: number[] = []

                    for (let i = 0; i < barCount; i++) {
                        let sum = 0
                        for (let j = 0; j < step; j++) {
                            sum += relevantData[i * step + j] || 0
                        }
                        const avg = sum / step
                        // Normalize to 0-1 range, maybe boost a bit
                        const normalized = Math.min(1, (avg / 255) * 1.5)
                        newData.push(normalized)
                    }

                    setAudioData(newData)
                    rafRef.current = requestAnimationFrame(update)
                }

                update()
            } catch (err) {
                console.error("Failed to initialize audio visualizer:", err)
            }
        }

        initAudio()

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            if (sourceRef.current) sourceRef.current.disconnect()
            if (analyserRef.current) analyserRef.current.disconnect()
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
            if (audioContextRef.current) audioContextRef.current.close()
        }
    }, [isListening, barCount])

    return audioData
}

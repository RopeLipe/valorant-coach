import { voiceLog } from './voice'
import { correctTranscript } from './speechToText'

type SpeechRecognitionEvent = any
type SpeechRecognitionErrorEvent = any

interface ContinuousOptions {
    onResult: (text: string, isFinal: boolean) => void
    onError: (error: string) => void
    onStateChange: (state: 'listening' | 'idle' | 'error') => void
}

export class ContinuousVoiceService {
    private recognition: any = null
    private isRunning = false
    private isCapturing = false
    private options: ContinuousOptions
    private restartTimer: any = null
    private currentTranscript = ''
    private sessionCallback: ((text: string, isFinal: boolean) => void) | null = null

    constructor(options: ContinuousOptions) {
        this.options = options
    }

    private getSpeechRecognition() {
        return window.SpeechRecognition || (window as any).webkitSpeechRecognition
    }

    start() {
        const SpeechRecognition = this.getSpeechRecognition()
        if (!SpeechRecognition) {
            this.options.onError('Speech API not supported')
            return
        }

        if (this.isRunning) return

        try {
            this.recognition = new SpeechRecognition()
            this.recognition.continuous = true
            this.recognition.interimResults = true
            this.recognition.lang = 'en-US'

            this.recognition.onstart = () => {
                this.isRunning = true
                this.options.onStateChange('listening')
                voiceLog('continuous_start')
            }

            this.recognition.onend = () => {
                this.isRunning = false
                this.options.onStateChange('idle')
                voiceLog('continuous_end')
                // Auto-restart if we are supposed to be running
                if (this.recognition) { // If not explicitly stopped (recognition set to null)
                    this.restartTimer = setTimeout(() => {
                        try { this.recognition?.start() } catch { }
                    }, 100)
                }
            }

            this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    voiceLog('continuous_status', { status: 'waiting_for_gesture', message: 'Mic waiting for user activation' })
                    this.options.onError('Microphone permission denied. Please enable it in settings.')
                    this.stop()
                    return
                }
                voiceLog('continuous_error', { error: event.error, message: event.message })
                if (event.error === 'audio-capture') {
                    this.options.onError('No microphone detected.')
                    this.stop()
                }
            }

            this.recognition.onresult = (event: SpeechRecognitionEvent) => {
                if (!this.isCapturing) return

                let finalTranscript = ''
                let interimTranscript = ''

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript
                    } else {
                        interimTranscript += event.results[i][0].transcript
                    }
                }

                const rawText = (finalTranscript || interimTranscript).trim()
                if (rawText) {
                    const text = correctTranscript(rawText)
                    this.currentTranscript = text // Update currentTranscript here
                    this.options.onResult(text, !!finalTranscript)
                    // Also trigger session callback if active
                    if (this.sessionCallback) {
                        this.sessionCallback(text, !!finalTranscript)
                    }
                }
            }

            this.recognition.start()
        } catch (e: any) {
            this.options.onError(e.message)
        }
    }

    stop() {
        if (this.restartTimer) clearTimeout(this.restartTimer)
        const rec = this.recognition
        this.recognition = null // Prevent auto-restart
        this.isRunning = false
        this.isCapturing = false
        try { rec?.stop() } catch { }
        this.options.onStateChange('idle')
    }

    startCapture() {
        if (!this.isRunning) {
            this.start()
        }
        this.isCapturing = true
        this.currentTranscript = ''
    }

    stopCapture() {
        this.isCapturing = false
        return this.currentTranscript
    }

    // Smart capture that resolves when speech ends or times out
    captureOnce(options: { silenceDelay?: number; maxDuration?: number } = {}): Promise<string | null> {
        return new Promise((resolve) => {
            if (!this.isRunning) this.start()

            this.isCapturing = true
            this.currentTranscript = ''

            const silenceDelay = options.silenceDelay || 1200 // Wait 1.2s of silence to confirm end
            const maxDuration = options.maxDuration || 6000   // Max wait for ANY speech

            let silenceTimer: any = null
            let maxTimer: any = null
            let hasSpeech = false

            const finish = (text: string | null) => {
                this.isCapturing = false
                // Restore original handlers if we messed with them?
                // Actually, we need to hook into the EXISTING onResult, not replace it,
                // or the constructor options will break.
                // But `onResult` in constructor is for streaming updates.
                // We can just use `currentTranscript` which is updated by the main `onresult`.

                // Wait, `currentTranscript` is updated in `onresult`?
                // No, the previous implementation of `onresult` called `this.options.onResult`.
                // It didn't update `this.currentTranscript`!
                // We need to fix `onresult` to update local state too.

                clearTimeout(silenceTimer)
                clearTimeout(maxTimer)
                // Remove our temporary listener injection?
                // Better: The class should support a "session" callback.
                this.sessionCallback = null
                resolve(text)
            }

            this.sessionCallback = (text: string, isFinal: boolean) => {
                hasSpeech = true
                this.currentTranscript = text

                // Reset silence timer on every word
                clearTimeout(silenceTimer)
                silenceTimer = setTimeout(() => {
                    finish(this.currentTranscript)
                }, silenceDelay)
            }

            // Initial timeout: If no speech at all is detected within X seconds
            maxTimer = setTimeout(() => {
                if (!hasSpeech) {
                    finish(null) // No speech detected
                } else {
                    // If we have speech but it's going on too long, just cut it
                    finish(this.currentTranscript)
                }
            }, maxDuration)
        })
    }
}

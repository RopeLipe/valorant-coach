import { GoogleGenerativeAI } from "@google/generative-ai";
import { RAG_CONFIG } from "../config/ragConfig";

const VAD_THRESHOLD = 0.02; // Sensitivity
const SILENCE_DURATION = 1000; // Time to wait before stopping recording

export class AudioProcessor {
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private isRecording = false;
    private silenceStart: number | null = null;
    private vadInterval: number | null = null;
    private onTranscription: (text: string) => void;
    private onError: (err: string) => void;
    private onStateChange: (state: 'listening' | 'processing' | 'idle' | 'retrying') => void;
    private genAI: GoogleGenerativeAI;
    private hotkeyActive = false;
    private noSpeechTimer: number | null = null;
    private readonly NO_SPEECH_TIMEOUT_MS = 3000; // 3 seconds to start speaking

    constructor(callbacks: {
        onTranscription: (text: string) => void,
        onError: (err: string) => void,
        onStateChange: (state: 'listening' | 'processing' | 'idle' | 'retrying') => void
    }) {
        this.onTranscription = callbacks.onTranscription;
        this.onError = callbacks.onError;
        this.onStateChange = callbacks.onStateChange;

        // Initialize Gemini
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    setHotkeyState(active: boolean) {
        if (this.hotkeyActive === active) return;
        this.hotkeyActive = active;

        if (active) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async start() {
        // No-op for PTT mode, but kept for compatibility if needed
    }

    private async startRecording() {
        if (this.isRecording) return;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.chunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.chunks, { type: 'audio/webm' });
                if (blob.size > 0) {
                    await this.transcribe(blob);
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.onStateChange('listening');

            // Safety timeout: if user holds key for > 30s, stop
            setTimeout(() => {
                if (this.isRecording) this.stopRecording();
            }, 30000);

        } catch (err: any) {
            this.onError('Microphone access denied: ' + err.message);
        }
    }

    private stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        this.mediaRecorder.stop();
        this.isRecording = false;
        // Stream cleanup happens in transcribe/stop
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }

    private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            if (retries > 0 && (error.message?.includes('503') || error.message?.includes('overloaded'))) {
                this.onStateChange('retrying');
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retryWithBackoff(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    private async transcribe(audioBlob: Blob) {
        this.onStateChange('processing');
        try {
            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const base64Content = base64data.split(',')[1];

                const model = this.genAI.getGenerativeModel({ model: RAG_CONFIG.defaultModel });

                try {
                    const result = await this.retryWithBackoff(async () => {
                        return await model.generateContent([
                            {
                                inlineData: {
                                    mimeType: "audio/webm",
                                    data: base64Content
                                }
                            },
                            { text: "Transcribe this audio exactly. Return only the text." }
                        ]);
                    });

                    const text = result.response.text();
                    if (text && text.trim()) {
                        this.onTranscription(text.trim());
                    }
                    this.onStateChange('idle');
                } catch (err: any) {
                    console.error('Transcription failed after retries', err);
                    this.onError('Transcription failed: ' + err.message);
                    this.onStateChange('idle');
                }
            };
        } catch (e: any) {
            console.error('Transcription setup failed', e);
            this.onError('Transcription setup failed: ' + e.message);
            this.onStateChange('idle');
        }
    }

    stop() {
        if (this.vadInterval) clearInterval(this.vadInterval);
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.audioContext) this.audioContext.close();
        this.stream = null;
        this.audioContext = null;
    }
}

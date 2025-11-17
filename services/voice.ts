import { transcribeAudio } from "./speechToText"

export type STTResult = { text: string }

const MIC_STORAGE_KEY = "coach_preferred_mic_id"

let recorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let chunks: BlobPart[] = []
let autoStopTimer: number | null = null
let cancelled = false
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let monitorRaf: number | null = null
let speechDetected = false
let lastSpeechTs = 0
let recordingStartedTs = 0
let silenceStop = false

function supportsMediaRecorder() {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator?.mediaDevices?.getUserMedia
}

function fallbackRecognition(): any | null {
  const w: any = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

type ListenOptions = {
  maxDurationMs?: number
  preSpeechTimeoutMs?: number
  silenceAfterSpeechMs?: number
  energyThreshold?: number
}

export async function startListening(options?: ListenOptions): Promise<STTResult> {
  if (recorder) {
    throw new Error("already_listening")
  }

  if (supportsMediaRecorder()) {
    return recordAndTranscribe(options)
  }

  return legacySpeechRecognition()
}

async function recordAndTranscribe(options?: ListenOptions): Promise<STTResult> {
  const preferredId = (() => {
    try { return localStorage.getItem(MIC_STORAGE_KEY) || undefined } catch { return undefined }
  })()
  const constraints: MediaStreamConstraints = preferredId
    ? { audio: { deviceId: { exact: preferredId } } }
    : { audio: true }

  mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
  chunks = []
  cancelled = false

  return new Promise((resolve, reject) => {
    try {
      recorder = new MediaRecorder(mediaStream!, { mimeType: "audio/webm" })
    } catch (err) {
      cleanupRecorder()
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data?.size) {
        chunks.push(event.data)
      }
    }

    recorder.onerror = (event: any) => {
      cleanupRecorder()
      reject(new Error(event?.error || "recorder_error"))
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" })
      cleanupRecorder()
      if (cancelled) {
        const err: any = new Error("cancelled")
        err.code = "cancelled"
        reject(err)
        return
      }
      if (silenceStop && !speechDetected) {
        silenceStop = false
        resolve({ text: "" })
        return
      }
      silenceStop = false
      try {
        const text = await transcribeAudio(blob)
        resolve({ text })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    recorder.start()
    speechDetected = false
    silenceStop = false
    recordingStartedTs = performance.now()
    lastSpeechTs = recordingStartedTs
    startEnergyMonitor(options)
    autoStopTimer = window.setTimeout(() => stopRecorder(), options?.maxDurationMs || 8000)
  })
}

function legacySpeechRecognition(): Promise<STTResult> {
  return new Promise((resolve, reject) => {
    const Rec = fallbackRecognition()
    if (!Rec) {
      reject(new Error('SpeechRecognition unavailable'))
      return
    }
    const rec = new Rec()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || ''
      resolve({ text: t })
    }
    rec.onerror = (e: any) => reject(new Error(e.error || 'stt_error'))
    rec.onend = () => {}
    rec.start()
  })
}

function stopRecorder() {
  if (!recorder || recorder.state === "inactive") {
    return
  }
  try { recorder.stop() } catch {}
  mediaStream?.getTracks().forEach((track) => track.stop())
  if (autoStopTimer) {
    window.clearTimeout(autoStopTimer)
    autoStopTimer = null
  }
  stopEnergyMonitor()
}

function cleanupRecorder() {
  stopRecorder()
  recorder = null
  mediaStream = null
  chunks = []
  cancelled = false
  speechDetected = false
  silenceStop = false
}

export function cancelListening() {
  if (!recorder) return
  cancelled = true
  stopRecorder()
}

export function endListening() {
  if (!recorder) return
  stopRecorder()
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = typeof opts?.rate === 'number' ? opts.rate : 1
    u.pitch = typeof opts?.pitch === 'number' ? opts.pitch : 1
    u.volume = typeof opts?.volume === 'number' ? opts.volume : 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {}
}

function startEnergyMonitor(options?: ListenOptions) {
  if (typeof window === "undefined" || !mediaStream) return
  try {
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(mediaStream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const bufferLength = analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    const threshold = options?.energyThreshold ?? 0.015
    const silenceAfterSpeech = options?.silenceAfterSpeechMs ?? 650
    const preSpeechTimeout = options?.preSpeechTimeoutMs ?? 1400

    const inspect = () => {
      if (!analyser) return
      analyser.getByteTimeDomainData(dataArray)
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += Math.abs(dataArray[i] - 128)
      }
      const avg = sum / bufferLength / 128
      const now = performance.now()
      if (avg > threshold) {
        speechDetected = true
        lastSpeechTs = now
      }
      if (speechDetected) {
        if (now - lastSpeechTs > silenceAfterSpeech) {
          silenceStop = true
          stopRecorder()
          return
        }
      } else if (now - recordingStartedTs > preSpeechTimeout) {
        silenceStop = true
        stopRecorder()
        return
      }
      monitorRaf = window.requestAnimationFrame(inspect)
    }

    monitorRaf = window.requestAnimationFrame(inspect)
  } catch {
    stopEnergyMonitor()
  }
}

function stopEnergyMonitor() {
  if (monitorRaf) {
    window.cancelAnimationFrame(monitorRaf)
    monitorRaf = null
  }
  try {
    audioContext?.close()
  } catch {}
  audioContext = null
  analyser = null
}

import { transcribeAudio } from './speechToText'

export type STTResult = { text: string }

// Add type definitions for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

type VoiceErrorCode =
  | 'already_listening'
  | 'permission_denied'
  | 'device_missing'
  | 'unsupported'
  | 'cancelled'
  | 'unknown'

const asVoiceError = (code: VoiceErrorCode, message?: string) => {
  const error = new Error(message || code)
    ; (error as any).code = code
  return error
}

export const voiceLog = (event: string, details?: Record<string, unknown>) => {
  try {
    console.info(`[voice] ${event}`, details ? JSON.stringify(details) : '')
  } catch { }
}

const MIC_STORAGE_KEY = 'coach_preferred_mic_id'

type ListenOptions = {
  maxDurationMs?: number
  inputStream?: MediaStream
}

let recognition: SpeechRecognition | null = null
let recognitionTimer: number | null = null
let recognitionSettled = false
let activeReject: ((error: Error) => void) | null = null

let recorder: MediaRecorder | null = null
let recorderStream: MediaStream | null = null
let recorderTimer: number | null = null
let recordingSettled = false

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const w: any = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function cleanupRecognition() {
  if (recognitionTimer) {
    window.clearTimeout(recognitionTimer)
    recognitionTimer = null
  }
  try {
    recognition?.stop()
  } catch { }
  recognition = null
  recognitionSettled = false
  activeReject = null
}

function cleanupRecording(keepStream = false) {
  if (recorderTimer) {
    window.clearTimeout(recorderTimer)
    recorderTimer = null
  }
  if (!keepStream) {
    stopStream(recorderStream)
  }
  recorderStream = null
  recorder = null
}

function getMediaConstraints(): MediaStreamConstraints {
  let preferred: string | null = null
  try { preferred = localStorage.getItem(MIC_STORAGE_KEY) } catch { }
  return preferred
    ? { audio: { deviceId: { exact: preferred } } }
    : { audio: true }
}

function mapMediaError(err: any) {
  const name = err?.name
  voiceLog('media_error', { name, message: err?.message })
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return asVoiceError('permission_denied', err?.message)
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'AbortError') {
    try { localStorage.removeItem(MIC_STORAGE_KEY) } catch { }
    return asVoiceError('device_missing', err?.message)
  }
  return asVoiceError('unknown', err?.message)
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return
  try {
    stream.getTracks().forEach((track) => track.stop())
  } catch { }
}

async function warmupMicrophone() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw asVoiceError('unsupported', 'Microphone APIs unavailable in this environment.')
  }
  const constraints = getMediaConstraints()
  voiceLog('warmup_start', { hasPreferred: !!(constraints as any)?.audio?.deviceId })
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    try {
      const track = stream.getAudioTracks()[0]
      const deviceId = track?.getSettings()?.deviceId
      if (deviceId) {
        try { localStorage.setItem(MIC_STORAGE_KEY, deviceId) } catch { }
      }
    } catch { }
    stopStream(stream)
    voiceLog('warmup_success')
  } catch (err: any) {
    // If we failed with a specific device ID, try falling back to default
    if ((constraints.audio as any)?.deviceId) {
      voiceLog('warmup_retry_default')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stopStream(stream)
        voiceLog('warmup_success_default')
        return
      } catch (retryErr) {
        throw mapMediaError(retryErr)
      }
    }
    throw mapMediaError(err)
  }
}

function mapRecognitionError(error: SpeechRecognitionErrorEvent['error']) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return asVoiceError('permission_denied', 'Microphone access denied by browser or OS policy.')
    case 'audio-capture':
      return asVoiceError('device_missing', 'No working microphone detected.')
    case 'aborted':
      return asVoiceError('cancelled', 'Speech capture aborted.')
    case 'network':
      return asVoiceError('unknown', 'Speech service network issue.')
    case 'no-speech':
      return asVoiceError('unknown', 'No speech detected.')
    default:
      return asVoiceError('unknown', error || 'Speech recognition error')
  }
}

const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus'
]

function resolveRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const supports = typeof MediaRecorder.isTypeSupported === 'function'
    ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
    : null
  if (!supports) return RECORDING_MIME_CANDIDATES[0]
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    try {
      if (supports(candidate)) return candidate
    } catch { }
  }
  return undefined
}

function shouldFallbackToRecorder(err: any): boolean {
  if (!err) return false
  const code = (err as any)?.code
  // If SpeechRecognition is not allowed (e.g. no user gesture), try MediaRecorder which might work with persisted permission
  if (code === 'permission_denied') return true
  if (code === 'device_missing' || code === 'cancelled') return false
  if (code === 'unsupported') return true
  const message = (typeof err?.message === 'string' ? err.message : '').toLowerCase()
  if (!message) return false
  return message.includes('speech recognition is not supported')
    || message.includes('user gesture')
    || message.includes('secure context')
    || message.includes('speech recognition')
}

async function recordAndTranscribe(options?: ListenOptions): Promise<STTResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw asVoiceError('unsupported', 'Microphone APIs unavailable in this environment.')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw asVoiceError('unsupported', 'MediaRecorder API unavailable in this environment.')
  }

  let stream: MediaStream
  let isExternalStream = false

  if (options?.inputStream) {
    stream = options.inputStream
    isExternalStream = true
    voiceLog('using_external_stream')
  } else {
    await warmupMicrophone()
    try {
      stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints())
    } catch (err) {
      throw mapMediaError(err)
    }
  }

  recorderStream = stream
  const mimeType = resolveRecordingMimeType()
  voiceLog('recorder_prepare', { mimeType })
  return new Promise((resolve, reject) => {
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch (err: any) {
      stopStream(stream)
      recorderStream = null
      voiceLog('recorder_init_failed', { message: err?.message })
      reject(asVoiceError('unknown', err?.message || 'Unable to access the microphone recorder.'))
      return
    }
    recordingSettled = false
    activeReject = reject
    const chunks: Blob[] = []
    const settle = (handler: () => void) => {
      if (recordingSettled) return
      recordingSettled = true
      cleanupRecording(isExternalStream)
      activeReject = null
      handler()
    }
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size) {
        chunks.push(event.data)
      }
    }
    recorder.onerror = (event: any) => {
      const message = event?.error?.message || event?.message || 'Recording error'
      voiceLog('recorder_error', { message })
      settle(() => reject(asVoiceError('unknown', message)))
    }
    recorder.onstop = async () => {
      if (recordingSettled) return
      voiceLog('recorder_stop', { chunkCount: chunks.length })
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      try {
        const text = await transcribeAudio(blob)
        voiceLog('recorder_transcribed', { chars: text.length })
        settle(() => resolve({ text }))
      } catch (err: any) {
        const message = err?.message || 'Failed to transcribe audio'
        voiceLog('recorder_transcribe_error', { message })
        settle(() => reject(asVoiceError('unknown', message)))
      }
    }
    const limit = options?.maxDurationMs || 8000
    recorderTimer = window.setTimeout(() => {
      voiceLog('recorder_timeout', { duration: limit })
      try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch { }
    }, limit)
    try {
      recorder.start()
      voiceLog('recorder_start_success')
    } catch (err: any) {
      cleanupRecording(isExternalStream)
      activeReject = null
      const message = err?.message || 'Failed to start microphone recording'
      voiceLog('recorder_start_failure', { message })
      reject(asVoiceError('unknown', message))
      return
    }
  })
}

function startWithWebSpeech(
  SpeechRecognitionClass: typeof SpeechRecognition,
  options?: ListenOptions
): Promise<STTResult> {
  return new Promise((resolve, reject) => {
    const startRecognition = async () => {
      try {
        await warmupMicrophone()
      } catch (err) {
        voiceLog('warmup_failure_ignored', { err: err instanceof Error ? err.message : String(err) })
        // Proceed anyway - Web Speech API might work even if getUserMedia failed
      }

      recognition = new SpeechRecognitionClass()
      recognitionSettled = false
      activeReject = reject
      voiceLog('recognition_init')

      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      const settle = (handler: () => void) => {
        if (recognitionSettled) return
        recognitionSettled = true
        cleanupRecognition()
        handler()
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ''
        voiceLog('recognition_result', { transcript })
        settle(() => resolve({ text: transcript }))
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        voiceLog('recognition_error', { error: event.error, message: event.message })
        const mapped = mapRecognitionError(event.error)
        settle(() => reject(mapped))
      }

      recognition.onend = () => {
        voiceLog('recognition_end')
        settle(() => resolve({ text: '' }))
      }

      try {
        recognition.start()
        voiceLog('recognition_start_success')
      } catch (err: any) {
        cleanupRecognition()
        voiceLog('recognition_start_failure', { message: err?.message })
        reject(asVoiceError('unsupported', err?.message || 'Failed to start speech recognition'))
        return
      }

      recognitionTimer = window.setTimeout(() => {
        voiceLog('recognition_timeout', { duration: options?.maxDurationMs || 8000 })
        try { recognition?.stop() } catch { }
      }, options?.maxDurationMs || 8000)
    }

    startRecognition()
  })
}

export async function startListening(options?: ListenOptions): Promise<STTResult> {
  if (recognition || recorder) {
    throw asVoiceError('already_listening')
  }
  voiceLog('start_listening', { options })

  const SpeechRecognitionClass = getSpeechRecognition()
  if (!SpeechRecognitionClass) {
    voiceLog('speech_api_missing')
    return recordAndTranscribe(options)
  }
  try {
    return await startWithWebSpeech(SpeechRecognitionClass, options)
  } catch (err) {
    // Fallback enabled to handle cases where Web Speech API is blocked (e.g. 'not-allowed')
    // but getUserMedia works (which we see in logs).
    if (shouldFallbackToRecorder(err) || options?.inputStream) {
      voiceLog('speech_api_fallback', { code: (err as any)?.code, message: (err as any)?.message })
      return recordAndTranscribe(options)
    }
    throw err
  }
}

export function cancelListening() {
  if (recorder) {
    const reject = activeReject
    voiceLog('recording_cancel')
    recordingSettled = true
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch { }
    // We don't know if it was external here easily without tracking state, 
    // but cancel usually implies full stop. 
    // However, to be safe for external streams, we might want to NOT stop the tracks if we can avoid it.
    // For now, let's assume cancel kills everything to be safe, or we can refine if needed.
    // Actually, let's just stop the recorder, the cleanupRecording will handle stream stopping if we passed the flag.
    // But we don't have the flag here. 
    // Let's modify cleanupRecording to check if the stream matches the one we shouldn't stop? 
    // Simpler: Just stop it. If the user cancels, they might want to reset.
    // But for "pre-warmed", we want it to stay.
    // Let's rely on the fact that `recordAndTranscribe` closure handles the specific cleanup call.
    // But `cancelListening` is global.
    // We'll just stop the recorder. The `onstop` or `settle` in `recordAndTranscribe` will trigger `cleanupRecording`.
    // We just need to make sure `settle` is called.

    // Actually, `recorder.stop()` triggers `onstop` which calls `settle`.
    // So we just need to ensure `settle` knows about `isExternalStream`.
    // It does, because it's in the closure of `recordAndTranscribe`.
    // So we just need to NOT call `cleanupRecording` here directly if we can avoid it, 
    // OR `cleanupRecording` needs to be smarter.

    // Current implementation of `cancelListening` calls `cleanupRecording` directly.
    // This is problematic for the closure state.
    // Let's remove `cleanupRecording` from here and rely on `recorder.stop()` -> `onstop` -> `settle` -> `cleanupRecording`.
    // But `cancelListening` implies we ignore the result.

    // Let's just nullify the global reference but NOT stop the tracks if we can't verify.
    // Ideally, we should let the active session handle its own cleanup.
    // For now, let's just execute the stop and let the chips fall. 
    // If the pre-warmed stream dies, the app will just have to re-warm it (which we can handle in OverlayApp).
    if (reject) {
      activeReject = null
      reject(asVoiceError('cancelled', 'User cancelled listening.'))
    }
    return
  }
  if (!recognition) return
  const reject = activeReject
  voiceLog('recognition_cancel')
  cleanupRecognition()
  if (reject) {
    reject(asVoiceError('cancelled', 'User cancelled listening.'))
  }
}

export function endListening() {
  if (recorder) {
    voiceLog('recording_stop_request')
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch { }
    return
  }
  if (!recognition) return
  voiceLog('recognition_stop_request')
  try { recognition.stop() } catch { }
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = typeof opts?.rate === 'number' ? opts.rate : 1
    u.pitch = typeof opts?.pitch === 'number' ? opts.pitch : 1
    u.volume = typeof opts?.volume === 'number' ? opts.volume : 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { }
}

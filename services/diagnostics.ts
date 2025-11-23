import { RAG_CONFIG } from "../config/ragConfig"
import * as geminiService from "./geminiFileSearch"

export type DiagnosticId =
  | "api_key"
  | "overwolf_runtime"
  | "overlay_enabled"
  | "hotkeys"
  | "microphone_permission"
  | "speech_stack"
  | "rag_store"

export type DiagnosticStatus = "pending" | "pass" | "warn" | "fail"

export interface DiagnosticResult {
  id: DiagnosticId
  label: string
  status: DiagnosticStatus
  detail: string
  suggestion?: string
  blocking?: boolean
}

const VALORANT_ID = 21640
const REQUIRED_HOTKEYS = ["voice_command", "toggle_settings"]

const pass = (id: DiagnosticId, label: string, detail: string, blocking = true): DiagnosticResult => ({
  id,
  label,
  status: "pass",
  detail,
  blocking
})

const warn = (
  id: DiagnosticId,
  label: string,
  detail: string,
  suggestion?: string,
  blocking = false
): DiagnosticResult => ({
  id,
  label,
  status: "warn",
  detail,
  suggestion,
  blocking
})

const fail = (
  id: DiagnosticId,
  label: string,
  detail: string,
  suggestion?: string,
  blocking = true
): DiagnosticResult => ({
  id,
  label,
  status: "fail",
  detail,
  suggestion,
  blocking
})

function getOverwolf(): any | null {
  if (typeof window === "undefined") return null
  return (window as any).overwolf || null
}

async function checkApiKey(): Promise<DiagnosticResult> {
  try {
    const key = typeof import.meta !== "undefined"
      ? ((import.meta as any)?.env?.VITE_GEMINI_API_KEY || "")
      : ""
    if (key) {
      return pass("api_key", "Gemini API Key", "Key detected in .env.local")
    }
    return fail(
      "api_key",
      "Gemini API Key",
      "VITE_GEMINI_API_KEY is missing.",
      "Add your key to .env.local and restart Overwolf."
    )
  } catch (err: any) {
    return fail(
      "api_key",
      "Gemini API Key",
      err?.message || "Unable to read API key.",
      "Ensure VITE_GEMINI_API_KEY is defined."
    )
  }
}

async function checkOverwolfRuntime(): Promise<DiagnosticResult> {
  const ow = getOverwolf()
  if (ow) {
    return pass("overwolf_runtime", "Overwolf Runtime", "Detected")
  }
  return fail(
    "overwolf_runtime",
    "Overwolf Runtime",
    "Not running inside Overwolf.",
    "Launch the desktop window through Overwolf's dev console.",
    true
  )
}

async function checkOverlayEnabled(): Promise<DiagnosticResult> {
  const ow = getOverwolf()
  if (!ow?.settings?.games?.getOverlayEnabled) {
    return warn(
      "overlay_enabled",
      "Overlay Toggle",
      "Cannot query overlay status outside of Overwolf.",
      "Open Overwolf > Library > Valorant and ensure overlay is enabled.",
      false
    )
  }
  const enabled = await new Promise<boolean>((resolve) => {
    try {
      ow.settings.games.getOverlayEnabled(VALORANT_ID, (res: any) => {
        resolve(!!res?.enabled)
      })
    } catch {
      resolve(false)
    }
  })
  return enabled
    ? pass("overlay_enabled", "Overlay Toggle", "Enabled for Valorant")
    : fail(
        "overlay_enabled",
        "Overlay Toggle",
        "Valorant overlay is disabled.",
        "Enable the overlay in Overwolf settings so the HUD can appear."
      )
}

async function fetchHotkeys(): Promise<Record<string, string>> {
  const ow = getOverwolf()
  if (!ow?.settings?.hotkeys?.get) {
    throw new Error("Hotkey API unavailable")
  }
  return await new Promise((resolve, reject) => {
    try {
      ow.settings.hotkeys.get((res: any) => {
        if (!res?.success) {
          reject(new Error(res?.error || res?.reason || "Unable to fetch hotkeys"))
          return
        }
        const list: any[] = Array.isArray(res.hotkeys)
          ? res.hotkeys
          : [
              ...(Array.isArray(res.globals) ? res.globals : []),
              ...(Array.isArray(res.games?.[VALORANT_ID]) ? res.games[VALORANT_ID] : [])
            ]
        const map: Record<string, string> = {}
        for (const hk of list) {
          const name = hk?.name
          const binding = hk?.binding || hk?.hotkey
          if (name && binding) {
            map[name] = binding
          }
        }
        resolve(map)
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function checkHotkeys(): Promise<DiagnosticResult> {
  try {
    const map = await fetchHotkeys()
    const missing = REQUIRED_HOTKEYS.filter((k) => !map[k])
    if (!missing.length) {
      return pass("hotkeys", "Voice + Settings Hotkeys", "All required hotkeys are bound")
    }
    return fail(
      "hotkeys",
      "Voice + Settings Hotkeys",
      `Missing: ${missing.join(", ")}`,
      "Assign the bindings inside Overwolf > Settings > Hotkeys."
    )
  } catch (err: any) {
    return warn(
      "hotkeys",
      "Voice + Settings Hotkeys",
      err?.message || "Unable to query hotkey status.",
      "Open Overwolf and verify hotkeys manually.",
      false
    )
  }
}

async function checkMicrophonePermission(): Promise<DiagnosticResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return warn(
      "microphone_permission",
      "Microphone",
      "Microphone APIs unavailable in this environment.",
      "Run inside Overwolf or a secure context.",
      true
    )
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    try {
      stream.getTracks().forEach((track) => track.stop())
    } catch {}
    return pass("microphone_permission", "Microphone", "Permission granted and audio device detected")
  } catch (err: any) {
    const name = err?.name || ""
    if (name === "NotAllowedError" || name === "SecurityError") {
      return fail(
        "microphone_permission",
        "Microphone",
        "Access denied by Windows/Overwolf.",
        "Allow microphone access for Valorant Coach in Windows Privacy Settings."
      )
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return fail(
        "microphone_permission",
        "Microphone",
        "No working microphone detected.",
        "Plug in a microphone or pick a different device in the Desktop Settings panel."
      )
    }
    return warn(
      "microphone_permission",
      "Microphone",
      err?.message || "Unexpected microphone error.",
      "Use the mic dropdown in Desktop Settings to retry.",
      true
    )
  }
}

async function checkSpeechStack(): Promise<DiagnosticResult> {
  const hasSpeechRecognition = typeof window !== "undefined" &&
    !!(((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition))
  const hasRecorder = typeof MediaRecorder !== "undefined"

  if (hasSpeechRecognition || hasRecorder) {
    const detail = hasSpeechRecognition
      ? "Web Speech API detected"
      : "SpeechRecognition missing, falling back to MediaRecorder"
    return pass("speech_stack", "Voice Stack", detail)
  }
  return fail(
    "speech_stack",
    "Voice Stack",
    "Neither SpeechRecognition nor MediaRecorder is available.",
    "Update your browser runtime or enable the Overwolf Chromium experimental build."
  )
}

async function checkRagStore(): Promise<DiagnosticResult> {
  if (!RAG_CONFIG.defaultStoreId) {
    return warn(
      "rag_store",
      "RAG Store",
      "No default store configured in ragConfig.ts",
      "Set VITE_RAG_STORE_ID or update RAG_CONFIG.defaultStoreId.",
      true
    )
  }
  try {
    geminiService.initialize()
    await geminiService.listDocuments(RAG_CONFIG.defaultStoreId)
    return pass("rag_store", "RAG Store", "Reached Gemini store successfully")
  } catch (err: any) {
    const message = err?.message || "Unable to reach Gemini store"
    return fail(
      "rag_store",
      "RAG Store",
      message,
      "Verify API key permissions and that the store exists in your project."
    )
  }
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const checks = [
    checkApiKey,
    checkOverwolfRuntime,
    checkOverlayEnabled,
    checkHotkeys,
    checkMicrophonePermission,
    checkSpeechStack,
    checkRagStore
  ]
  const results: DiagnosticResult[] = []
  for (const check of checks) {
    try {
      const result = await check()
      results.push(result)
    } catch (err: any) {
      results.push(
        fail(
          "overwolf_runtime",
          "Overwolf Runtime",
          err?.message || "Unexpected diagnostic failure.",
          "Reload the desktop window and retry tests."
        )
      )
      break
    }
  }
  return results
}

export function countBlockingFailures(items: DiagnosticResult[]): number {
  return items.filter((item) => item.status === "fail" && item.blocking !== false).length
}

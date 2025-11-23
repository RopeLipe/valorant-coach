import React from "react"
import type { DiagnosticResult } from "../services/diagnostics"

interface DiagnosticsChecklistProps {
  title?: string
  description?: string
  items: DiagnosticResult[]
  running?: boolean
  onRun?: () => void | Promise<void>
  variant?: "card" | "panel"
  showAction?: boolean
}

const statusStyles: Record<DiagnosticResult["status"], { label: string; dot: string; text: string }> = {
  pass: { label: "Ready", dot: "bg-white", text: "text-white" },
  warn: { label: "Needs attention", dot: "bg-white/60", text: "text-white/60" },
  fail: { label: "Blocked", dot: "bg-white/40", text: "text-white/40" },
  pending: { label: "Pending", dot: "bg-white/20", text: "text-white/40" }
}

export default function DiagnosticsChecklist({
  title = "Startup Checklist",
  description = "Run quick tests to verify voice, overlay, and data access before launching the coach.",
  items,
  running,
  onRun,
  variant = "card",
  showAction = true
}: DiagnosticsChecklistProps) {
  const containerClasses =
    variant === "card"
      ? "rounded-2xl border border-white/15 bg-white/5 p-5 shadow-lg"
      : "rounded-2xl border border-white/10 bg-black/30 p-4"

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="text-xs text-white/60 mt-1 leading-relaxed">{description}</p>}
        </div>
        {showAction && onRun && (
          <button
            onClick={() => onRun()}
            disabled={running}
            className="px-3 py-1.5 text-xs rounded-full border border-white/30 text-white hover:bg-white/10 disabled:opacity-50"
          >
            {running ? "Testing…" : "Run Tests"}
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {(items.length ? items : defaultPlaceholders).map((item) => {
          const meta = statusStyles[item.status]
          return (
            <li key={item.id} className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${meta.dot}`} aria-hidden />
              <div className="text-sm text-white/90">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className={`text-[11px] uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                </div>
                {item.detail && <p className="text-xs text-white/70 mt-0.5">{item.detail}</p>}
                {item.suggestion && <p className="text-[11px] text-white/50 mt-0.5">{item.suggestion}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const defaultPlaceholders: DiagnosticResult[] = [
  { id: "api_key", label: "Gemini API Key", status: "pending", detail: "Awaiting diagnostics." },
  { id: "microphone_permission", label: "Microphone", status: "pending", detail: "Awaiting diagnostics." },
  { id: "hotkeys", label: "Voice Hotkey", status: "pending", detail: "Awaiting diagnostics." }
]

/**
 * Telemetry Service
 * Lightweight, opt-in event sink. Buffers events in-memory and optionally
 * forwards to a user-configured webhook URL stored in localStorage.
 *
 * Nothing PII here — only coaching events + crash metadata. Users can set
 * `coach_telemetry_webhook` in localStorage to a URL of their choosing to
 * receive events; otherwise everything stays local.
 */

const WEBHOOK_KEY = 'coach_telemetry_webhook'
const OPTOUT_KEY = 'coach_telemetry_optout'
const MAX_BUFFER = 200

export type TelemetryEvent = {
    t: number            // timestamp
    scope: string        // event namespace: ai, tracker, phase, ui, crash, cost
    name: string         // event name
    props?: Record<string, any>
}

const buffer: TelemetryEvent[] = []

function optedOut(): boolean {
    try { return localStorage.getItem(OPTOUT_KEY) === '1' } catch { return false }
}

function webhook(): string | null {
    try { return localStorage.getItem(WEBHOOK_KEY) || null } catch { return null }
}

export function track(scope: string, name: string, props?: Record<string, any>): void {
    if (optedOut()) return
    const ev: TelemetryEvent = { t: Date.now(), scope, name, props }
    buffer.push(ev)
    if (buffer.length > MAX_BUFFER) buffer.shift()
    forward(ev)
}

async function forward(ev: TelemetryEvent) {
    const url = webhook()
    if (!url) return
    try {
        // Fire-and-forget; no await chain in callers
        fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(ev),
            keepalive: true,
        }).catch(() => { })
    } catch { }
}

export function reportCrash(scope: string, err: Error, componentStack?: string): void {
    track('crash', scope, {
        message: err?.message?.slice(0, 500),
        stack: err?.stack?.slice(0, 1500),
        componentStack: componentStack?.slice(0, 1500),
        ua: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 200) : undefined,
    })
}

export function getBuffer(): ReadonlyArray<TelemetryEvent> {
    return buffer
}

export function clearBuffer(): void {
    buffer.length = 0
}

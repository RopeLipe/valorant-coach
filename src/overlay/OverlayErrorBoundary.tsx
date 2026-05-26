import React from 'react'
// Telemetry is optional and dynamically imported so the boundary still works
// even if the telemetry module fails to load.
async function reportCrashSafely(scope: string, err: Error, componentStack?: string) {
  try {
    const mod = await import('../../services/telemetry')
    mod.reportCrash(scope, err, componentStack)
  } catch { }
}

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message: string }

/**
 * Minimal error boundary for the in-game overlay. A thrown error inside
 * any render subtree (e.g. parseRichText in InGameOverlay) would otherwise
 * crash the whole HUD. We fall back to a tiny status dot so the player still
 * sees SOMETHING and can hot-reload the overlay.
 */
export class OverlayErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Overlay crashed' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportCrashSafely('overlay', error, info.componentStack || undefined)
    try { console.error('[Overlay] Error boundary caught:', error, info) } catch { }
  }

  handleReload = () => {
    try { window.location.reload() } catch { }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(239,68,68,0.4)',
        color: 'white',
        font: '11px/1.4 system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} />
        <span>Coach overlay crashed</span>
        <button
          onClick={this.handleReload}
          style={{
            marginLeft: 4,
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}

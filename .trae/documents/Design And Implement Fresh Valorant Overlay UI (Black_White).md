## Core Direction
- Build a brand‑new in‑game overlay from scratch (no reuse of the web/desktop markup).
- Visual style: modern black/white, rounded, glass/blur accents, thin high‑contrast borders, subtle shadows; no large panels, no chat box.
- Behaviors: short, actionable suggestions; transient alerts; key‑cap pills (e.g., N, Caps) embedded in text; minimal footprint in a top corner.

## Windows & App Structure
- Create a dedicated `overlay` window in the manifest (separate HTML file) that is:
  - `transparent`, `in_game_only`, `always_on_top`, not shown in taskbar
  - Sized ~380–420px wide; height dynamic based on content
- Desktop window: settings + preview only (no large chat UI rendered in-game).

## Overlay Components
- `OverlayShell`: places the bubble card in the chosen corner; reads safe‑area offsets.
- `SuggestionDeck`: rotates 1–2 concise suggestions (AI-backed), click to expand details.
- `AlertToastList`: lightweight 2–3s alerts (e.g., spike planted, low credits) with queue and rate limit.
- `KeyPill`: renders single-letter keys in high-contrast rounded chips.
- `VoiceIndicator`: subtle mic pulse when STT active.

## Data & Logic
- Event Bridge: map Overwolf GEP (round phase, spike, kill/death, credits) to overlay actions.
- AI Service: wrap Gemini File Search to request concise outputs; normalize line breaks; cache recent suggestions to avoid repeats.
- Rate limiting: max 1 suggestion every 5–8s; alerts queue limited to 3, dedupe by category.

## Styling & Motion
- Theme tokens: black/white palette, border radius, shadow, blur; consistent spacing.
- Animations: small slide/fade for bubble entrance/exit; pulse for mic; key‑pill highlight.
- Performance budget: transform/opacity‑only animations; update on events, not timers; keep repaint low.

## Settings (Desktop)
- Overlay Preview pane with live corner, opacity, scale, blur toggles.
- Category toggles (buy, retake, micro‑tips, spike alerts).
- Hotkey binding for overlay toggle and "Ask AI" quick prompt.

## Compliance & UX
- Respect Overwolf overlay guidance: do not cover important UI; overlay easily dismissible; minimal presence during active play.
- FPS exclusive mode support: use exclusive keyboard/mouse events when interacting; notify users if exclusive mode disabled.

## Implementation Plan
1. Add a new `overlay.html` and `OverlayShell` TSX (no web/desktop dependencies).
2. Build SuggestionDeck + KeyPill with compact layout; wire to AI service.
3. Implement AlertToastList with rate limiting and dedupe.
4. Integrate Event Bridge to drive suggestions/alerts from Valorant events.
5. Add Desktop Settings & Preview and persist prefs.
6. QA: verify behavior in borderless fullscreen, multi‑resolution, safe‑area checks.

## Deliverables
- Clean overlay window with animated suggestion bubbles, key pills, and transient alerts.
- Desktop settings with preview and controls (corner, opacity, categories).
- Updated manifest and background positioning logic aligned to overlay prefs.

## Acceptance Criteria
- Overlay appears top‑left/right with modern black/white style; no chat UI in-game.
- Suggestions and alerts are concise, readable, animated, and rate‑limited.
- Desktop provides clear, minimal settings; in-game overlay remains non‑intrusive.

Confirm and I’ll implement this new overlay window, components, styles, event mapping, and settings, replacing all residual web/desktop markup influence in the in‑game experience.
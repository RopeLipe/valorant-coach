## Goals
- Create a modern, clean, non‑distracting in‑game overlay anchored top‑left or top‑right that surfaces context‑aware suggestions and alerts.
- Improve out‑of‑game desktop UX to configure overlay behavior, view stats, and preview styles.
- Maintain Overwolf compliance: never block core game UI, respectful timing, exclusive mode support for FPS.

## In‑Game Overlay Design
- Compact corner HUD: 320–420px width, 90–140px height baseline; auto-expands for queued messages.
- Black/white theme with strong contrast, rounded corners, thin black borders, subtle shadow; opacity adjustable (70–100%).
- Content blocks:
  - Suggestion Deck: 1–2 short actionable lines, rotating every 6–10s only when relevant.
  - Alert Toasts: transient messages (2–3s) for high‑priority events (e.g., spike planted, kill, low credits).
  - Voice Hint: small mic icon with animated pulse when STT active.
- Interaction: hover to expand; click to pin/unpin a suggestion; right‑click menu to dismiss/disable category; hotkey to toggle visibility.
- Placement: top‑left or top‑right selectable; safe area offsets to avoid minimap/scoreboard.

## Overlay Content Logic
- Event mapping (Overwolf GEP → suggestions):
  - Round phase: shopping → buy recommendations; round_start → opening positions.
  - Combat events: kill/death → immediate micro‑tips; spike_planted/defused → post‑plant/retake advice.
  - Match info: map/mode → map‑specific callouts.
- AI integration:
  - Use Gemini File Search for short, grounded suggestions with strict 2–3 sentence limit.
  - Cache last N suggestions per context to avoid repeat.
- Rate limiting: max 1 suggestion per 5s, alerts stack with a visible queue (limit 3), drop/merge duplicates.

## Desktop UX (Out‑of‑Game)
- Dashboard cards with black/white style already in place; add:
  - Overlay Preview: live simulation pane to test top‑left/right position, opacity, scale.
  - Settings: toggles for categories (buy/retake/micro‑tips), hotkeys rebinding, opacity/scale sliders, corner selection.
  - Error/health: show Gemini key presence, RAG store status, event health notice.

## Technical Implementation
- New overlay component tree (replace current roster‑focused view):
  - `OverlayRoot` (positioning, visibility, scale, theme)
  - `SuggestionDeck` (rotating items, pinning)
  - `AlertToastList` (queued ephemeral alerts)
  - `VoiceIndicator` (STT/TTS status)
  - `SafeArea` helper (minimap/scoreboard avoidance)
- State/data:
  - `overlayStore`: context state, queue, rate limiter, user prefs.
  - `eventBridge`: transforms GEP events to normalized actions.
  - `aiService`: wraps `services/geminiFileSearch.fileSearch` with caching & timeouts.
- Files to modify:
  - `overlay/OverlayHUD.tsx` → replace with `OverlayRoot` & children (current scaffold: c:\Users\Z1n3x\Downloads\valorant-coach\overlay\OverlayHUD.tsx:27–75).
  - `App.tsx` → keep event forwarding; add overlay preference handling and onPrompt route (c:\Users\Z1n3x\Downloads\valorant-coach\App.tsx:88–134, 228–237).
  - `manifest.json` → ensure `main` window uses exclusive mode for FPS and proper size/position; keep hotkeys (c:\Users\Z1n3x\Downloads\valorant-coach\manifest.json:19–25, 49–65).
  - `background.ts` → no functional change; verify show/hide behavior on game detection (c:\Users\Z1n3x\Downloads\valorant-coach\background.ts:115–127).
  - Desktop `src/desktop` → add Settings & Preview pages hooking to overlay prefs.

## Compliance & UX Guidelines
- Follow Overwolf in‑game window guidelines: overlays must not cover essential UI, be dismissible, and avoid disruptive timing.
- Default to minimal opacity and limited display time; no ads in active gameplay per guidelines.
- Respect exclusive mode requirements for Valorant (FPS interactions through hotkeys).

## Performance Targets
- Render budget: <5ms per update; use requestAnimationFrame for animations.
- Debounce event bursts; compute AI prompts off main thread where possible; cache AI results.
- Avoid timers faster than 250ms; use event‑driven updates.

## Testing Plan
- In‑game behavior: toggle overlay, verify no UI blocking, safe area offsets, hotkey responsiveness.
- Event accuracy: simulate shopping/kill/spike events; assert category suggestions.
- Standby mode: overlay hidden or minimal when out of game.
- Error states: missing API key → desktop settings highlight and disable AI prompts.

## Milestones
1. Overlay scaffolding & placement control (top‑left/right, opacity/scale).
2. Event bridge & rate‑limited suggestion/alert queues.
3. AI prompt wrappers with caching; grounded, concise outputs.
4. Desktop Settings & Preview integration.
5. Compliance review & polish (animations, dismiss behavior).
6. QA across resolutions; finalize.

## Deliverables
- New overlay UI with Suggestion/Alert system.
- Desktop settings panel with preview and customization.
- Updated manifest/window behavior that meets Overwolf guidelines.

Confirm this plan and I’ll implement the overlay components, settings, and integrations in the codebase accordingly.
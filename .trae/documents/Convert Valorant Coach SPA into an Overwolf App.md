## Overview
- Wrap the existing React + Vite Valorant Coach into an Overwolf Native desktop overlay app.
- Keep current AI/RAG logic (`@google/genai` with File Search) and UI, add Overwolf windows + game event integration for Valorant.

## Fit With Current Codebase
- Current stack: React SPA (`index.html`, `index.tsx`, `App.tsx`), admin panel, services in `services/geminiFileSearch.ts`, config in `config/ragConfig.ts`.
- No Overwolf integration yet; we will introduce the Overwolf manifest and a lightweight background window to handle game events and bridge them to the React UI.

## Target Framework & Docs
- Use Overwolf Native (HTML/JS) overlays per SDK intro.
- Key references:
  - Overwolf SDK intro
  - One-window app & CLI guide
  - Front App layout/UX guide
  - In-game overlays guide
  - `overwolf.profile` (requires `profile` permission) and `overwolf.settings.language` (optional)

## Windows & Manifest
- Create `manifest.json`:
  - `windows`:
    - `main`: points to built `dist/index.html` (chat coach overlay)
    - `admin`: optional, points to `dist/admin.html` (RAG management) not injected in-game
    - `background`: hidden window with a small script to subscribe to Valorant game events
  - `data`:
    - `permissions`: `GameEvents`, `Profile` (if using `overwolf.profile`), optional `Language`
    - `hotkeys`: toggle `main` overlay visibility (e.g., Ctrl+Alt+V)
    - `game_targeting`: Valorant app ID to auto-launch overlay when Valorant starts

## Game Detection & Events
- Background window responsibilities:
  - Detect Valorant via `overwolf.games.getRunningGameInfo` and `overwolf.games.onGameInfoUpdated`.
  - Subscribe to `overwolf.games.events` for Valorant (round phase, kills, spike events, economy changes, etc.).
  - Forward events to the `main` window using `overwolf.windows.getMainWindow()` and `window.dispatchEvent` or a shared event bus.

## AI Integration & Data Flow
- In `App.tsx` integrate an event stream:
  - Maintain a `GameContext` (current map, round, team economy, agent) fed by background events.
  - Use existing `services/geminiFileSearch.ts` to generate context-aware prompts:
    - `round_start`: buy recommendations (rifle/utility) based on team economy
    - `spike_planted`: post-plant positions and utility usage
    - `agent_ability_ready`: suggest lineups or timings
  - Surface tips in `ChatInterface.tsx` alongside existing chat; allow toggling auto-coach prompts.
- Keep `WelcomeScreen.tsx` API key flow (user provides their Gemini key) to avoid shipping secrets.

## UX Overlay Behavior
- Follow Front App guide for in-game UX:
  - Draggable overlay with preset positions and snap zones
  - Click-through toggle and opacity control
  - Minimal footprint during intense moments; expand on hotkey
  - Respect safe areas to avoid HUD conflicts

## Settings & Profile (Optional)
- `overwolf.profile` to personalize greetings, store user ID for local preferences.
- `overwolf.settings.language` to align UI language with Overwolf’s setting if needed.

## Build & Packaging
- Vite `build` outputs to `dist/` (already present).
- Overwolf CLI flow:
  - Install Overwolf client and CLI
  - Point manifest to `dist/*`
  - Load unpacked app for development, test with Valorant running
  - Package for distribution when ready

## Testing Plan
- Unit: event → tip mapping functions (mock Overwolf events)
- Integration: run app via Overwolf, verify:
  - Overlay visibility toggle hotkey works
  - Event subscription/live updates work during matches
  - AI prompts are grounded to RAG sources and performant
- QA scenarios: pistol round, eco, full buy, spike plant/defuse, clutch situations

## Deliverables
- `manifest.json` with windows, permissions, hotkeys, game targeting
- `background.ts/js` to handle detection and events
- Minimal additions in `App.tsx` to consume event stream and trigger contextual tips
- Build/CLI instructions to run inside Overwolf

## Risks & Mitigations
- Performance: rate-limit AI prompts and batch events; allow user to disable auto prompts.
- Secrets: keep Gemini key user-supplied via `WelcomeScreen`; do not embed keys.
- Event coverage: start with core Valorant events; expand iteratively.

## Milestones
1. Scaffold manifest & windows; run app inside Overwolf (day 1–2)
2. Implement background events bridge; detect Valorant and subscribe (day 2–3)
3. Wire event-driven prompts into UI; initial tips (day 3–4)
4. UX polish & hotkeys; settings (day 4–5)
5. QA with live matches; package via CLI (day 5–6)

Confirm this plan to proceed with implementation (adding the manifest, background script, event bridge, and UI wiring).
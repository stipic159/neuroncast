# NeuronCast — Project Roadmap & Task Backlog

This document outlines upcoming improvements, technical debt, and feature roadmaps for the **NeuronCast** Counter-Strike 2 broadcast operations platform.

---

## 1. Match Platform Integrations & Modular Dashboard Architecture

- [ ] **Decouple Komplettligaen from Dashboard Home**:
  - Remove the hardcoded `Komplettligaen Match` widget from the main Dashboard view (`src/config/components/Dashboard.vue`).
  - Make Dashboard home platform-agnostic, showing only core match telemetry, active scoreline, and universal broadcast controls.
- [x] **Unified Tournament Platform Hub & Selector**:
  - Design a dedicated "Match Platform" section/menu in the Config SPA where operators can select the active tournament provider (e.g., None/Manual, Komplettligaen, Fastcup, FACEIT).
  - Structure the platform provider architecture modularly so new platforms can be added dynamically with their own scrapers, rosters, and bracket resolvers.
- [ ] **Fastcup Integration (`fastcup.net`)**:
  - Implement a Fastcup API/scraper service (`src/server/fastcup.js` or `src/server/integrations/fastcup.js`).
  - Allow operators to enter a Fastcup Match ID to automatically fetch:
    - Team names, rosters, avatars, and country flags.
    - Match map veto/pick sequence and series format (BO1, BO3).
  - Populate HUD team identities and player metadata directly from Fastcup game records.
  - Store offline fallback match snapshots in `userspace/cache/` to survive network disconnects during live games.
- [ ] **Stand-in Hot-Swap & Player Identity Remap**:
  - **SteamID Remapping (Smurf/Alt handling)**: In open cups and Fastcup, players frequently connect using alternate accounts. Allow operators to link an incoming GSI SteamID to a scheduled tournament profile in one click, preventing default avatars or blank player cards on-air.
  - **Local Steam Avatar Offline Caching**: Prevent missing avatars caused by Steam API rate limits mid-broadcast. Download and persist team avatars locally to `userspace/cache/avatars/` upon initial roster discovery.

---

## 2. Mobile Control Interface & Blind Ergonomics (`/remote`)

- [x] **Responsive Mobile Operator Remote (`/remote`)**:
  - Build a lightweight, touch-optimized mobile web interface accessible over local Wi-Fi (e.g., `http://<LAN-IP>:31982/remote`).
  - Tailored specifically for single-monitor casters where the primary screen is dedicated to CS2 fullscreen observation or OBS, enabling complete broadcast direction from a smartphone or tablet.
  - QR code pairing display on desktop Config SPA and terminal startup logs.
- [x] **Mobile Ergonomics & "Blind Operation" Features**:
  - **Screen Wake Lock API**: Keep phone screens awake indefinitely while the remote tab is active to eliminate unlock delays during critical clutch moments.
  - **Haptic Feedback (Web Vibration API)**: Fire subtle vibration pulses on touch presses so operators get tactile confirmation of scene switches, radar toggles, or card triggers without taking their eyes off the monitor.
  - **Low-Bandwidth Delta Socket Mode**: Instead of streaming heavy raw GSI trees every 100ms, deliver lightweight, compressed operational diffs (scores, round numbers, active flags, OBS states) to maintain instant phone responsiveness and save battery.

---

## 3. OBS Studio WebSocket v5 Bridge

- [x] **Bi-Directional OBS WebSocket Integration**:
  - Integrate `obs-websocket-js` on the Node server to connect directly to OBS Studio (WebSocket v5 protocol).
  - Auto-reconnect and monitor OBS connection state from both desktop and `/remote`.
- [x] **Direct OBS Controls on Mobile Remote**:
  - **Scene Switching**: Single-tap transitions between key OBS scenes (Match / In-Game / Break / Analysis / Caster Cam).
  - **Caster Cough / Mic Mute**: Instant toggle for observer microphone muting with clear on-screen visual mute state.
  - **Instant Replay Buffer Trigger**: One-tap trigger to save the OBS Replay Buffer on massive ACE or clutch highlights.
- [ ] **Autonomous OBS Scene Automation**:
  - Configurable auto-switch rules to transition OBS scenes automatically on CS2 game states (e.g., cut to intermission/break on match end or prolonged technical pauses).

---

## 4. Caster Notes, Tickers & Lower Third Overlays

- [x] **Quick Lower-Third Broadcast Ticker**:
  - Provide a dedicated "Lower Third / Factoid" input field on the mobile remote and Config SPA.
  - Type or paste quick analyst facts (e.g., *"s1mple 14-2 on de_mirage"*, *"Round 11 eco buy"*), hit send, and smoothly animate an unobtrusive lower-third broadcast card onto the HUD.
- [ ] **One-Tap Quick Presets**:
  - Pre-configure 1-click preset banners for tournament sponsors, caster social handles, match schedules, and next map announcements.

---

## 5. CI/CD & Release Infrastructure

- [ ] **GitHub Actions Automated Pipeline (`.github/workflows/ci.yml`)**:
  - Run `npm run test:unit` on every push and pull request.
  - Run preflight theme validation (`npm run theme:validate`).
  - Add Playwright smoke test step in headless mode (`npm run test:smoke`).
  - Add linting and JSON syntax validation for configuration and locale files.
- [ ] **Automated Offline LAN Packaging**:
  - Build a script or GitHub Release action to produce a standalone, self-contained offline distribution zip (`neuroncast-offline-vX.X.X.zip`) with all dependencies vendored for LAN tournaments lacking internet access.
- [ ] **Automated Version Bumping**:
  - Script semantic version updates across `package.json`, `package-lock.json`, and `src/version.txt`.

---

## 6. Testing, Reliability & Observability (QA & E2E)

- [ ] **Playwright Test Suite Stabilization**:
  - Verify and harden end-to-end scenarios under `tests/playwright/` (`config-smoke.spec.js`, `hud-smoke.spec.js`, `overlay-preview.spec.js`).
  - Ensure zero flakiness when running against the simulated GSI telemetry service (`scripts/gsi-simulator.js`).
- [ ] **OBS Browser Source Self-Healing**:
  - Implement a heartbeat/ping watchdog in the HUD overlay client. If the WebSocket connection drops or freezes for more than 10 seconds, trigger an internal soft refresh to recover gracefully without requiring operator action in OBS.
- [ ] **Structured Logging & Diagnostics**:
  - Migrate console logs to a structured logger with log levels (`debug`, `info`, `warn`, `error`).
  - Rotate server log files when running under PM2 or standalone mode.

---

## 7. Security & Token Governance

- [ ] **In-App Token Rotation UI**:
  - Add a dedicated "Security & Tokens" tab or modal in the Config SPA to regenerate the GSI secret token and Control-Plane authentication token with one click.
  - Automatically rewrite `gamestate_integration_neuroncast.cfg` on token regeneration without breaking CS2 bindings.
- [x] **Non-Localhost Endpoint Armor**:
  - Enforce mandatory token verification in `src/server/auth.js` for destructive write operations (cache purge, theme switching, match reset) when accessed from remote network addresses (non-loopback IPs).

---

## 8. Broadcast & Production Features

- [ ] **AI Director Runtime Integration (`neuron-director`)**:
  - Align `src/config/components/DirectorPage.vue` with the native director daemon.
  - Add visual status indicators showing whether the AI director daemon is active, standby, or in shadow mode.
  - Provide fine-grained tuning for spotlight cards (ACE, clutch, eco-frag highlights) and automatic camera cuts.
- [ ] **Theme Package Manager & Asset Validator**:
  - Implement strict preflight asset validation for custom packages in `userspace/event-packages/` (image dimension checks, sponsor logo aspect ratios, color contrast ratios).
  - Add an import/export flow for tournament bundles (themes + rosters + sponsor decks in a single archive).
- [ ] **HUD Media & 3D Render Optimization**:
  - Audit player highlight renders and WebM video playback in `src/themes/default/player-highlight/`.
  - Provide hardware-acceleration fallbacks for low-spec observer streaming rigs.

---

## 9. Developer Experience & Operator Usability

- [ ] **One-Click Windows Operator Launcher**:
  - Refine `start-neuroncast.bat` to verify Node.js runtime presence, execute preflight validation, launch the background server, and open `http://localhost:31982/config` in the default browser.
- [ ] **Comprehensive Documentation & Showcase**:
  - Update `README.md` with:
    - New NeuronCast branding and UI screenshots.
    - Quickstart installation guide and CS2 GSI configuration instructions.
    - Full list of routes (`/hud`, `/config`, `/radar`, `/operator/readiness`, `/operator/status`, `/remote`).
    - Development workflow and architecture overview.
- [ ] **Interactive Onboarding Wizard**:
  - Implement a first-run wizard in Config SPA that guides new tournament operators through CS2 GSI setup, theme selection, and OBS Browser Source configuration.

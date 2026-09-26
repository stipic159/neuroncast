# NeuronCast — Project Roadmap & Task Backlog

This document outlines upcoming improvements, technical debt, and feature roadmaps for the **NeuronCast** Counter-Strike 2 broadcast operations platform.

---

## 1. CI/CD & Release Infrastructure

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

## 2. Testing, Reliability & Observability (QA & E2E)

- [ ] **Playwright Test Suite Stabilization**:
  - Verify and harden end-to-end scenarios under `tests/playwright/` (`config-smoke.spec.js`, `hud-smoke.spec.js`, `overlay-preview.spec.js`).
  - Ensure zero flakiness when running against the simulated GSI telemetry service (`scripts/gsi-simulator.js`).
- [ ] **OBS Browser Source Self-Healing**:
  - Implement a heartbeat/ping watchdog in the HUD overlay client. If the WebSocket connection drops or freezes for more than 10 seconds, trigger an internal soft refresh to recover gracefully without requiring operator action in OBS.
- [ ] **Structured Logging & Diagnostics**:
  - Migrate console logs to a structured logger with log levels (`debug`, `info`, `warn`, `error`).
  - Rotate server log files when running under PM2 or standalone mode.

---

## 3. Security & Token Governance

- [ ] **In-App Token Rotation UI**:
  - Add a dedicated "Security & Tokens" tab or modal in the Config SPA to regenerate the GSI secret token and Control-Plane authentication token with one click.
  - Automatically rewrite `gamestate_integration_neuroncast.cfg` on token regeneration without breaking CS2 bindings.
- [ ] **Non-Localhost Endpoint Armor**:
  - Enforce mandatory token verification in `src/server/auth.js` for destructive write operations (cache purge, theme switching, match reset) when accessed from remote network addresses (non-loopback IPs).

---

## 4. Broadcast & Production Features

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

## 5. Developer Experience & Operator Usability

- [ ] **One-Click Windows Operator Launcher**:
  - Refine `start-neuroncast.bat` to verify Node.js runtime presence, execute preflight validation, launch the background server, and open `http://localhost:31982/config` in the default browser.
- [ ] **Comprehensive Documentation & Showcase**:
  - Update `README.md` with:
    - New NeuronCast branding and UI screenshots.
    - Quickstart installation guide and CS2 GSI configuration instructions.
    - Full list of routes (`/hud`, `/config`, `/radar`, `/operator/readiness`, `/operator/status`).
    - Development workflow and architecture overview.
- [ ] **Interactive Onboarding Wizard**:
  - Implement a first-run wizard in Config SPA that guides new tournament operators through CS2 GSI setup, theme selection, and OBS Browser Source configuration.

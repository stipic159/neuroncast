# NeuronCast Stability Pass Checkpoint - 2026-05-21

This checkpoint documents the comprehensive architectural, runtime, and UI stability fixes implemented for NeuronCast's Counter-Strike 2 broadcast overlay stack, operator console, and server telemetry.

---

## 1. Summary of Stabilized Areas
The primary focus of this stability pass was to transition NeuronCast from a prototype-level local broadcast server to a highly resilient, production-ready system capable of surviving CS2 client crashes, network lag spikes, and browser source slow-downs without interrupting the live broadcast operations.

---

## 2. Major Fixes

### A. 9 UI & Runtime HUD Bugs Resolved
1. **Classic Sidebar Overlaps**: Expanded card width safely from `29.5rem` to `29.9rem` to handle 4 grenades + taser + rifle configurations without pushing columns into radar or killing-feed zones at 1080p.
2. **Compact Sidebar Grid Tracks**: Resized internal CSS grid tracks, eliminating excess whitespace and ensuring high density matching for 16:9 and 4:3 capture feeds.
3. **Dead-Player Card Shrinkage**: Implemented dynamic `.is-dead` card height reduction to improve roster scanability while preserving crucial ADR statistics.
4. **Focused Player Layout Tracking**: Aligned focused border indicators and accent highlights to wrap both alive and dead cards symmetrically.
5. **Mirrored Layout Symmetry**: Synchronized T (left sidebar) and CT (right sidebar) columns to remain perfectly symmetrical.
6. **Players Alive Visibility Toggle**: Bound `isActive()` inside the default `players-alive.js` component to respect HUD layout visibility config parameters.
7. **Komplettligaen Intermission Stats**: Added calculated "K/D" ratios and renamed column layout metrics dynamically.
8. **Glassmorphic Round-Won Overlay**: Added CT/T branded glassmorphic victory banners with dynamic team logo error fallbacks.
9. **Bomb Countdown Timer**: Designed ticking seconds display (`$bomb.countdownSec`) with red glowing animations.

### B. Player / Team / Logo Resolver Centralization
* Moved logo resolving to an absolute, server-side asset endpoint (`/hud/team-logos/${teamName}.png`).
* Added `onerror` fallbacks inside the HUD components to replace broken or missing logos instantly with default transparency/generic assets rather than throwing render exceptions.
* Centralized SteamID64 and player database linking in the Komplettligaen scraper layer.

### C. GSI Ghost Bomb & winningSide Fixes
* Fixed critical round end conditions where `winningSide` transitions or `body.map` resets were repeatedly triggered across consecutive ticks.
* Added state flags guarding `resetVolatileMatchState()` to execute exactly once on map transition or menu entry.

### D. Roster Lifecycle & Missing Map Hardening
* Hardened state parsing against empty, partial, or malformed GSI payloads (e.g. game client crash, loading screen, or spectator menu changes).
* Preserved `lastKnownMapName` and observer slot metadata during client crash/disconnect events rather than wiping HUD roster lists.

### E. additionalState Cleanup & Buy Tracker
* Resolved a race condition where buying weapons during CS2 freezetime repeatedly overwrote the player's initial round start balance.
* Implemented a `wasRoundFreezetime` state check inside `src/server/gsi.js` to freeze the `moneyAtStartOfRound` snapshot immediately after transitioning from round over to freezetime.
* Guarded player iteration against partial GSI frames without `allplayers` keys to protect calculated round statistics.

### F. OBS & Browser-Source Reliability
* **WebSocket Queue Squelching**: Implemented a frame pre-filter in `websocket-on-message.js`. It parses queued WebSocket payloads once, dispatches custom alerts globally so animations and sounds are never lost, but restricts the heavy `handleState()` HUD render updates strictly to the *latest* state frame.
* **Server GSI Heartbeat**: Installed a 1-second interval timer on the server. If GSI posts remain silent for `> 5 seconds`, it flips `additionalState.gsiActive = false` (stale) and broadcasts the status change once, preventing interval telemetry broadcast spam.

### G. Operator Status Diagnostics Page
* Registered `GET /operator/status` serving a zero-dependency HTML5/CSS3/vanilla JS diagnostics page.
* Features explicit `no-cache` HTTP headers (`Cache-Control`, `Pragma`, `Expires`) to prevent browser or local proxy caching of connection states.
* Displays ticking server uptime (e.g. `2h 15m 30s`), started timestamp, last GSI latency, active maps/phases, and dynamic version/git commit footers.

---

## 3. Files & Areas Touched
* **Core Server**: `src/server/gsi.js`, `src/server/state.js`, `src/server/index.js`
* **Parser Layers**: `src/themes/raw/core/websocket-on-message.js`, `src/themes/raw/core/parse-gsi-state.js`
* **HUD Theme Components**: `src/themes/default/shell/`, `src/themes/default/sidebars/`, `src/themes/default/focused-player/`, `src/themes/default/players-alive/`
* **Vault & Notes**: `C:\dev\vaults\AI-Vault\10-Projects\eon\session-notes\`

---

## 4. Operational Benefits for Live Broadcasts
* **Operator Confidence**: Operators can load `/operator/status` on a second monitor and immediately isolate connection issues (e.g. NeuronCast webserver down vs. CS2 game crash vs. OBS browser source freeze).
* **HUD Lag Elimination**: Queue squelching guarantees that Chromium or OBS browser sources will never experience progressive rendering latency or crashes after system lag spikes.
* **Resilient Restoration**: If CS2 crashes or the server is restarted mid-broadcast, the HUD overlay will automatically reconnect and self-heal the match state within 1 second of client recovery.

---

## 5. Known Remaining Risks
* **Host environment git executable dependency**: If deployed on a barebones server environment lacking a global `git` executable, the footer short hash fallback resolves to `null` cleanly, but warning logs are produced at server startup.

---

## 6. Recommended Next Tasks
1. **Compact & Classic Sidebar Whitespace Audit**: Verify right sidebar edge anchoring at both standard 16:9 and legacy 4:3 broadcast capture resolutions.
2. **Spectator-State Fallback Handlers**: Audit freecam, dead-player follow, and lobby spectator states to ensure every hud preset has a deliberate fallback style rather than displaying blank slots.
3. **Vue SFC Theme Engine Hardening**: Decide whether to keep the runtime `vue3-sfc-loader` model or transition NeuronCast to a bundled build step to prevent client-side compilation anomalies.

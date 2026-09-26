# NeuronCast Operator Readiness Playbook

This playbook defines NeuronCast's pre-broadcast operator readiness dashboard (`/operator/readiness`), outlining checklists, severity rules, caching policies, and troubleshooting instructions to help live operators answer the critical question: **“Are we ready to go live?”**

---

## 1. Readiness State Hierarchy

The NeuronCast readiness console consolidates telemetry and preflight metrics into three high-visibility readiness states, mapping to color codes:

### 🟢 READY (Green)
* **Definition**: All core checklist assertions pass. The server is online, GSI connection is receiving live CS2 state changes (or simulated in UI dev mode), theme validator returns no preflight errors, the userspace overrides file exists, and at least one observer HUD client overlay is connected.
* **Action**: Safe to start the match broadcast.

### 🟡 DEGRADED (Yellow)
* **Definition**: One or more non-critical checks failed or returned warnings, but the system is still safe to operate.
* **Causes**:
  - GSI is in `waiting` state (awaiting first packet).
  - 0 active HUD web sockets are connected (OBS browser sources have not been loaded yet).
  - One or more Komplettligaen scraper cache flat files are missing under `userspace/cache/`.
  - Deprecated legacy aliases or transitional layout options exist in `userspace/theme.json`.
  - Cache persistence files are stale (older than 5 minutes).
* **Action**: Degraded but operable. Proceed to load browser sources or verify scrapers.

### 🔴 NOT READY (Red)
* **Definition**: One or more critical checks failed, representing an active risk to the broadcast quality.
* **Causes**:
  - Theme validation preflight fails (severe syntax errors or missing raw/default core theme dependencies).
  - Userspace theme overrides (`userspace/theme.json`) is corrupt or completely unreadable.
  - GSI connection becomes `stale` (more than 5 seconds of silence since the last received packet during live gameplay).
  - Server is unreachable (offline or crashed).
* **Action**: **DO NOT START BROADCAST.** Abort match setup, inspect validator logs, confirm network state, and verify settings are resolved.

---

## 2. Readiness Metrics Checklist Details

The backend `/api/readiness` endpoint compiles a structured array of checks:

1. **Server Online**:
   - **Target**: Confirm the Node process is fully running.
   - **Rules**: `PASS` if responsive.
2. **CS2 GSI Signal Connection**:
   - **Target**: Audit Game State Integration telemetry stream.
   - **Rules**:
     - `PASS` if receiving live GSI updates or if `uiDevMode` is active.
     - `WARN` if the server is waiting for the very first packet.
     - `FAIL` if GSI is stale (> 5 seconds since the last accepted packet).
3. **HUD Overlay WebSockets**:
   - **Target**: Count active client HUD overlays.
   - **Rules**:
     - `PASS` if >= 1 HUD overlays or standalone radars are connected.
     - `WARN` if 0 connected (safe to start but reminds operators to load OBS overlays).
4. **Theme Configurations Preflight**:
   - **Target**: Audit raw, default, and userspace theme.json keys and file syntax.
   - **Rules**:
     - `PASS` if theme validator preflight completes successfully.
     - `FAIL` if validator catches syntax exceptions or core option slices duplicate definitions.
5. **Userspace Settings Config**:
   - **Target**: Verify readability of `src/themes/userspace/theme.json`.
   - **Rules**:
     - `PASS` if present and parses cleanly.
     - `FAIL` if missing, unreadable, or syntactically corrupt.
6. **Scraper Caches Offline Backup**:
   - **Target**: Audit presence and fresh age limits of scraper persistence files under `userspace/cache/`.
   - **Rules**:
     - `PASS` if matches, standings, and komplettligaen resolved cache maps exist and are under 5 minutes old.
     - `WARN` if any caches are missing (scrapers will load them lazily).
     - `WARN` if caches are present but stale.
7. **Deprecated Options Legacy Aliases**:
   - **Target**: Count deprecated variables inside userspace configurations.
   - **Rules**:
     - `PASS` if 0 legacy aliases exist.
     - `WARN` if deprecated keys (like `css.lan66-*` options) are found.

---

## 3. Telemetry Caching Policy

To prevent operator polling requests from overwhelming host hardware, NeuronCast implements an **optimized in-memory validation cache lease**:

* **Duration**: `30,000ms` (30 seconds).
* **Mechanism**: On the first readiness poll, NeuronCast programmatically spawns `node scripts/theme-validate.js --json` as a child process. The structured JSON outcome is cached in memory. Subsequent readiness polls resolve the cached validation report immediately without triggering disk reads or sub-processes.
* **Performance Impact**: Zero HUD overlay rendering jitters, socket latency, or CPU load spikes, maintaining absolute overlay continuity at all times.

---

## 4. Operator Troubleshooting Guide

* **GSI Connection is STALE (FAIL)**:
  - Check if Counter-Strike 2 client is running.
  - Verify `gamestate_integration_neuroncast.cfg` is present inside CS2's local `game/csgo/cfg/` folder.
  - Check host firewall settings to ensure port `31982` is not blocked.
* **Theme Validation Fails (FAIL)**:
  - Look at the validation logs rendered directly in the metric's detailed checklist box.
  - Locate the file and line number containing the syntax exception or duplicate property.
  - Open the Config SPA Layout Editor or Options Editor and click save to overwrite corrupt layouts cleanly.
* **0 HUD Clients Connected (WARN)**:
  - Open your OBS scenes.
  - Ensure the browser sources targeting `http://localhost:31982/hud` or `/radar` are visible and loaded.
  - Right-click the browser source in OBS and click "Refresh cache of current page" to trigger websocket connection reconnects.

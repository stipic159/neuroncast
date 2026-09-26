# NeuronCast Production Deployment Playbook

This playbook outlines startup environments, diagnostic interfaces, production deployment options, and emergency disaster recovery rules for running NeuronCast on broadcast desks.

---

## 1. Startup Workflows

NeuronCast supports three startup modes tailored for specific environment profiles:

### Local Development (Live CS2 Input)
Starts the node server locally in standard watch mode:
```bash
npm run dev
```

### UI Development (Offline / Simulated GSI)
Loads the Node server in isolated UI dev mode, serving pre-recorded static match states while safely ignoring live GSI client posts:
```bash
npm run start:ui-dev
```

### Broadcast-Safe Production (Recommended Operator Command)
Starts NeuronCast with automatic preflight checks, verifying theme configurations, options validation, and auto-creating required userspace folders/caches to prevent on-air failures:
```bash
npm run broadcast:start
```

#### Optional CLI Arguments
* `--no-validate`: Skip preflight theme validation checks (use only during emergency diagnostics).
* `--ui-dev`: Launch the production server in UI Development mode (Offline / Simulated GSI).
* `--port <number>`: Override the bind port dynamically (e.g. `npm run broadcast:start -- --port 32000`).

### Supervised Production (PM2 Deployment)
Starts NeuronCast under PM2 process supervision, enabling autorestart, separate file logs, and a `300MB` safety memory limit:
```bash
# Windows PowerShell
.\scripts\start-production.ps1

# Linux / macOS
./scripts/start-production.sh
```

---

## 2. When to Use broadcast:start vs PM2 Process Supervision

* **Use `npm run broadcast:start` (Interactive Control)**: Recommended for standard operators running live broadcasts directly from terminal sessions. It provides an immediate visual preflight pass check, prints diagnostic URLs, and gives direct interactive terminal process feedback (`Ctrl+C` cleanly shuts down everything).
* **Use PM2 Supervision (Background Deployed)**: Recommended for remote servers, multi-system installations, or dedicated broadcast hosts where automated process restart-on-crash, separate background logging, and auto-boot on system startup are mandatory. PM2 does not offer interactive console prompts, so use `broadcast:start` to verify configs before putting PM2 in service.

---

## 3. Production Process Supervision Commands

When using supervised production mode, manage NeuronCast utilizing global PM2 commands:

- **Check server status**:
  ```bash
  pm2 status
  ```
- **Stream real-time server output**:
  ```bash
  pm2 logs neuroncast
  ```
- **Restart NeuronCast server**:
  ```bash
  pm2 restart neuroncast
  ```
- **Stop NeuronCast server**:
  ```bash
  pm2 stop neuroncast
  ```

---

## 4. Broadcast Operator Setup Checklist

Prior to going live, check and verify the following URLs and configs:

### URL Reference Sheet
- **Main HUD Overlay**: `http://localhost:31982/hud/` (Target: 1920x1080 resolution in OBS Browser Source)
- **Config Management Dashboard**: `http://localhost:31982/config/`
- **Mini-Radar Overlay**: `http://localhost:31982/radar/`
- **Operator Diagnostics Status**: `http://localhost:31982/operator/status`
- **Operator Readiness Console**: `http://localhost:31982/operator/readiness`

### Pre-Broadcast Preflight Steps
1. Run preflight theme validation: `npm run theme:validate`. Ensure it outputs `✔ PASS`.
2. Confirm the CS2 GSI configuration `gamestate_integration_neuroncast.cfg` is placed in the local CS2 folder (`game\csgo\cfg\`).
3. Load the HUD in OBS, check that the status classes resolved to `ws-connected`, and check `http://localhost:31982/api/status` for healthy server uptime metrics.
4. If integrating Komplettligaen intermission overlays, verify the GG Arena Match ID inside `/config/` and confirm that table rows load cleanly under `/api/komplettligaen`.

---

## 5. Emergency Fallback Protocols

### Scenario A: CS2 client crashes mid-round
- **Observation**: HUD displays `WAITING FOR FIRST GSI PACKET` or shows stale stats.
- **Immediate Action**:
  - The operator does not need to restart NeuronCast. NeuronCast's server GSI heartbeat automatically marks `gsiActive` as `false` after 5 seconds of silence, causing the HUD to transition cleanly into a branded standby layout.
  - Reboot CS2. Upon reconnecting, NeuronCast will automatically resume live data feeds cleanly.

### Scenario B: NeuronCast server crashes or hangs
- **Observation**: OBS overlay elements freeze; connection classes drop to `ws-disconnected`.
- **Immediate Action**:
  - If NeuronCast is running under PM2 process supervision, PM2 will automatically restart the node process in `2000ms`.
  - The client's capped exponential backoff reconnect loop will automatically reconnect to NeuronCast's websocket, requesting full state refreshes cleanly.
  - If PM2 failed to recover the process automatically, run:
    ```bash
    pm2 restart neuroncast
    ```
    or start the fallback command directly:
    ```bash
    npm start
    ```

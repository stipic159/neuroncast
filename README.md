# NeuronCast ⚡

NeuronCast is an autonomous broadcast HUD and production suite for Counter-Strike 2 — delivering the clean on-screen overlays seen on top-tier tournament streams: live team scores, round timers, player health/armor/economy sidebars, utility tracking, tactical radar, real-time win probability forecasting, and tournament intermission scenes. It is architected for LAN tournaments, online leagues, and solo broadcast stations where a caster or producer manages production from a mobile PWA remote or web dashboard while OBS or vMix captures transparent overlay sources.

![The NeuronCast broadcast HUD: top bar with team scores and round timer, radar, team sidebars, and focused player card](screenshots/HUD.png)

Everything runs locally with zero external telemetry requirements. CS2 streams game state directly to NeuronCast over Valve's Game State Integration (GSI); NeuronCast validates, normalizes, and enriches that state (win probability models, economy metrics, caster alerts, killfeed events, match telemetry) and broadcasts it via WebSocket to real-time client surfaces:

- **Live HUD** (`/hud`) — the viewer-facing broadcast overlay, rendered as a transparent HTML5 canvas/DOM layer for OBS/vMix browser sources or click-through desktop Electron windows.
- **Mobile Remote Deck (PWA)** (`/remote`) — an installable Progressive Web App with Screen Wake Lock, haptic feedback, instant OBS scene control, and real-time CS2 spectator camera switching (`-netconport 2121`).
- **Control Panel** (`/config`) — a responsive Vue 3 SPA for the operator: switch live scenes, set up tournament formats (BO1/BO3/BO5), manage player stand-ins, draw on the telestrator, adjust themes, configure sponsors, and audit broadcast readiness.
- **Match Platforms Hub** (`/config` -> Platforms) — dedicated platform integrations (Fastcup, Komplettligaen / GG Arena, Standalone) with Zod-hardened schema validation to sync tournament brackets, rosters, and player avatars.
- **Standalone Radar** (`/radar`) — an isolated, high-resolution top-down map view with synchronized player positions and grenade trajectories.
- **Operator Readiness & Telemetry** (`/operator/readiness`, `/operator/status`) — real-time system diagnostics, CS2 1-click config installation, GSI signal latency, WebSocket client counts, and live CSV/JSON match telemetry export.

---

## Key Features in v3.0

- **🎮 CS2 Observer NetCon TCP Control**: Switch in-game spectator camera (`spec_player <slot>`) with sub-millisecond latency directly from the mobile deck or tablet.
- **📱 Installable Mobile PWA Remote**: Touch-first operator deck with Screen Wake Lock, haptic vibration, offline shell caching (`sw.js`), and instant reactive OBS WebSocket sync without HTTP polling.
- **⚙️ Auto-Detection & 1-Click CS2 Setup**: Automatically resolves CS2 install path from Windows Registry / Linux library folders and installs `gamestate_integration_neuroncast.cfg` in one click.
- **🛡️ Zod-Protected Data Pipelines**: Full structural schema validation for tournament match data and brackets, preventing crashes on external API changes.
- **⚡ Non-Blocking Async I/O**: High-frequency 20Hz GSI frame ingestion backed by `node:fs/promises` atomic file writes, keeping the Node.js Event Loop completely unblocked.
- **📊 Realtime Round Analytics Engine**: Live win probability modeling, clutch detection, dynamic MVP calculation, and automatic highlight logger.
- **🎨 Dynamic Visual Themes & Presets**: Built-in broadcast presets (Slanted, Classic, Compact, Diagonal, Rounded) with real-time CSS variable customization via Theme Designer.
- **🖊️ Interactive Telestrator (Analysis Board)**: Freehand tactical drawing directly overlaid on top of the live match view with instant HUD sync.
- **🔒 Offline-Safe Asset Guarantees**: Enforces local font and image serving — strictly eliminating render-blocking external Google Fonts or CDN downtime during live LAN broadcasts.
- **🧪 UI Development Sandbox**: Built-in frozen in-round state simulation (`--ui-dev-mode`) allowing complete design tweaking without CS2 running.

---

## Quick Start

### 1. Installation

Requires **Node.js 20+** (Node.js 22+ recommended).

```bash
git clone https://github.com/stipic159/neuroncast.git
cd neuroncast
npm install
npm start
```

### 2. CS2 Configuration & Launch Options

1. **CS2 Launch Options (for mobile spectator camera control):**
   In Steam, right-click CS2 -> Properties -> Launch Options, and add:
   ```text
   -netconport 2121
   ```
2. **1-Click GSI Installation:**
   Start NeuronCast and navigate to `http://127.0.0.1:31982/operator/readiness` — the server will auto-detect your CS2 folder and install the integration config automatically.
   *(Manual alternative: copy `gamestate_integration_neuroncast.cfg` to `<SteamLibrary>/steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg/`)*

### 3. OBS Studio / vMix Setup

1. Add a **Browser Source** in OBS Studio.
2. Set URL to: `http://127.0.0.1:31982/hud?transparent`
3. Set Width: `1920`, Height: `1080`.
4. Check **Shutdown source when not visible** and **Refresh browser when scene becomes active**.

---

## Network Endpoints & Ports

Default Port: **`31982`** (Configurable via `PORT` environment variable)

| Route | Purpose | Target Audience |
| :--- | :--- | :--- |
| `http://127.0.0.1:31982/` | Welcome & quick link launcher | Operator / Broadcast Team |
| `http://127.0.0.1:31982/hud` | Viewer-facing Broadcast HUD (`?transparent`) | OBS / vMix / Casters |
| `http://127.0.0.1:31982/remote/` | Touch-first Mobile Remote Deck (PWA) | Mobile / Tablet / Caster |
| `http://127.0.0.1:31982/config/` | Operator Dashboard & Studio Control Panel | Producer / Observer |
| `http://127.0.0.1:31982/radar/` | Dedicated full-screen tactical radar | Analysis Desk / Replay |
| `http://127.0.0.1:31982/operator/readiness` | 1-Click CS2 Setup & Preflight Diagnostics | Technical Director |
| `http://127.0.0.1:31982/operator/status` | Live GSI health & stream telemetry | Technical Director |
| `http://127.0.0.1:31982/api/sessions/active` | Live match telemetry & fragger statistics | Graphics / Lower Thirds |
| `http://127.0.0.1:31982/gsi` | Valve GSI HTTP ingestion endpoint | CS2 Game Client |

---

## Available Commands & Scripts

```powershell
# Server & Development
npm start                # Start backend server on port 31982
npm run dev              # Start backend server with nodemon auto-reload
npm run start:ui-dev     # Start server in UI dev mode (frozen match state, no CS2 needed)
npm run broadcast:start  # Production startup script with health checks

# Desktop Electron Windows
npm run overlay          # Transparent, click-through HUD overlay window
npm run config           # Standalone operator control panel window
npm run radar            # Standalone map radar window
npm run start:all        # Concurrently launches Server + Overlay
npm run start:broadcast  # Concurrently launches Server + Overlay + Radar

# Testing & Quality Assurance
npm run test:unit        # Run Node.js native unit test suites
npm run theme:validate   # Validate themes, canonical CSS variables, and radar definitions
npm run test:smoke       # Playwright browser smoke test suite
npm run gsi:simulate     # Stream simulated CS2 GSI packets for testing
```

---

## Architecture & Directory Structure

```text
neuroncast/
├── gamestate_integration_neuroncast.cfg  # Valve CS2 GSI config template
├── CHANGELOG.md                          # Release version history & changelog
├── public/
│   └── operator/                         # Standalone status & readiness HTML dashboards
├── src/
│   ├── config/                           # Vue 3 Operator Dashboard SPA
│   ├── remote/                           # Mobile Remote Deck PWA (Manifest, SW, Vue 3)
│   ├── electron/                         # Desktop Electron window launchers
│   ├── radar/                            # Full-screen 2D radar implementation
│   ├── server/                           # Koa backend & real-time subsystems
│   │   ├── analytics/                    # Round analytics, MVP, win probability engine
│   │   ├── fallbacks/                    # Zod validation schemas & payload fallbacks
│   │   ├── integrations/                 # CS2 NetCon, CS2 Auto-detector, OBS Manager
│   │   ├── routes/                       # Operator, CS2, GSI, and OBS route controllers
│   │   ├── sessions/                     # Async match recorder & stats aggregator
│   │   └── gsi.js                        # Streamlined 20Hz GSI ingestion loop
│   └── themes/
│       ├── raw/                          # Base telemetry parser & WebSocket client
│       ├── default/                      # Built-in broadcast theme & assets
│       └── userspace/                    # User overrides, custom logos, fonts
└── tests/
    ├── unit/                             # Node.js native test runner suites
    └── playwright/                       # Browser E2E visual regression tests
```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `31982` | HTTP and WebSocket server listening port. |
| `HOST` | `127.0.0.1` | Network interface binding (`0.0.0.0` to expose for phone/tablet over Wi-Fi). |
| `NEURON_CONTROL_TOKEN` | `""` | Optional authorization bearer token for remote endpoints. |
| `GSI_TOKEN` | `""` | Expected GSI authentication token configured in CS2. |
| `CS2_NETCON_PORT` | `2121` | CS2 TCP NetCon port for camera control. |
| `NEURON_UI_DEV_MODE` | `0` | Set to `1` to freeze match state for offline theme/layout editing. |

---

## Changelog

Detailed release history, security patches, and performance updates are documented in [CHANGELOG.md](file:///F:/project/eon/eon-master/CHANGELOG.md).

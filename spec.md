# Eon CS2 Broadcasting HUD - Current System Overview

## 1. Purpose

Eon is a local broadcast operations stack for Counter-Strike 2. It turns CS2 GSI payloads into a realtime HUD, radar, and operator control surface for OBS/vMix capture, LAN production, and league intermission scenes.

The active product direction is the `default` theme: a standalone broadcast HUD built on top of the lower-level `raw` parser/theme foundation, with operator overrides stored in `userspace`.

## 2. Runtime Architecture

### 2.1 Server

- Entry point: `src/server/index.js`
- Framework: Node.js ESM, Koa, `@koa/router`, `ws`
- Default bind: `127.0.0.1:31982`
- Main responsibilities:
  - serve `/hud`, `/config`, `/radar`, dependencies, licenses, and static theme assets
  - receive CS2 GSI on `/gsi` and `/api/gsi`
  - maintain enriched match state in `src/server/state.js`
  - fan out websocket events to HUD, config, and radar clients
  - persist operator settings into `src/themes/userspace`
  - expose Komplettligaen config and preview/data routes

### 2.2 GSI and State

- GSI route logic lives in `src/server/gsi.js`.
- Broadcast state is throttled to roughly 20Hz.
- The backend tracks derived broadcast data such as win probability, probability swing highlights, caster alerts, economy/round metrics, and local highlight logging.
- UI dev mode (`--ui-dev-mode`, `EON_UI_DEV_MODE=1`, or `UI_DEV_MODE=1`) serves a static state and ignores live GSI posts for layout work.

### 2.3 Websocket Contract

- Websocket implementation: `src/server/websocket.js`
- Clients consume state through the raw theme core and config store.
- Current important event types include state refreshes, config synchronization, caster alerts, and Komplettligaen refreshes.

### 2.4 Config SPA

- Config app root: `src/config/App.vue`
- Store: `src/config/store.js`
- Component areas:
  - Live Control / dashboard
  - Layout Editor
  - Series Setup
  - Match Rules
  - Teams Setup
  - Sponsors
  - HUD Options
- The SPA is served buildlessly through `vue3-sfc-loader`; `.vue` components are served as static text by the server fallback.
- The dashboard includes telestrator controls, win-probability actions, scene selection, and Komplettligaen match setup/test controls.

### 2.5 HUD and Themes

- Active theme chain: `userspace -> default -> raw`
- `raw` provides the GSI parser, websocket client, shell foundation, and shared helpers.
- `default` provides the active visual HUD, style presets, top bar, sidebars, focused player, series graph, radar assets, and intermission scene templates.
- Theme assets are served by recursively resolving files through the theme chain in `src/server/hud.js`.
- Missing component `.vue` files can be generated dynamically from matching `.js`, `.css`, and `.html` files.
- `.append.*` theme extension files are still supported.

### 2.6 Electron

- Launchers:
  - `src/electron/hud.js`
  - `src/electron/config.js`
  - `src/electron/radar.js`
- Windows load local server routes. Security posture should remain strict: no renderer Node integration, context isolation enabled, and only explicit preload bridges if IPC is later required.

### 2.7 Komplettligaen Integration

- Routes and cache: `src/server/komplettligaen.js`
- Scraper adapter: `src/server/integrations/komplettligaen/scraper.js`
- Operator config: `src/themes/userspace/komplettligaen.json`
- HUD scene mapping:
  - `intro` -> match overview
  - `halftime` -> waiting/intermission
  - `fulltime` / `over` -> result/map summary
  - `analytics` -> league table/team fixtures
- Viewer-facing scenes are implemented in the default theme shell rather than as standalone scraper pages.

## 3. Architecture Constraints

- Keep gameplay HUD components independent and theme-local unless shared behavior belongs in `raw`.
- Keep operator-specific state in `src/themes/userspace`; do not write runtime config into built-in theme files.
- Avoid deep Vue reactivity on full GSI payloads; the raw state path should remain shallow and websocket-driven.
- GSI processing should stay bounded per tick and avoid repeated expensive full-player passes where practical.
- Preserve the local-first model: no remote services are required for normal HUD operation, except optional Komplettligaen data fetches.
- Treat `tmp` images as visual references, not production assets.

## 4. Current Known Risks

- The theme engine remains buildless and string/file-composition based. It is flexible for local theme iteration but harder to debug than a bundled build with sourcemaps.
- Theme schema validation is minimal; current startup checks are warnings, not a strict JSON Schema gate.
- Config currently imports Vue SFCs directly through runtime loading, so runtime browser errors can still break whole config views.
- Compact and Classic sidebar spacing still need a dedicated visual pass.
- Several spectator-state screenshots in `tmp` indicate HUD state/layout issues that need verification across all presets.

## 5. Verification Baseline

Before changing behavior, verify:

- `npm start` serves `/hud`, `/config`, `/radar`, and `/api/gsi/status`
- `npm run start:ui-dev` shows stable HUD/config/radar state without CS2
- Config can save userspace settings and receives websocket updates
- Scene switching works for default gameplay plus `intro`, `halftime`, `fulltime`/`over`, and `analytics`
- Compact, Classic, Default/Slanted, Diagonal, and Rounded presets render without text overlap or detached HUD elements

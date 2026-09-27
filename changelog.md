# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [3.0.1] - 2026-09-27

### Added
- **Windows SendKeys Fallback:** Automatic Windows SendKeys fallback for player switching on VAC-secured CS2 servers when NetCon command injection is restricted.

### Fixed
- **Mobile Remote Deck Access:** Resolved PWA mounting route issues and bound HTTP server interface to `0.0.0.0` for local network and mobile access.
- **CS2 NetCon Spectator Controls:** Fixed NetCon spectator player switching (`spec_player <slot>`), socket keepalive connection management, and LAN control authorization.
- **NetCon Command Targeting & Status:** Enhanced NetCon spec command targeting accuracy, real-time connection status indicators, and payload authentication handling.

## [3.0.0] - 2026-09-27

### Added
- **Zod Structural Validation Schemas:** Integrated Zod schemas (`src/server/fallbacks/schemas.js`) for tournament data structures (GG Arena, Komplettligaen, FastCup), ensuring resilience against API variations.
- **CS2 Observer NetCon TCP Integration:** Real-time spectator camera switching (`spec_player <slot>`) via native CS2 NetCon TCP socket (`-netconport 2121`).
- **CS2 Auto-Detection & 1-Click Config:** Automatic CS2 path resolution via Windows Registry / Linux paths and `libraryfolders.vdf`, with one-click installation of `gamestate_integration_neuroncast.cfg`.
- **Mobile Remote Deck PWA & Instant Sync:** Mobile Remote turned into PWA with Service Worker (`src/remote/sw.js`), Web App Manifest (`manifest.webmanifest`), Screen Wake Lock API, and instant reactive WebSocket state sync (eliminating HTTP polling).
- **Standalone Operator Status & Readiness Pages:** Extracted HTML templates (`public/operator/status.html`, `public/operator/readiness.html`) and route controller (`src/server/routes/operator-routes.js`).
- **Dedicated Realtime Round Analytics Engine:** Extracted win probability modeling, clutch swing detection, MVP calculation, and async highlight logging to `src/server/analytics/round-analytics.js`.
- **Deterministic E2E Test Hooks:** Added reactive `data-stage-ready` attributes on player highlight overlay for Playwright E2E test synchronization.

### Changed
- **Async Non-Blocking I/O Migration:** Converted all file persistence helpers (`timeline-recorder.js`, `stats-aggregator.js`, `session-store.js`, `event-package-helper.js`, `theme-designer-helper.js`, `layout-preset-helper.js`) from synchronous `writeFileSync` to non-blocking `writeJsonAtomic` on `node:fs/promises`.
- **`gsi.js` Monolith Refactoring:** Refactored `src/server/gsi.js` from ~1950 lines into a clean ~250-line GSI telemetry tick receiver.
- **Legacy Env Variable Migration:** Standardized environment variable naming to `NEURON_*` with backwards-compatible fallbacks for `EON_*`.

### Fixed
- Unhandled scraper crash exceptions when parsing malformed or partial tournament HTML/JSON payloads.
- High-rate 20Hz GSI event loop blocking caused by synchronous disk writes.
- Fixed 5-second hardcoded timeouts in Playwright overlay visual tests.

### Removed
- Removed redundant `src/electron/yarn.lock` lockfile to unify project dependencies on root `package.json`.


## [2.7.0] - 2025-09-26
### Added
* Added `teams.hideCoachesByName` option (disabled by default), which hides any player that has the word `coach` in their name


## [2.6.2] - 2025-07-05
### Fixed
* Fixed series graph sometimes not disappearing when only one map is set
* Fixed long nicknames sometimes wrapping into multiple lines

### Changed
* Updated several dependencies
* Disabled compression for server binaries


## [2.6.1] - 2025-01-19
### Fixed
* Fixed pre-built Windows binary immediately crashing on startup


## [2.6.0] - 2025-01-18
### Added
* When a map screenshot is not found or fails to load, series graph will now show a fallback image

### Fixed
* Null-ish values (e.g. the number `0` for 16-0 matches) will now be saved when entered on the config page

### Changed
* Updated various dependencies (node to v22, electron to v34)
* Switched to @yao-pkg/pkg for building pre-packaged binaries
* Map screenshots and radars are now saved in PNG format instead of WebP
* Updated map screenshots and radars to CS2
* Changed filenames for server and overlay binaries; server is now `cs-hud-server-linux`/`cs-hud-server-win.exe` (previously `cs-hud-linux`/`cs-hud-win.exe`), overlay is now in `cs-hud-overlay-linux-x64.tar.gz`/`cs-hud-overlay-win32-x64.zip` (previously `cs-hud-linux-x64.tar.gz`/`cs-hud-win32-x64.zip`)

### Removed
* Removed map screenshots from CS:GO; now included by default are only map screenshots for maps that were officially included in the game as of 2025-01-18
* Removed some legacy radars (primarily outdated Simple Radar radars); all maps that used to be included should still be included, but some alternative variants of their radars may not be included anymore


## [2.5.0] - 2024-03-02
### Added
* Added fallback for wrong GSI-reported inferno flame positions

### Changed
* Players who disconnected before match start are now hidden


## [2.4.0] - 2024-02-04
### Added
* Added `teams.hiddenPlayers` (theme `raw`) to hide autokilled coaches in Faceit matches


## [2.3.1] - 2024-01-21
### Fixed
* Fix loss bonus increasing past $3400
* Fix disconnected players being displayed with observer slot `NaN`


## [2.3.0] - 2024-01-07
### Fixed
* Fix window title bar sometimes appearing in HUD view Electron windows

### Changed
* `cvars.mp_maxrounds` now defaults to `24`, which is the default value in CS2
* Focused player section (bottom center) will now be hidden when in third person/freecam


## [2.2.0] - 2023-11-22
### Added
* Added optional overlay corners to show that the HUD is active (enabled by default in the Electron overlay binary; can be enabled by appending `?corners`/`?transparent&corners` to the URL)
* Added `preferences.isCsgo` option on the config page (theme `raw`) for backwards-incompatible changes to CS:GO

### Fixed
* Fix invalid theme completely breaking config page
* Fix missing `player` in GSI payload breaking everything (potentially; could not reproduce issue)
* Fix observer slots being offset by -1 in CS2
* Fix dead players following the player they're spectating on the minimap


## [2.1.1] - 2023-10-02
### Fixed
* Fix round damage sometimes not being counted for ADR when player died
* Fix console errors caused by missing bomb during warmup


## [2.1.0] - 2023-10-01
### Added
* Add Team Name Overrides
* Add Team Logos
* Add overlay images (e.g. for sponsors)

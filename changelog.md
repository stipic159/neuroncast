# Changelog

All notable changes to the NeuronCast project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.3] - 2026-09-27

### Security & Hardening
- **CS2 NetCon Command Injection Elimination**: Replaced arbitrary shell string interpolation via `child_process.exec` in `cs2-netcon.js` with parameterized `child_process.execFile` execution of `cscript.exe` with strict single-digit validation (`^[0-9]$`), neutralizing remote command execution (RCE) vectors.
- **Console Command Sanitization**: Console commands dispatched via `POST /api/cs2/command` now strip carriage return (`\r`) and newline (`\n`) delimiters, preventing multi-command batch injection into the CS2 game engine.
- **Timing-Safe Authentication**: Enforced length matching prior to invoking `crypto.timingSafeEqual` in `auth.js`, preventing runtime crashes when verifying mismatched control token headers or query strings.
- **WebSocket Payload Quotas**: Guarded WebSocket client message ingestion with a 1 MB payload size limit, mitigating DoS via oversized payload allocations.
- **Path Traversal Guards**: Added strict character allowlists and boundary checks across FastCup asset requests (`/api/fastcup/assets/:file`) and theme configuration slugs (`theme-designer-helper.js`).

### Performance & Memory Leak Prevention
- **Bounded Resource Caching**:
  - `hud.js`: Added an LRU cap (1000 items) to `themeAssetCache` to prevent unbounded memory growth on high-cardinality HUD requests.
  - `team-identity-context.js`: Transitioned `logoCache` to a FIFO eviction strategy capped at 200 entries instead of abrupt whole-cache wipes.
  - `komplettligaen.js`: Capped in-memory scraper cache at 100 entries.
  - `session-store.js`: Capped `sessionPathCache` at 500 entries with LRU eviction.
- **Node.js Process Lifecycle & Timer Cleansing**:
  - NetCon reconnection timers (`reconnectTimer`), WebSocket heartbeat intervals, GSI stale checks, and scraper timeouts now call `.unref()`, ensuring background loops do not stall clean process termination.
  - Added clean disconnect of CS2 NetCon and OBS Manager on `SIGINT` / `SIGTERM` server shutdowns in `index.js`.
  - Added cleanup of session summary flush timers on process exit in `session-store.js`.
- **OBS Event Subscription Singleton**: Fixed a listener accumulation leak where repeated registrations of `registerObsRoutes` multiplied WebSocket status broadcast listeners.

### Reliability & Error Recovery
- **Child Process Execution Timeouts**: Added explicit timeouts to `theme-validate.js` (10s) and `git rev-parse` (5s) in `operator-routes.js`, eliminating deadlocks in `/api/readiness` when background processes hang.
- **Windows File System Atomic Fallbacks**: `json-file.js` now handles Windows `EPERM`, `EBUSY`, and `EEXIST` file locks with exponential backoff retries and graceful atomic copy fallbacks for both async and sync write workflows.
- **Graceful Static Asset Recovery**: Added comprehensive 404 and `ENOENT` handling for missing `@fontsource` font packages, `vue.js` ESM dependencies, `license.txt`, and `version.txt` routes.
- **Safe URI Decoding**: Wrapped URL path decoding in `index.js` in defensive error boundaries to prevent server errors on malformed URI sequences.

---

## [3.0.2] - 2026-09-25

### Added
- Tournament session recording and match telemetry streams.
- Live fragger statistics aggregator and MVPs tracker.
- Integration tests and comprehensive unit test suite with 20 passing suites.

---

## [3.0.0] - 2026-09-20

### Added
- Initial release of NeuronCast v3 architecture.
- Real-time 20Hz GSI telemetry processing.
- Multi-theme support with Theme Designer and Layout Presets.
- Mobile PWA Remote deck with OBS WebSocket integration.

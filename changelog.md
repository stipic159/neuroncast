# Changelog

All notable changes to **NeuronCast** will be documented in this file.

## [3.0.2] - 2026-09-27

### 🚀 Hardening & Broadcast Stability
- **Series Map Cards (`KlSeries`)**:
  - Implemented automatic symmetric team side resolution (`homeStartSide` / `awayStartSide`) so starting badges (`CT` / `T`) always render reliably.
  - Added seamless universal series match fallback (`gsiSeriesMatch`) into `shell.html`, enabling tournament map cards on all match scenes without external platform scrapers.
  - Added support for BO1, BO2, BO3, and BO5 card layouts with GPU layer isolation (`contain: layout style paint; will-change: transform, opacity; transform: translateZ(0)`).
  - Defensive map name normalization and safe map asset fallback resolution (`/assets/maps/`).
- **Server Resilience (`src/server`)**:
  - Fixed `ReferenceError: presetsPath is not defined` during layout configuration import (`/config/import`).
  - Fixed race condition in bomb defused alert detection (`body.bomb?.state === 'defused'`).
  - Hardened round analytics against call stack overflow on long matches by replacing `Math.min(...history)` with $O(N)$ linear scans.
  - Secured WebSocket client broadcast loops with explicit `try/catch` and `readyState` checks to eliminate uncaught socket drop exceptions.
  - Sanitized logo filename paths in team identity context against directory traversal attacks.
- **HUD Components Hardening**:
  - **Scoreboard**: Safe team identity resolver fallbacks, defensive null-checks in player sorting, and unique composite DOM keys.
  - **Focused Player**: Resolved memory leak by revoking old Blob URLs (`URL.revokeObjectURL`) on unmount and image refreshes; hardened weapon and utility array accesses.
  - **Series Graph & Round Graph**: Fixed division by zero and `NaN` round limits by validating `mp_maxrounds` (MR12) and `mp_overtime_maxrounds`.
  - **Clutch Banner**: Fixed live bomb phase detection to check root `gsiState.bomb.state` instead of nested round property; extended visibility across all in-game scenes (`default`, `ingame`, `radar`).
  - **Round Result Banner**: Eliminated banner blink by clearing active timeouts prior to new round events; strengthened win reason deductions and match point checks.
- **Dependencies**:
  - Removed unused dependency `tiny-emitter`.

---

## [3.0.1] - 2026-09-26
- Performance refinements in WebSocket state broadcasting.
- Fixed map name normalization for workshop maps.

## [3.0.0] - 2026-09-20
- Initial major release of NeuronCast CS2 broadcast suite.
- Integrated NetCon TCP spectator switching and touch-first PWA mobile remote.

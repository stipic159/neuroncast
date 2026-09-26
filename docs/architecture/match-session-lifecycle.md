# Match Session Lifecycle & Telemetry Architecture

This document describes NeuronCast's local-first Counter-Strike 2 match session lifecycle, persistent storage design, and telemetry transition events.

---

## 1. Boundary & Design Philosophy

The NeuronCast Match Session system operates under strict local-first, low-overhead constraints:
- **No Video Recording/Capture**: NeuronCast records telemetry and GSI event transitions only. It does not access the video feed or handle highlights/replays.
- **No OBS Scenes Control**: NeuronCast does not interface with OBS orchestrations.
- **No Database Engine**: Storage is 100% file-based. It requires zero network connectivity and runs entirely on the local loopback.
- **Safe Fallbacks & No-Ops**: If no session is actively created/selected by the operator, the recording pipeline sits in a safe, minimal-overhead no-op state, ensuring live broadcast rendering is completely unaffected.

---

## 2. Directory Layout & Storage Format

Sessions are written to the local userspace folder:
`userspace/sessions/`

Each session resides in a slug-named folder using the standard format:
`YYYY-MM-DD_<team-a>_vs_<team-b>_<short-id>`

Inside a session's directory, the following flat-files exist:

```
userspace/sessions/<session-slug>/
  ├── metadata.json
  ├── maps.json
  ├── timeline.jsonl
  ├── snapshots.jsonl
  └── summary.json
```

### File Specifications

- **`metadata.json`**: Describes the session configuration, team setups, and match formats.
- **`summary.json`**: Tracks observer summary statistics (e.g. rounds/maps seen, events logged, first/last GSI timestamp). Written atomically using a temporary write and rename pattern.
- **`maps.json`**: A readable JSON array list of map names played.
- **`timeline.jsonl`**: A line-delimited JSONL log of transition telemetry events (append-only).
- **`snapshots.jsonl`**: A line-delimited JSONL log of lightweight match state snapshots (append-only) captured on key transitions.

---

## 3. Transition Events & Telemetry

Instead of logging every raw GSI frame (which runs at 20Hz and consumes massive space), NeuronCast processes GSI frames and detects state transitions. 

The following event types are recorded with structured actor, target, team, and data payloads:

| Event Type | Trigger | Data Payload |
| :--- | :--- | :--- |
| `match/session_started` | Session created or activated | Active metadata |
| `match/session_ended` | Session closed by operator | Ending status |
| `map/map_changed` | Map name changes in telemetry | Map name, previous map |
| `round/freezetime_started` | CS2 round state enters freezetime | Current round number |
| `round/live_started` | CS2 round state enters live combat | Current round number |
| `round/over` | CS2 round winner declared | Winner team, Ct/T scores |
| `bomb/planted` | Bomb successfully planted | Bombsite (A/B) |
| `bomb/defused` | Bomb successfully defused | None |
| `bomb/exploded` | Bomb detonates | None |
| `player/kill` | Player's cumulative GSI kills increment | Derived actor, `confidence: "derived"` |
| `player/death` | Player's cumulative GSI deaths increment | Derived target, `confidence: "derived"` |
| `team/score_changed` | Map team scores change | CT and T scores |
| `gsi/stale` | Telemetry GSI heartbeats stop (5s) | None |
| `gsi/resumed` | Telemetry GSI heartbeats resume | None |

### Conservative Derived Kills & Deaths
NeuronCast handles cumulative kill/death telemetry carefully to prevent bad logs:
- Joining players or uninitialized rosters are silently registered without triggering false kills/deaths.
- Legitimate increments during live session matches log the exact delta with a `"confidence": "derived"` attribute.

---

## 4. Local API Endpoints

All session routes are completely local, isolated, and return structured JSON:

- **`GET /api/sessions`**: Returns all sessions, sorted by date (newest first).
- **`GET /api/sessions/active`**: Returns active session metadata, or `{"active": false, "session": null}` if none.
- **`POST /api/sessions`**: Create a new session (body: metadata).
- **`POST /api/sessions/active/:sessionId`**: Activate or switch to a specific session ID.
- **`POST /api/sessions/end`**: Cleanly end the current active session.
- **`GET /api/sessions/:sessionId`**: Get a session's metadata and summary.
- **`GET /api/sessions/:sessionId/timeline`**: Read and parse all logged timeline events.
- **`GET /api/sessions/:sessionId/summary`**: Get a session's summary JSON.
- **`GET /api/sessions/:sessionId/snapshots`**: Read and parse all logged state snapshots.

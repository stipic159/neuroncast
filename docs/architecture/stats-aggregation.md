# Match Statistics Aggregation Architecture

This document describes the architectural flow and implementation details of NeuronCast's local-first **Match Statistics Aggregation & Export Layer** (Phase 16B).

## Core Concepts

NeuronCast tracks match state at the event level. In order to present a unified statistical view and export options to the operator, these granular timeline telemetry events must be combined with cumulative Game State Integration (GSI) transition snapshots.

```
                  GSI Telemetry Stream
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      timeline.jsonl              snapshots.jsonl
    (Granular Events)          (Transition Checkpoints)
              │                           │
              └─────────────┬─────────────┘
                            ▼
                  stats-aggregator.js
              (Replays events & reconciles
                assists/MVPs from snaps)
                            │
                            ▼
                        stats.json
                  (Atomic Flat File)
```

### Data Sources & Confidence Indication

To protect against data gaps caused by missed ticks, round restarts, or server interruptions, NeuronCast categorizes player statistics with explicit source and confidence levels:

1. **Kills & Deaths**
   - **Source**: Timeline sequential event stream (`timeline.jsonl`).
   - **Confidence**: `derived` (computed using event loops tracking `player/kill` and `player/death`).
2. **Assists & MVPs**
   - **Source**: Cumulative checkpoints (`snapshots.jsonl`).
   - **Confidence**: `snapshot` (synchronized directly from cumulative game stats recorded in transition snapshots).
   - **Fallback**: `unavailable` (sets value to `0`/`null` if snapshots are absent or corrupt).

---

## Processing Flow

The engine (`src/server/sessions/stats-aggregator.js`) operates via a sequential replay mechanism:

1. **Read & Parse Logs**:
   Reads `timeline.jsonl` and `snapshots.jsonl` from the local session directory.
   - **Safety Boundary**: Parses lines individually; malformed JSONL lines are skipped with warnings and never crash the process.
2. **Replay Timeline Events**:
   Loops through all events chronologically to record kills, deaths, bomb actions, first kills, first deaths, and compute the exact active round duration (between `round/live_started` and `round/over` signals).
3. **Consolidate Checkpoint Metrics**:
   Replays transition snapshots to extract cumulative assists, MVPs, team layouts, and map score states.
4. **Compile & Save**:
   Computes K/D ratios, rounds up team totals, and writes `stats.json` **atomically** using the temporary-write-and-rename pattern to prevent file corruption.

---

## Lazy Rebuilding Behavior

Statistics are generated incrementally as events are written during the session. However, to guarantee robustness against disk or server anomalies, a **lazy-rebuild preflight** is wired into the reading pipeline:

- When `GET /api/sessions/:sessionId` (session details) or export requests are made, NeuronCast checks if `stats.json` exists and is readable.
- If missing or corrupt, `rebuildSessionStats(sessionId)` is triggered automatically in the background before serving the request.

---

## Export Implementation

Exporting compiled statistics is critical for post-match analysis in spreadsheets (e.g. Microsoft Excel or Google Sheets) or external JSON engines:

### 1. UTF-8 CSV Exporter
- **File**: `src/server/sessions/session-export.js` -> `exportSessionToCsv(sessionId)`
- **CSV Injection (Formula Protection)**: Automatically strips or neutralizes formula characters (`=`, `+`, `-`, `@`) in team/player strings by prepending a single quote `'`.
- **Double-Quoting**: Safely wraps and escapes commas, quotes, and newlines in text fields.
- **Layout**: Provides a clean metadata block followed by a flat player statistical table sorted by kills.

### 2. Structured JSON Exporter
- **File**: `src/server/sessions/session-export.js` -> `exportSessionToJson(sessionId)`
- **Structure**: Bundles metadata, summary, statistics, `generatedAt` timestamp, and a `confidenceNotes` dictionary.

# Phase 16B Verification Checkpoint

This checklist details the steps to verify that the statistics aggregation engine, export endpoints, lazy rebuilding mechanisms, and Dashboard UI are working safely and correctly.

## 1. Automated Tests & Code Integrity
- [ ] Run `npm run theme:validate` to ensure no linting or config violations exist.
- [ ] Inspect `src/server/sessions/stats-aggregator.js` to confirm all timeline and snapshot reading blocks run under robust try-catch boundaries.

## 2. Lazy Rebuilding Verification
- [ ] Locate a recent match session folder in `src/themes/userspace/sessions/`.
- [ ] Delete `stats.json` inside that directory.
- [ ] Execute `GET /api/sessions/:sessionId` (replacing `:sessionId` with the session's folder name or slug).
- [ ] Verify that `stats.json` is recreated automatically and the JSON response contains the correct `{ metadata, summary, stats }` fields.

## 3. CSV Injection & Escaping Verification
- [ ] Edit a player name in `snapshots.jsonl` to include formula-leading values (e.g. `=SUM(A1:A5)` or `+Astralis`).
- [ ] Run a lazy stats rebuild by hitting `GET /api/sessions/:sessionId/export/csv`.
- [ ] Inspect the downloaded CSV contents:
  - [ ] Confirm that player names containing commas are wrapped in quotes.
  - [ ] Confirm that quotes inside strings are doubled (`""`).
  - [ ] Confirm that formula-leading values are escaped with a prepended single quote (e.g., `'=SUM(A1:A5)`).
  - [ ] Confirm that no newlines exist in the CSV content fields (all CRLF replaced by a space).

## 4. UI Preview Verification
- [ ] Start NeuronCast locally and log into the Config SPA Dashboard.
- [ ] Select an active match session.
- [ ] Verify that the **Live Statistics** panel appears and contains:
  - [ ] Home and Away team round wins, kills, deaths, plants, and defuses displayed in a side-by-side grid.
  - [ ] **Top Fraggers** card listing the top 5 players sorted by kills (showing name, K, D, A, K/D, and MVPs).
  - [ ] Match duration and overall plant/defuse counts.
  - [ ] CSV and JSON download links triggering file saves.
- [ ] Verify that when no active session is selected, the panel displays a clean "No active match telemetry session is running" message.

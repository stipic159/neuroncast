# ApexPlay bridge

Forwards live CS2 scores from EON's parsed GSI state to a remote **ApexPlay** tournament
server, so ApexPlay shows live scores without manual updates.

EON runs on the observer machine and can reach the public ApexPlay server; ApexPlay cannot
reach EON, so EON pushes the data outward. Mapping is by **steamid** — EON sends each side's
steamids, and ApexPlay uses them to identify the match and which team is currently CT vs T
(scores survive side swaps). When unconfigured/disabled it's a complete no-op.

## Configure

In ApexPlay: open the tournament → **Control → EON live scores → Enable bridge**, and copy the
**endpoint URL** and **token** it shows.

Then point EON's bridge at it — either via env (e.g. in `ecosystem.config.cjs` or your shell):

```
APEXPLAY_BRIDGE_ENABLED=1
APEXPLAY_BRIDGE_URL=https://your-apexplay-host
APEXPLAY_BRIDGE_TOKEN=eon_xxxxxxxxxxxx
```

…or via a JSON file `apexplay-bridge.json` in the EON working directory (or set
`APEXPLAY_BRIDGE_CONFIG=/path/to/file`):

```json
{ "enabled": true, "url": "https://your-apexplay-host", "token": "eon_xxxxxxxxxxxx" }
```

Config is re-read every ~5 seconds, so changes take effect without a restart.

## How it works

`src/server/apexplay-bridge.js` hooks into the per-frame broadcast (`throttleBroadcast` in
`src/server/gsi.js`). On a score/round change it POSTs to `${url}/api/webhooks/eon`:

```json
{
  "map":   { "name": "de_dust2", "phase": "live" },
  "round": { "phase": "live" },
  "ct":    { "score": 13, "series": 0, "steamids": ["7656..."] },
  "t":     { "score": 7,  "series": 0, "steamids": ["7656..."] }
}
```

Pushes are throttled to ~3/s on change with a 5s heartbeat, single request in flight, and
network errors are swallowed (never disturbs EON's hot path).

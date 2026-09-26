# Runtime Resilience Layer

This document details NeuronCast's runtime resilience layer, highlighting client-side recovery, HUD connection awareness, server crash safety, and GSI parser guards.

---

## 1. Client-Side WebSocket Recovery

NeuronCast's browser client (`/hud`, `/config`, and `/radar`) implements an autonomous auto-recovery websocket controller in `src/themes/raw/core/websocket.js`:

### Recovery Characteristics:
- **Capped Exponential Backoff**: The initial reconnect delay is `500ms`, doubling on each subsequent failure up to a maximum safety ceiling of `10000ms` (10 seconds) to avoid spamming local network resources.
- **Counter Tracking**: Logs the retry attempt index to the console (`Reconnect attempt #N in Xms...`).
- **Reset Trigger**: Clears and resets the reconnect counter back to zero immediately upon a successful connection (`Websocket connection established. Reconnect attempts reset.`).
- **Memory Leak & Leak Safeguards**:
  - Closes any pre-existing dangling sockets before instantiating a new one.
  - Explicitly nullifies all socket event handlers (`onopen`, `onmessage`, `onerror`, `onclose`) of the discarded connection to ensure no memory leak or duplicate message handlers exist.
- **Duplicate Connection Guards**: Checks the `readyState` of the current socket. If it is already `CONNECTING` or `OPEN`, the initialization aborts, preventing concurrent socket leakage.

---

## 2. HUD Connection Awareness

The connection status is reactive and bound to NeuronCast's state management via `additionalState.connectionState` (values: `'connected'`, `'reconnecting'`, `'disconnected'`).

### HUD Styling Integration
The root viewport element in the production broadcast shell (`src/themes/default/shell/shell.html`) automatically binds these statuses as layout-level classes:

```html
<div class="hud-viewport --scene-default --style-slanted ws-connected">
```

This allows custom themes to declare responsive visual cues, telemetry warnings, or operator indicators cleanly using modern styling:

```css
/* Custom visual adjustments based on stale state */
.hud-viewport.ws-reconnecting .some-telemetry-badge {
    animation: pulse-yellow 1.5s infinite alternate;
}
```

---

## 3. Server Crash Safety & Clean Shuts

The Node.js server (`src/server/index.js`) features global process event bindings to guarantee uptime reliability and prevent orphan port bindings during production runs:

### Graceful Termination
Listens to `SIGINT` (Ctrl+C) and `SIGTERM` signals:
1. Closes the WebSocket server cleanly, informing connected overlay clients.
2. Closes the HTTP server, releasing port `31982`.
3. Exits with status `0` after releasing all system descriptors.
4. **Safety Timeout**: Registers a `3000ms` timer that forces a hard exit if system resources or connections are hanging during closing.

### Telemetry for Critical Errors
Registers listeners for `uncaughtException` and `unhandledRejection` to catch and record fatal errors before invoking clean shutdowns, ensuring that error trace outputs are explicitly outputted to logs.

---

## 4. CS2 GSI Parser Safeguards

CS2 Game State Integration can occasionally output incomplete, partial, or malformed body payloads (e.g. during map transitions, user disconnects, or demo fast-forwards).

NeuronCast includes defensive property guards inside `src/server/gsi.js` within `processAllPlayers()`:
- **Null Player Checks**: Bypasses processing if `allplayers` maps empty or undefined steamIDs.
- **Optional Chaining & Nullish Coalescing**: Uses `player.state?.round_totaldmg ?? 0` and similar nullish fallbacks.
- **Missing Object Defense**: Guards the health accumulator, preventing server crashes if the `state` sub-object is missing on a player payload.

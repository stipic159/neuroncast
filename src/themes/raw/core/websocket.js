import { additionalState } from '/hud/core/state.js'
import { onMessage } from '/hud/core/websocket-on-message.js'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
export let ws

let reconnectAttempts = 0;
const INITIAL_DELAY = 500;
const MAX_DELAY = 10000;
let reconnectTimer = null;
let watchdogTimer = null;
let lastHeartbeat = Date.now();

const resetWatchdog = () => {
	lastHeartbeat = Date.now();
};

const startWatchdog = () => {
	stopWatchdog();
	lastHeartbeat = Date.now();
	// Check every 5 seconds; if no message received in 25 seconds, force self-heal reconnect
	watchdogTimer = setInterval(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ event: 'ping' }));
			} catch (_) {}
			if (Date.now() - lastHeartbeat > 25000) {
				console.warn('[HUD Watchdog] Connection frozen/stale (no packets in 25s). Self-healing reconnect...');
				try { ws.close(); } catch (_) {}
			}
		}
	}, 5000);
};

const stopWatchdog = () => {
	if (watchdogTimer) {
		clearInterval(watchdogTimer);
		watchdogTimer = null;
	}
};

export const connectToWebsocket = () => {
	// If there's an active or opening socket, do not instantiate a duplicate
	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return;
	}

	// Clean up any pending reconnect timer
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	stopWatchdog();

	// Clean up previous socket completely to avoid memory leaks / event handler duplication
	if (ws) {
		ws.onopen = null;
		ws.onmessage = null;
		ws.onerror = null;
		ws.onclose = null;
		try {
			ws.close();
		} catch (e) {}
		ws = null;
	}

	// Update client state to reflect connection attempt
	additionalState.connectionState = reconnectAttempts > 0 ? 'reconnecting' : 'disconnected';

	ws = new WebSocket(wsUrl);

	ws.onopen = () => {
		reconnectAttempts = 0;
		additionalState.connectionState = 'connected';
		resetWatchdog();
		startWatchdog();
		console.info('Websocket connection established. Reconnect attempts reset.');
	};

	ws.onmessage = (event) => {
		resetWatchdog();
		onMessage(event);
	};

	ws.onerror = (err) => {
		console.error('Websocket connection error; closing connection', err.message || err);
		// Let onclose handle the reconnect logic
		try { ws.close(); } catch (_) {}
	};

	ws.onclose = () => {
		stopWatchdog();
		ws = null;
		additionalState.connectionState = 'disconnected';
		reconnectAttempts++;
		
		const delay = Math.min(INITIAL_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_DELAY);
		console.warn(`Websocket connection closed. Reconnect attempt #${reconnectAttempts} in ${delay}ms...`);
		
		additionalState.connectionState = 'reconnecting';
		reconnectTimer = setTimeout(() => {
			connectToWebsocket();
		}, delay);
	};
}

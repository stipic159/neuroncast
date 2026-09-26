import { options } from '/hud/core/state.js'
import { handleRefresh } from '/hud/core/websocket-events/refresh.js'
import { handleState } from '/hud/core/websocket-events/state.js'

let lastWsTime = 0;
let wsQueue = [];
let wsRaf = null;

const processWsQueue = (timestamp) => {
	if (timestamp - lastWsTime < 16) {
		wsRaf = requestAnimationFrame(processWsQueue);
		return;
	}
	lastWsTime = timestamp;
	wsRaf = null;

	if (wsQueue.length === 0) return;

	const messages = [...wsQueue];
	wsQueue = [];

	// Parse messages once
	const parsed = [];
	let latestStateIdx = -1;

	messages.forEach((msg) => {
		try {
			const parsedMsg = JSON.parse(msg.data);
			parsed.push(parsedMsg);
			if (parsedMsg.event === 'state' || parsedMsg.event === 'gsi_update') {
				latestStateIdx = parsed.length - 1;
			}
		} catch (err) {
			parsed.push(null);
		}
	});

	parsed.forEach((msg, idx) => {
		if (!msg) return;

		// Dispatch a global event for components to listen to
		window.dispatchEvent(new CustomEvent(`socket:${msg.event}`, { detail: msg.body }));

		// Only process the latest state or gsi_update event in this batch
		if (msg.event === 'state' || msg.event === 'gsi_update') {
			if (idx !== latestStateIdx) {
				return; // Skip intermediate outdated state updates
			}
		}

		switch (msg.event) {
			case 'refresh': return handleRefresh(msg.body);
			case 'state': return handleState(msg.body);
			case 'gsi_update': return handleState(msg.body);
			case 'static_data': return handleState(msg.body);
			case 'config:update':
				if (msg.body.key) {
					if (msg.body.value !== undefined && msg.body.value !== null && msg.body.value !== '') {
						options[msg.body.key] = msg.body.value;
					} else {
						delete options[msg.body.key];
					}
					// TEMP DIAG: confirm websocket-on-message options identity and value
					if (msg.body.key.startsWith('layout.radar')) {
						console.log('[WS-onMessage] config:update radar key:', msg.body.key, '=', msg.body.value, '| options ref id:', options.__diagId ?? (options.__diagId = Math.random().toString(36).slice(2, 7)))
					}
				}
				break;
		}
	});
};

export const onMessage = (msg) => {
	wsQueue.push(msg);
	if (!wsRaf) {
		wsRaf = requestAnimationFrame(processWsQueue);
	}
};

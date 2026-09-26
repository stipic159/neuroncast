import { WebSocketServer, WebSocket } from 'ws'

import { additionalState, gsiState } from './state.js'
import { getSettings } from './settings.js'
import { isUiDevMode } from './dev-mode.js'
import { isAuthorizedControlSocket } from './auth.js'
import { clearThemeAssetCache } from './hud.js'

export class Websocket {
	constructor(server) {
		this.websocket = new WebSocketServer({ server })

		this.websocket.on('connection', (client, request) => {
			// Read-only state is pushed to every client (so overlays render on any
			// machine), but only trusted clients (loopback or valid token) may
			// inject draw:/config: control events into the broadcast.
			client._eonTrusted = isAuthorizedControlSocket(request)

			this.sendState(client)

			client.on('message', (data) => {
				try {
					const { event, body } = JSON.parse(data)
					// Relay drawing and config events to all clients
					if (event && (event.startsWith('draw:') || event.startsWith('config:'))) {
						if (!client._eonTrusted) return
						this.broadcastToWebsockets(event, body)
					}
				} catch (err) {
					console.error('Error handling websocket message:', err)
				}
			})
		})

		this.bombsitesCache = {}
		this.optionsCache = {}
		this.radarsCache = {}
	}

	async init() {
		await this.updateCaches()
	}

	async updateCaches() {
		// Theme/config changed — drop the assembled-asset cache so HUD clients pick
		// up the new files on their next load/refresh.
		clearThemeAssetCache()

		const { bombsites, radars, settings } = await getSettings()

		this.bombsitesCache = bombsites
		this.optionsCache = Object.fromEntries(Object.entries(settings.options).map(([key, { fallback, value }]) => [key, value ?? fallback]))
		this.radarsCache = radars

		// Static data changed? Tell clients to refresh their menus/static state
		this.broadcastToWebsockets('static_data', {
			bombsites: this.bombsitesCache,
			options: this.optionsCache,
			radars: this.radarsCache,
			isFullState: true,
		})
	}

	getState() {
		return {
			additionalState,
			gsiState,
			uiDevMode: isUiDevMode,

			bombsites: this.bombsitesCache,
			options: this.optionsCache,
			radars: this.radarsCache,
			unixTimestamp: Date.now(),
		}
	}

	broadcastToWebsockets(event, body) {
		// Update optionsCache if this is a config update
		if (event === 'config:update' && body.key) {
			this.optionsCache[body.key] = body.value;
		}

		const message = body !== undefined
			? JSON.stringify({ event, body })
			: JSON.stringify({ event })

		for (const client of this.websocket.clients) {
			if (client.readyState !== WebSocket.OPEN) continue
			client.send(message)
		}
	}

	sendState(client) {
		const state = this.getState()
		client.send(JSON.stringify({ 
			event: 'state', 
			body: { ...state, isFullState: true } 
		}))
	}

	broadcastState() {
		// Optimization: GSI updates only broadcast the dynamic part of the state
		this.broadcastToWebsockets('gsi_update', {
			gsiState,
			additionalState,
			uiDevMode: isUiDevMode,
			unixTimestamp: Date.now(),
		})
	}

	broadcastRefresh() {
		// A refresh always implies the operator changed something on disk.
		clearThemeAssetCache()
		this.broadcastToWebsockets('refresh', {})
	}
}

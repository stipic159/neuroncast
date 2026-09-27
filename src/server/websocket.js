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
			client.isAlive = true
			client.on('pong', () => { client.isAlive = true })

			// Защита от аварийного падения Node.js процесса при резком дисконнекте сокета клиентом
			client.on('error', (err) => {
				console.error('WebSocket client error:', err.message)
			})

			// Read-only state is pushed to every client (so overlays render on any
			// machine), but only trusted clients (loopback or valid token) may
			// inject draw:/config: control events into the broadcast.
			client._eonTrusted = isAuthorizedControlSocket(request)

			this.sendState(client)

			client.on('message', (data) => {
				try {
					// Guard against oversized WebSocket control payloads (> 1MB)
					if (data && data.length > 1024 * 1024) {
						return
					}
					// Избегаем лишних парсингов и аллокаций, если сообщение слишком короткое или невалидное
					const parsed = JSON.parse(data)
					if (parsed.event === 'ping') {
						if (client.readyState === WebSocket.OPEN) {
							client.send(JSON.stringify({ event: 'pong', at: Date.now() }))
						}
						return
					}

					const { event, body } = parsed
					// Relay drawing and config events to all clients
					if (event && (event.startsWith('draw:') || event.startsWith('config:'))) {
						if (!client._eonTrusted) return
						this.broadcastToWebsockets(event, body)
					}
				} catch (err) {
					console.error('Error handling websocket message:', err.message)
				}
			})
		})

		// Heartbeat ping interval to clean dead connections & unstick frozen sockets
		this.pingInterval = setInterval(() => {
			for (const client of this.websocket.clients) {
				if (client.isAlive === false) {
					try { client.terminate() } catch (_) {}
					continue
				}
				client.isAlive = false
				try { client.ping() } catch (_) {}
			}
		}, 15000)
		if (this.pingInterval.unref) this.pingInterval.unref()

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
		this.radarsCache = radars

		// Быстрый сбор объекта без тройного создания промежуточных массивов (Object.entries -> map -> Object.fromEntries)
		const options = {}
		const rawOptions = settings?.options || {}
		for (const key in rawOptions) {
			const opt = rawOptions[key]
			options[key] = opt?.value ?? opt?.fallback ?? null
		}
		this.optionsCache = options

		// Static data changed? Tell clients to refresh their menus/static state
		this.broadcastToWebsockets('static_data', {\tbombsites: this.bombsitesCache,
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
		if (event === 'config:update' && body?.key) {
			this.optionsCache[body.key] = body.value
		}

		// Если нет активных клиентов, прерываемся ДО сериализации JSON
		// (критично для частых GSI-тиков при отключенных оверлеях)
		if (this.websocket.clients.size === 0) return

		let message
		try {
			message = body !== undefined
				? JSON.stringify({ event, body })
				: JSON.stringify({ event })
		} catch (err) {
			console.error('Error serializing websocket message:', err.message)
			return
		}

		for (const client of this.websocket.clients) {
			if (client.readyState !== WebSocket.OPEN) continue
			try {
				client.send(message)
			} catch (err) {
				console.error('Error broadcasting message to websocket client:', err.message)
			}
		}
	}

	sendState(client) {
		if (!client || client.readyState !== WebSocket.OPEN) return
		try {
			// Мутируем только что созданный в getState объект вместо лишнего поверхностного копирования {...state}
			const state = this.getState()
			state.isFullState = true

			client.send(JSON.stringify({
				event: 'state',
				body: state
			}))
		} catch (err) {
			console.error('Error sending state to client:', err.message)
		}
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

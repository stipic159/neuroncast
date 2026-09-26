import { OBSWebSocket } from 'obs-websocket-js'
import { readJson, writeJson } from '../helpers/json-file.js'
import { userspaceDirectory } from '../helpers/paths.js'
import { join } from 'path'

const CONFIG_FILE = join(userspaceDirectory, 'obs.json')

const DEFAULT_CONFIG = {
	enabled: false,
	host: '127.0.0.1',
	port: 4455,
	password: '',
	autoReconnect: true,
	reconnectIntervalMs: 5000,
	micSourceName: '',
	mainSceneName: '',         // Main OBS broadcast scene (CS2 + HUD layer)
	intermissionSceneName: '', // Optional secondary scene (e.g. Caster Cam / Break)
}

class ObsManager {
	constructor() {
		this.obs = new OBSWebSocket()
		this.config = { ...DEFAULT_CONFIG }
		this.connected = false
		this.connecting = false
		this.lastError = null
		this.lastLoggedError = null
		this.reconnectTimer = null
		this.reconnectAttempts = 0
		this.scenes = []
		this.currentScene = ''
		this.micMuted = false
		this.replayBufferActive = false
		this.listeners = new Set()

		this.setupEventHandlers()
	}

	async init() {
		await this.loadConfig()
		if (this.config.enabled) {
			this.connect({ silent: true }).catch(() => {
				// Suppress initial background rejection
			})
		}
	}

	async loadConfig() {
		try {
			const saved = await readJson(CONFIG_FILE)
			this.config = {
				...DEFAULT_CONFIG,
				...saved,
			}
		} catch (_) {
			this.config = { ...DEFAULT_CONFIG }
		}
	}

	async saveConfig(newConfig) {
		this.config = {
			...this.config,
			...newConfig,
		}

		await writeJson(CONFIG_FILE, this.config)
		this.notifyState()

		// Reconnect if connection parameters changed or newly enabled
		if (this.config.enabled) {
			if (!this.connected && !this.connecting) {
				await this.connect({ silent: true }).catch(() => {})
			}
		} else if (this.connected) {
			await this.disconnect()
		}
	}

	setupEventHandlers() {
		this.obs.on('ConnectionClosed', () => {
			const wasConnected = this.connected
			this.connected = false
			this.connecting = false
			this.notifyState()
			if (wasConnected) {
				console.info('[OBS] Disconnected from OBS Studio. Reconnecting in background...')
			}
			this.scheduleReconnect()
		})

		this.obs.on('ConnectionError', (err) => {
			this.lastError = err?.message || 'Connection error'
			this.connected = false
			this.connecting = false
			this.notifyState()
			this.scheduleReconnect()
		})

		this.obs.on('CurrentProgramSceneChanged', (data) => {
			this.currentScene = data.sceneName
			this.notifyState()
		})

		this.obs.on('SceneListChanged', async () => {
			await this.refreshScenes()
		})

		this.obs.on('InputMuteStateChanged', (data) => {
			if (this.config.micSourceName && data.inputName === this.config.micSourceName) {
				this.micMuted = data.inputMuted
				this.notifyState()
			}
		})

		this.obs.on('ReplayBufferStateChanged', (data) => {
			this.replayBufferActive = data.outputActive
			this.notifyState()
		})
	}

	async connect({ silent = false } = {}) {
		if (this.connecting || this.connected) return

		this.connecting = true
		this.lastError = null
		this.notifyState()

		const url = `ws://${this.config.host || '127.0.0.1'}:${this.config.port || 4455}`

		try {
			await this.obs.connect(url, this.config.password || undefined, {
				eventSubscriptions: 0 | (1 << 0) | (1 << 2) | (1 << 3) | (1 << 6), // General, Scenes, Inputs, Outputs
			})

			this.connected = true
			this.connecting = false
			this.lastError = null
			this.lastLoggedError = null
			console.info(`[OBS] Successfully connected to OBS Studio WebSocket at ${url}`)

			await this.refreshScenes()
			await this.checkMicState()
			await this.checkReplayBufferState()
			this.notifyState()
		} catch (err) {
			this.connected = false
			this.connecting = false
			this.lastError = err?.message || 'Failed to connect to OBS'

			// Log only when error state changes or when explicitly requested by manual click
			if (!silent || this.lastLoggedError !== this.lastError) {
				this.lastLoggedError = this.lastError
				console.warn(`[OBS] Connection to OBS (${url}) unavailable: ${this.lastError}`)
			}

			this.notifyState()
			this.scheduleReconnect()

			if (!silent) {
				throw err
			}
		}
	}

	async disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		try {
			await this.obs.disconnect()
		} catch (_) {
			// ignore disconnect error
		} finally {
			this.connected = false
			this.connecting = false
			this.notifyState()
		}
	}

	scheduleReconnect() {
		if (!this.config.enabled || !this.config.autoReconnect) return
		if (this.reconnectTimer) return

		this.reconnectTimer = setTimeout(async () => {
			this.reconnectTimer = null
			if (this.config.enabled && !this.connected && !this.connecting) {
				try {
					await this.connect({ silent: true })
				} catch (_) {
					// silently handled
				}
			}
		}, this.config.reconnectIntervalMs || 5000)
	}

	async refreshScenes() {
		if (!this.connected) return
		try {
			const res = await this.obs.call('GetSceneList')
			this.scenes = (res.scenes || []).map((s) => s.sceneName || s)
			this.currentScene = res.currentProgramSceneName || ''
			this.notifyState()
		} catch (err) {
			console.warn('[OBS] Could not fetch scene list:', err.message)
		}
	}

	async checkMicState() {
		if (!this.connected || !this.config.micSourceName) return
		try {
			const res = await this.obs.call('GetInputMute', { inputName: this.config.micSourceName })
			this.micMuted = res.inputMuted
		} catch (_) {
			// Source might not exist or not be audio
		}
	}

	async checkReplayBufferState() {
		if (!this.connected) return
		try {
			const res = await this.obs.call('GetReplayBufferStatus')
			this.replayBufferActive = res.outputActive
		} catch (_) {
			// Replay buffer might not be configured
		}
	}

	async setScene(sceneName) {
		if (!this.connected) throw new Error('OBS not connected')
		await this.obs.call('SetCurrentProgramScene', { sceneName })
		this.currentScene = sceneName
		this.notifyState()
	}

	async switchRoleScene(role) {
		let targetScene = ''
		if (role === 'main') {
			targetScene = this.config.mainSceneName
		} else if (role === 'intermission' || role === 'caster') {
			targetScene = this.config.intermissionSceneName
		}

		if (!targetScene) {
			throw new Error(`No OBS scene mapped for role: ${role}`)
		}
		await this.setScene(targetScene)
	}

	async toggleMicMute() {
		if (!this.connected) throw new Error('OBS not connected')
		if (!this.config.micSourceName) throw new Error('No microphone source configured')

		const res = await this.obs.call('ToggleInputMute', { inputName: this.config.micSourceName })
		this.micMuted = res.inputMuted
		this.notifyState()
		return this.micMuted
	}

	async saveReplayBuffer() {
		if (!this.connected) throw new Error('OBS not connected')
		await this.obs.call('SaveReplayBuffer')
	}

	getStatus() {
		return {
			enabled: this.config.enabled,
			connected: this.connected,
			connecting: this.connecting,
			lastError: this.lastError,
			currentScene: this.currentScene,
			scenes: this.scenes,
			micMuted: this.micMuted,
			micSourceName: this.config.micSourceName,
			mainSceneName: this.config.mainSceneName,
			intermissionSceneName: this.config.intermissionSceneName,
			replayBufferActive: this.replayBufferActive,
			host: this.config.host,
			port: this.config.port,
		}
	}

	subscribe(fn) {
		this.listeners.add(fn)
		return () => this.listeners.delete(fn)
	}

	notifyState() {
		const status = this.getStatus()
		for (const listener of this.listeners) {
			try {
				listener(status)
			} catch (err) {
				console.error('[OBS] Listener error:', err)
			}
		}
	}
}

export const obsManager = new ObsManager()

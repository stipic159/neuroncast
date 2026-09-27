import { highlightDetector } from './highlight-detector.js'
import { obsManager as defaultObsManager } from '../integrations/obs-manager.js'

export class AutoReplayService {
	constructor(dependencies = {}) {
		this.highlights = []
		this.lastSaveTime = 0
		this.cooldownMs = 12000 // 12 seconds cooldown between auto-saves
		this.websocket = dependencies.ws || dependencies.websocket || null
		this.obsManager = dependencies.obsManager || defaultObsManager
		this.options = {}

		this.setupListener()
	}

	setWebsocket(ws) {
		this.websocket = ws
	}

	setOptions(opts = {}) {
		this.options = opts
	}

	setupListener() {
		highlightDetector.on('highlight', (hl) => {
			this.handleHighlight(hl)
		})
	}

	pushHighlight(hl) {
		this.handleHighlight(hl)
	}

	handleHighlight(hl) {
		this.highlights.unshift(hl)
		if (this.highlights.length > 50) {
			this.highlights.pop()
		}

		// Broadcast new highlight to all connected UI clients
		this.websocket?.broadcastToWebsockets?.('HIGHLIGHT_DETECTED', hl)
		this.websocket?.broadcastToWebsockets?.('highlight:new', hl)

		// Check if auto replay saving is enabled for this highlight type
		const enabled = this.options['director.autoReplay.enabled'] ?? true
		if (!enabled) return

		let shouldSave = false
		if (hl.type.startsWith('CLUTCH_1V')) {
			const minClutch = Number(this.options['director.autoReplay.minClutch'] ?? 2)
			if ((hl.vsCount ?? 0) >= minClutch) {
				shouldSave = true
			}
		} else if (hl.type === 'ACE_5K') {
			shouldSave = this.options['director.autoReplay.saveAces'] ?? true
		} else if (hl.type === 'QUAD_4K') {
			shouldSave = this.options['director.autoReplay.save4K'] ?? true
		} else if (hl.type === 'PRESSURE_DEFUSE') {
			shouldSave = this.options['director.autoReplay.saveNinja'] ?? true
		}

		if (!shouldSave) return

		// Check cooldown
		const now = Date.now()
		if (now - this.lastSaveTime < this.cooldownMs) {
			console.log(`[AutoReplay] Highlight "${hl.headline}" detected but ignored due to cooldown.`)
			return
		}

		this.lastSaveTime = now
		const delayMs = Number(this.options['director.autoReplay.delayMs'] ?? 1800)

		console.log(`[AutoReplay] Scheduling OBS ReplayBuffer save for "${hl.headline}" in ${delayMs}ms...`)

		setTimeout(async () => {
			try {
				if (this.obsManager?.connected) {
					await this.obsManager.saveReplayBuffer()
					hl.savedInObs = true
					console.log(`[AutoReplay] Successfully saved OBS Replay Buffer for "${hl.headline}"!`)
					
					// Standardized contract event
					this.websocket?.broadcastToWebsockets?.('REPLAY_SAVED', hl)
					this.websocket?.broadcastToWebsockets?.('obs:replay_saved', {
						highlight: hl,
						savedAt: Date.now(),
					})
				} else {
					console.log(`[AutoReplay] OBS not connected, saved highlight metadata only.`)
					this.websocket?.broadcastToWebsockets?.('REPLAY_SAVED', hl)
				}
			} catch (err) {
				console.warn(`[AutoReplay] Could not save OBS replay buffer:`, err.message)
			}
		}, delayMs)
	}

	getHighlights() {
		return [...this.highlights]
	}

	clearHighlights() {
		this.highlights = []
		this.websocket?.broadcastToWebsockets?.('highlight:cleared', {})
	}

	async triggerReplay(highlightId) {
		return this.triggerManualReplay(highlightId)
	}

	async triggerManualReplay(highlightId) {
		let hl = this.highlights.find((h) => h.id === highlightId)
		if (!hl) {
			const nowSec = Math.floor(Date.now() / 1000)
			hl = {
				id: `rep_${nowSec}_manual`,
				round: 0,
				type: 'MANUAL',
				playerName: 'Caster',
				team: 'Broadcast',
				headline: 'Manual Replay Trigger',
				timestamp: nowSec,
			}
			this.highlights.unshift(hl)
		}

		if (this.obsManager?.connected) {
			await this.obsManager.saveReplayBuffer()
			hl.savedInObs = true
		}

		this.websocket?.broadcastToWebsockets?.('REPLAY_SAVED', hl)
		this.websocket?.broadcastToWebsockets?.('obs:replay_saved', {
			highlight: hl,
			savedAt: Date.now(),
			manual: true,
		})

		return hl
	}
}

export const autoReplayService = new AutoReplayService()

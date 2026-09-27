import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { additionalState, gsiState } from './state.js'
import { isUiDevMode } from './dev-mode.js'
import { customRootDirectory, userspaceDirectory } from './helpers/paths.js'
import { processGsiFrame, recordGsiStale } from './sessions/timeline-recorder.js'
import { maybePushApexPlay } from './apexplay-bridge.js'
import {
	resetVolatileMatchState,
	processPlayerAnalytics,
	handleRoundEnd,
	broadcastMvp
} from './analytics/round-analytics.js'

const GSI_TOKEN_FILE = path.join(userspaceDirectory, 'gsi-token.txt')
const GSI_CFG_FILE = path.join(customRootDirectory, 'gamestate_integration_neuroncast.cfg')

export const getOrGenerateGsiToken = () => {
	const envToken = process.env.GSI_TOKEN || process.env.NEURON_GSI_TOKEN
	if (envToken && envToken.trim()) return envToken.trim()

	try {
		const existing = fs.readFileSync(GSI_TOKEN_FILE, 'utf8').trim()
		if (existing) return existing
	} catch (_) {}

	const generated = crypto.randomBytes(16).toString('hex')
	try {
		if (!fs.existsSync(userspaceDirectory)) fs.mkdirSync(userspaceDirectory, { recursive: true })
		fs.writeFileSync(GSI_TOKEN_FILE, generated, 'utf8')
	} catch (e) {
		console.warn('[GSI] Could not save gsi-token.txt to userspace:', e.message)
	}
	return generated
}

export const syncGsiConfigFile = (token) => {
	const cfgContent = `"NeuronCast CS2 Game State Integration"
{
 "uri" "http://127.0.0.1:31982/gsi"
 "timeout" "5.0"
 "buffer"  "0.0"
 "throttle" "0.0"
 "heartbeat" "30.0"
 "auth"
 {
   "token" "${token}"
 }
 "data"
 {
   "provider"            "1"
   "map"                 "1"
   "round"               "1"
   "player_id"           "1"
   "player_state"        "1"
   "player_weapons"      "1"
   "player_match_stats"  "1"
   "allplayers_id"        "1"
   "allplayers_state"     "1"
   "allplayers_match_stats" "1"
   "allplayers_weapons"   "1"
   "allplayers_position"  "1"
   "phase_countdowns"    "1"
   "allgrenades"         "1"
 }
}
`
	try {
		let needWrite = true
		if (fs.existsSync(GSI_CFG_FILE)) {
			const current = fs.readFileSync(GSI_CFG_FILE, 'utf8')
			if (current.trim() === cfgContent.trim()) {
				needWrite = false
			}
		}
		if (needWrite) {
			fs.writeFileSync(GSI_CFG_FILE, cfgContent.trim() + '\n', 'utf8')
			console.log('[GSI] Auto-generated gamestate_integration_neuroncast.cfg with your unique token.')
			console.log('[GSI] Copy this file to: steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg/')
		}
	} catch (e) {
		console.warn('[GSI] Failed to write gamestate_integration_neuroncast.cfg:', e.message)
	}
}

const gsiToken = getOrGenerateGsiToken()
syncGsiConfigFile(gsiToken)

// Raw GSI session recorder with automatic retention & disk protection
const gsiRecordEnabled = process.env.EON_GSI_RECORD === '1' || process.env.NEURON_GSI_RECORD === '1'
let gsiRecordStream = null
let lastRetentionCheck = 0

const runGsiRetentionPolicy = (tmpDir) => {
	const now = Date.now()
	if (now - lastRetentionCheck < 3600000) return
	lastRetentionCheck = now

	try {
		if (!fs.existsSync(tmpDir)) return
		const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('gsi-') && f.endsWith('.jsonl'))
		const maxAgeMs = 7 * 24 * 3600 * 1000 // 7 days retention
		for (const file of files) {
			const filePath = path.join(tmpDir, file)
			try {
				const stat = fs.statSync(filePath)
				if (now - stat.mtimeMs > maxAgeMs) {
					fs.unlinkSync(filePath)
					console.log(`[GSI Retention] Removed old replay log: ${file}`)
				}
			} catch (_) {}
		}
	} catch (err) {
		console.warn('[GSI Retention] Failed to prune old logs:', err.message)
	}
}

const recordRawGsiFrame = (body) => {
	if (!gsiRecordEnabled) return
	const dir = path.join(process.cwd(), 'tmp')
	runGsiRetentionPolicy(dir)

	if (!gsiRecordStream) {
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
		const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
		const file = path.join(dir, `gsi-${stamp}.jsonl`)
		gsiRecordStream = fs.createWriteStream(file, { flags: 'a' })
		console.log(`[GSI] Recording raw replay session -> ${file}`)
	}
	const { auth, ...frame } = body
	gsiRecordStream.write(JSON.stringify({ t: Date.now(), frame }) + '\n')
}

export const lastGsiMeta = {
	acceptedAtUnixTimestamp: 0,
	authFailedAtUnixTimestamp: 0,
	lastError: null,
	lastMapName: null,
	lastPhase: null,
	lastUserAgent: null,
	requestCount: 0,
}

let lastBroadcastTs = 0
let broadcastTimer = null

const throttleBroadcast = (websocket) => {
	maybePushApexPlay(gsiState)

	const now = Date.now()
	const elapsed = now - lastBroadcastTs

	if (elapsed >= 50) { // 20Hz
		lastBroadcastTs = now
		if (broadcastTimer) clearTimeout(broadcastTimer)
		websocket.broadcastState()
	} else if (!broadcastTimer) {
		broadcastTimer = setTimeout(() => {
			lastBroadcastTs = Date.now()
			broadcastTimer = null
			websocket.broadcastState()
		}, 50 - elapsed)
	}
}

export const getState = () => ({
	gsiState,
	additionalState,
	unixTimestamp: lastGsiMeta.acceptedAtUnixTimestamp
})

const updateGsiState = (body) => {
	let hasPlayer = false

	for (const [key, value] of Object.entries(body)) {
		switch (key) {
			case 'added':
			case 'auth':
			case 'previously':
				continue

			case 'player':
				hasPlayer = true
				// intentional fallthrough!

			default:
				gsiState[key] = value
		}
	}

	if (!hasPlayer) {
		gsiState.player = null
	}

	if (!Object.hasOwn(body, 'bomb') || body.bomb == null) {
		gsiState.bomb = null
	}

	if (!Object.hasOwn(body, 'phase_countdowns') || body.phase_countdowns == null) {
		gsiState.phase_countdowns = null
	}

	if (!Object.hasOwn(body, 'map') || body.map == null) {
		gsiState.map = null
	}
}

const updateLastKnownMapName = (body) => {
	const previousMapName = additionalState.lastKnownMapName
	additionalState.lastKnownMapName = body.map?.name
	return {
		mapChanged: additionalState.lastKnownMapName !== previousMapName,
	}
}

const updateLastKnownBombPlantedCountdown = (body) => {
	const bomb = body.bomb
	if (bomb?.state === 'defusing') return

	if (!bomb || bomb.state !== 'planted') {
		additionalState.lastKnownBombPlantedCountdown = {}
		return
	}

	additionalState.lastKnownBombPlantedCountdown = {
		unixTimestamp: +new Date(),
		value: bomb.countdown,
	}
}

export const registerGsiRoutes = (router, websocket) => {
	setInterval(() => {
		if (isUiDevMode) return

		if (lastGsiMeta.acceptedAtUnixTimestamp === 0) {
			if (additionalState.gsiActive !== false) {
				additionalState.gsiActive = false
				recordGsiStale()
				websocket.broadcastState()
			}
			return
		}

		const elapsed = Date.now() - lastGsiMeta.acceptedAtUnixTimestamp
		if (elapsed > 5000) {
			if (additionalState.gsiActive !== false) {
				additionalState.gsiActive = false
				recordGsiStale()
				websocket.broadcastState()
			}
		}
	}, 1000)

	const handleGsiPost = (context) => {
		const userAgent = context.request.headers['user-agent'] || ''
		const body = context.request.body || {}
		const authToken = body.auth?.token
		lastGsiMeta.requestCount++
		lastGsiMeta.lastUserAgent = userAgent || null

		if (isUiDevMode) {
			lastGsiMeta.lastError = 'ui_dev_mode_ignored'
			return context.status = 204
		}

		if (gsiToken && authToken !== gsiToken) {
			lastGsiMeta.authFailedAtUnixTimestamp = Date.now()
			lastGsiMeta.lastError = 'auth_failed'
			return context.status = 401
		}

		const wasRoundFreezetime = gsiState.round?.phase === 'freezetime'
		const wasRoundLive = gsiState.round?.phase === 'live'
		const wasRoundOver = gsiState.round?.phase === 'over' || gsiState.round?.phase === 'timeout'
		
		const wasBombPlanted = gsiState.bomb?.state === 'planted'
		const wasMapActive = !!gsiState.map

		additionalState.gsiActive = true
		recordRawGsiFrame(body)
		updateGsiState(body)
		
		const { mapChanged } = updateLastKnownMapName(body)
		if (mapChanged || (!body.map && wasMapActive)) {
			resetVolatileMatchState()
			websocket.broadcastToWebsockets('MVP_DISPLAY', null)
		}

		updateLastKnownBombPlantedCountdown(body)

		// Caster Alerts
		if (body.bomb?.state === 'planted' && !wasBombPlanted) {
			websocket.broadcastToWebsockets('CASTER_ALERT', { message: 'Bomb Planted', type: 'warning' })
		} else if (body.bomb?.state === 'defused' && gsiState.bomb?.state !== 'defused') {
			websocket.broadcastToWebsockets('CASTER_ALERT', { message: 'Bomb Defused', type: 'success' })
		}

		// Clutch Logic: Initialize on round start
		if (gsiState.round?.phase === 'live' && !wasRoundLive) {
			additionalState.currentRoundProb = 0.5
			additionalState.probHistory = [0.5]
			additionalState.maxProbSwing = 0
			additionalState.roundKillStats = {}
		}

		// Player Analytics Pass
		processPlayerAnalytics(body, wasRoundFreezetime)

		if (!wasRoundFreezetime && gsiState.round?.phase === 'freezetime') {
			broadcastMvp(websocket)
		}

		// Logging & MVP tracking on round end
		if (gsiState.round?.phase === 'over' && !wasRoundOver) {
			handleRoundEnd(body)
		}

		if (wasRoundFreezetime && gsiState.round?.phase === 'live') {
			websocket.broadcastToWebsockets('MVP_DISPLAY', null)
		}

		// Process the GSI frame for timeline events & snapshots
		processGsiFrame(body)

		lastGsiMeta.acceptedAtUnixTimestamp = Date.now()
		lastGsiMeta.lastError = null
		lastGsiMeta.lastMapName = body.map?.name || null
		lastGsiMeta.lastPhase = body.phase_countdowns?.phase || body.round?.phase || null

		// Throttle broadcasts to 20Hz (50ms)
		throttleBroadcast(websocket)

		return context.status = 204
	}

	router.post('/', handleGsiPost)
	router.post('/gsi', handleGsiPost)
	router.post('/api/gsi', handleGsiPost)

	router.post('/api/gsi/status', (context) => {
		context.body = {
			gsiTokenConfigured: !!gsiToken,
			uiDevMode: isUiDevMode,
			lastGsiMeta,
			hasMapState: !!gsiState.map,
			hasPlayerState: !!gsiState.player,
			mapName: gsiState.map?.name || null,
			phase: gsiState.phase_countdowns?.phase || gsiState.round?.phase || null,
		}
	})
}

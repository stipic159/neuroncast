import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execSync, exec } from 'child_process'
import { additionalState, gsiState } from './state.js'
import { logRound } from './helpers/logger.js'
import { isUiDevMode } from './dev-mode.js'
import { builtinRootDirectory, customRootDirectory, userspaceDirectory, userspaceSettingsPath } from './helpers/paths.js'
import { readJsonIfExists } from './helpers/json-file.js'
import { getCacheMetadata } from './cache/scraper-cache.js'
import { LEGACY_TO_CANONICAL } from './helpers/canonical-map.js'
import { processGsiFrame, recordGsiStale } from './sessions/timeline-recorder.js'
import { getActiveSession, readSession } from './sessions/session-store.js'
import { maybePushApexPlay } from './apexplay-bridge.js'

const serverStartedAt = new Date().toISOString()

// Theme Validator Cache Variables (Phase 14B)
let lastThemeValidationAt = null
let lastThemeValidationStatus = "pending"
let lastThemeValidationDetails = null
let activeValidationPromise = null

function runThemeValidationCached() {
	if (activeValidationPromise) {
		return activeValidationPromise
	}

	// Cache validated for 30 seconds
	if (lastThemeValidationAt && (Date.now() - lastThemeValidationAt < 30000)) {
		return Promise.resolve({
			status: lastThemeValidationStatus,
			at: lastThemeValidationAt,
			details: lastThemeValidationDetails
		})
	}

	activeValidationPromise = new Promise((resolve) => {
		exec('node scripts/theme-validate.js --json', { cwd: builtinRootDirectory }, (err, stdout, stderr) => {
			lastThemeValidationAt = Date.now()
			activeValidationPromise = null
			try {
				const report = JSON.parse(stdout)
				lastThemeValidationStatus = report.passed ? "pass" : "fail"
				lastThemeValidationDetails = {
					errors: report.errors || [],
					warnings: report.warnings || [],
					stats: report.stats || {}
				}
			} catch (parseErr) {
				lastThemeValidationStatus = "fail"
				lastThemeValidationDetails = {
					errors: [{ message: `Failed to parse validation report JSON output: ${parseErr.message}` }],
					warnings: [],
					stats: {}
				}
			}
			resolve({
				status: lastThemeValidationStatus,
				at: lastThemeValidationAt,
				details: lastThemeValidationDetails
			})
		})
	})

	return activeValidationPromise
}

// Resolve package.json version
let appVersion = 'unknown'
try {
	const pkgPath = path.join(builtinRootDirectory, 'package.json')
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
	appVersion = pkg.version || 'unknown'
} catch (e) {
	appVersion = 'unknown'
}

// Resolve Git commit
let gitCommit = null
try {
	gitCommit = execSync('git rev-parse --short HEAD', {
		cwd: process.cwd(),
		stdio: ['ignore', 'pipe', 'ignore'],
	}).toString().trim()
} catch {
	gitCommit = null
}


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
   "bomb"                "1"
 }
}`

	try {
		let needWrite = true
		if (fs.existsSync(GSI_CFG_FILE)) {
			const existingCfg = fs.readFileSync(GSI_CFG_FILE, 'utf8')
			if (existingCfg.includes(token)) needWrite = false
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
// Raw GSI session recorder with automatic retention & disk protection (watchdog).
// Enabled by default only when explicitly set to '1' or in development replay mode.
const gsiRecordEnabled = process.env.EON_GSI_RECORD === '1' || process.env.NEURON_GSI_RECORD === '1'
let gsiRecordStream = null
let lastRetentionCheck = 0

const runGsiRetentionPolicy = (tmpDir) => {
	const now = Date.now()
	if (now - lastRetentionCheck < 3600000) return // Check once per hour
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
	const { auth, ...frame } = body // token has no business in a replay file
	gsiRecordStream.write(JSON.stringify({ t: Date.now(), frame }) + '\n')
}

let lastGsiMeta = {
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
	// Forward live scores to ApexPlay (no-op unless configured). Self-throttled by content.
	maybePushApexPlay(gsiState)

	const now = Date.now()
	const elapsed = now - lastBroadcastTs

	if (elapsed >= 50) { // 20Hz
		lastBroadcastTs = now
		if (broadcastTimer) clearTimeout(broadcastTimer)
		websocket.broadcastState()
	} else if (! broadcastTimer) {
		broadcastTimer = setTimeout(() => {
			lastBroadcastTs = Date.now()
			broadcastTimer = null
			websocket.broadcastState()
		}, 50 - elapsed)
	}
}

export const registerGsiRoutes = (router, websocket) => {
	setInterval(() => {
		if (isUiDevMode) return

		// If we've never received a GSI post, keep state as waiting and gsiActive false
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

		// Combined Player Processing pass
		processAllPlayers(body, mapChanged, wasRoundFreezetime)

		if (!wasRoundFreezetime && gsiState.round?.phase === 'freezetime') {
			broadcastMvp(websocket)
		}

		// Logging & MVP tracking on round end
		if (gsiState.round?.phase === 'over' && !wasRoundOver) {
			handleRoundEnd(body)
		}

		if (wasRoundFreezetime && gsiState.round?.phase === 'live') {
			websocket.broadcastToWebsockets('MVP_DISPLAY', null) // Hide MVP card
		}

		// Process the GSI frame for timeline events & snapshots safely
		processGsiFrame(body)

		lastGsiMeta.acceptedAtUnixTimestamp = Date.now()
		lastGsiMeta.lastError = null
		lastGsiMeta.lastMapName = body.map?.name || null
		lastGsiMeta.lastPhase = body.phase_countdowns?.phase || body.round?.phase || null

		// Throttle broadcasts to 20Hz (50ms) to save bandwidth and CPU
		throttleBroadcast(websocket)

		return context.status = 204
	}

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

	router.get('/api/status', (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		const connectedClients = websocket.websocket.clients.size
		const elapsedMs = lastGsiMeta.acceptedAtUnixTimestamp > 0
			? Date.now() - lastGsiMeta.acceptedAtUnixTimestamp
			: null

		let gsiStateStr = "waiting"
		if (lastGsiMeta.acceptedAtUnixTimestamp > 0) {
			gsiStateStr = (elapsedMs > 5000 && !isUiDevMode) ? "stale" : "active"
		} else if (isUiDevMode) {
			gsiStateStr = "active"
		}

		const activeSession = getActiveSession()
		let eventsRecorded = 0
		if (activeSession) {
			const sData = readSession(activeSession.id)
			if (sData && sData.summary) {
				eventsRecorded = sData.summary.eventsRecorded || 0
			}
		}

		context.body = {
			ok: true,
			gsiActive: isUiDevMode ? true : (lastGsiMeta.acceptedAtUnixTimestamp > 0 && elapsedMs <= 5000),
			gsiState: gsiStateStr,
			lastGsiSecondsAgo: elapsedMs !== null ? elapsedMs / 1000 : null,
			lastSuccessfulGsiAt: lastGsiMeta.acceptedAtUnixTimestamp > 0
				? new Date(lastGsiMeta.acceptedAtUnixTimestamp).toISOString()
				: null,
			uiDevMode: isUiDevMode,
			mapName: gsiState.map?.name || null,
			phase: gsiState.phase_countdowns?.phase || gsiState.round?.phase || null,
			connectedClients,
			appName: "NeuronCast",
			version: appVersion,
			gitCommit,
			serverStartedAt,
			uptimeSeconds: Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000),
			activeSessionId: activeSession ? activeSession.id : null,
			activeSessionSlug: activeSession ? activeSession.slug : null,
			sessionStatus: activeSession ? activeSession.status : 'inactive',
			eventsRecorded
		}
	})

	router.get('/api/readiness', async (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		const checks = []

		// 1. Server Online Check
		checks.push({
			id: "server-online",
			label: "Server Online",
			status: "pass",
			message: "NeuronCast HTTP Koa Webserver is online and responsive.",
			details: {
				uptimeSeconds: Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000)
			}
		})

		// 2. GSI State Check
		const elapsedMs = lastGsiMeta.acceptedAtUnixTimestamp > 0
			? Date.now() - lastGsiMeta.acceptedAtUnixTimestamp
			: null

		let gsiStatus = "warn"
		let gsiMessage = "Waiting for first Game State Integration GSI packet from Counter-Strike 2."
		if (lastGsiMeta.acceptedAtUnixTimestamp > 0) {
			if (elapsedMs > 5000 && !isUiDevMode) {
				gsiStatus = "fail"
				gsiMessage = "CS2 GSI signal is stale. No GSI packet received in last 5 seconds."
			} else {
				gsiStatus = "pass"
				gsiMessage = "CS2 GSI connection is active and receiving live telemetry ticks."
			}
		} else if (isUiDevMode) {
			gsiStatus = "pass"
			gsiMessage = "Server running in UI Development mode (Simulated GSI)."
		}

		checks.push({
			id: "gsi-state",
			label: "CS2 GSI Signal Connection",
			status: gsiStatus,
			message: gsiMessage,
			details: {
				lastGsiSecondsAgo: elapsedMs !== null ? elapsedMs / 1000 : null,
				uiDevMode: isUiDevMode,
				mapName: gsiState.map?.name || null,
				phase: gsiState.phase_countdowns?.phase || gsiState.round?.phase || null
			}
		})

		// 3. Connected HUD Clients Check
		const connectedClients = websocket.websocket.clients.size
		let clientsStatus = "pass"
		let clientsMessage = `Connected clients active: ${connectedClients} HUD/Browser websocket source(s).`
		if (connectedClients === 0) {
			clientsStatus = "warn"
			clientsMessage = "0 active HUD overlay or browser-source websocket clients connected."
		}

		checks.push({
			id: "hud-clients",
			label: "HUD Overlay WebSockets",
			status: clientsStatus,
			message: clientsMessage,
			details: {
				connectedClientsCount: connectedClients
			}
		})

		// 4. Theme Validation Check (Cached 30s)
		const themeVal = await runThemeValidationCached()
		checks.push({
			id: "theme-validator",
			label: "Theme Configurations Preflight",
			status: themeVal.status,
			message: themeVal.status === "pass"
				? "Theme validator preflight completed successfully. Configurations are valid."
				: "Theme preflight validator caught critical option inconsistencies or file errors.",
			details: {
				lastCheckedAt: new Date(themeVal.at).toISOString(),
				report: themeVal.details
			}
		})

		// 5. Userspace Config Check
		let configStatus = "pass"
		let configMessage = "Userspace theme override configuration (theme.json) exists and is readable."
		let legacyAliasesCount = 0
		let foundLegacyKeys = []
		let configExists = false

		try {
			const userspaceTheme = await readJsonIfExists(userspaceSettingsPath)
			if (userspaceTheme && userspaceTheme.options) {
				configExists = true
				for (const optKey of Object.keys(userspaceTheme.options)) {
					if (LEGACY_TO_CANONICAL[optKey]) {
						legacyAliasesCount++
						foundLegacyKeys.push({
							key: optKey,
							migratesTo: LEGACY_TO_CANONICAL[optKey]
						})
					}
				}
			} else {
				configStatus = "fail"
				configMessage = "src/themes/userspace/theme.json config options structure is missing or corrupt."
			}
		} catch (err) {
			configStatus = "fail"
			configMessage = `Failed to read or parse userspace theme overrides: ${err.message}`
		}

		checks.push({
			id: "userspace-config",
			label: "Userspace Settings Config",
			status: configStatus,
			message: configMessage,
			details: {
				exists: configExists,
				themePath: userspaceSettingsPath
			}
		})

		// 6. Cache Status Check (Komplettligaen scraper)
		const komplettligaenMeta = await getCacheMetadata('komplettligaen')
		const matchesMeta = await getCacheMetadata('matches')
		const standingsMeta = await getCacheMetadata('standings')

		let cacheStatus = "pass"
		let cacheMessage = "Komplettligaen flat-file persistence caches exist and are healthy."
		let anyMissing = !komplettligaenMeta.exists || !matchesMeta.exists || !standingsMeta.exists
		let anyStale = komplettligaenMeta.stale || matchesMeta.stale || standingsMeta.stale

		if (anyMissing) {
			cacheStatus = "warn"
			cacheMessage = "One or more Komplettligaen scraper caches are missing (first live scrape will populate them)."
		} else if (anyStale) {
			cacheStatus = "warn"
			cacheMessage = "Scraper persistence caches are stale. Active caches are older than 5 minutes."
		}

		checks.push({
			id: "scraper-cache",
			label: "Scraper Caches Offline Backup",
			status: cacheStatus,
			message: cacheMessage,
			details: {
				komplettligaen: komplettligaenMeta,
				matches: matchesMeta,
				standings: standingsMeta,
				anyMissing,
				anyStale
			}
		})

		// 7. Legacy Aliases Check
		let legacyStatus = "pass"
		let legacyMessage = "0 legacy alias overrides or deprecated configuration keys found in userspace settings."
		if (legacyAliasesCount > 0) {
			legacyStatus = "warn"
			legacyMessage = `Found ${legacyAliasesCount} legacy aliases or deprecated layout settings in userspace/theme.json.`
		}

		checks.push({
			id: "legacy-aliases",
			label: "Deprecated Options Legacy Aliases",
			status: legacyStatus,
			message: legacyMessage,
			details: {
				legacyAliasesCount,
				keys: foundLegacyKeys
			}
		})

		// 8. Match Session Lifecycle Check
		const activeSessionReadiness = getActiveSession()
		let sessionStatus = "warn"
		let sessionMsg = "No active match session is currently running. Event logging is inactive."
		if (activeSessionReadiness) {
			sessionStatus = "pass"
			sessionMsg = `Active match session "${activeSessionReadiness.slug}" is running and recording timeline events.`
		}
		
		checks.push({
			id: "session-storage",
			label: "Match Session Telemetry",
			status: sessionStatus,
			message: sessionMsg,
			details: {
				activeSessionId: activeSessionReadiness ? activeSessionReadiness.id : null,
				activeSessionSlug: activeSessionReadiness ? activeSessionReadiness.slug : null
			}
		})

		// Aggregate Readiness Severity
		let readiness = "ready"
		const hasFails = checks.some(c => c.status === "fail")
		const hasWarns = checks.some(c => c.status === "warn")

		if (hasFails) {
			readiness = "not-ready"
		} else if (hasWarns) {
			readiness = "degraded"
		}

		context.body = {
			ok: true,
			readiness,
			checks,
			generatedAt: new Date().toISOString()
		}
	})

	router.get('/operator/status', (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		context.type = 'html'
		context.body = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuronCast Operator Status</title>
    <!-- Offline Safe System Fonts -->
    <style>
        :root {
            --bg-gradient: radial-gradient(circle at top left, #0e1117, #07090e);
            --card-bg: rgba(22, 28, 38, 0.6);
            --card-border: rgba(255, 255, 255, 0.05);
            --card-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            
            --color-active: #10b981;
            --color-waiting: #f59e0b;
            --color-stale: #ef4444;
            --color-text: #f3f4f6;
            --color-text-muted: #9ca3af;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg-gradient);
            color: var(--color-text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            overflow-x: hidden;
        }

        .container {
            width: 100%;
            max-width: 1100px;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .logo-section h1 {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.05em;
        }

        .logo-section p {
            color: var(--color-text-muted);
            font-size: 0.95rem;
            margin-top: 0.2rem;
        }

        /* Large Uptime Badge */
        .status-hero {
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            padding: 2.5rem;
            display: flex;
            align-items: center;
            gap: 2.5rem;
            box-shadow: var(--card-shadow);
            position: relative;
            overflow: hidden;
        }

        .status-hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 6px;
            height: 100%;
            background: var(--status-color, var(--color-waiting));
            transition: background 0.3s ease;
        }

        .indicator-ring {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.02);
            border: 4px solid var(--status-color-alpha, rgba(245, 158, 11, 0.15));
            transition: all 0.3s ease;
            position: relative;
        }

        .indicator-dot {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--status-color, var(--color-waiting));
            transition: background 0.3s ease;
            box-shadow: 0 0 30px var(--status-color, var(--color-waiting));
        }

        .status-hero.pulsing .indicator-dot {
            animation: pulse 1.5s infinite alternate;
        }

        @keyframes pulse {
            0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 15px var(--status-color); }
            100% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 35px var(--status-color); }
        }

        .hero-details {
            flex: 1;
        }

        .hero-details .state-title {
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: var(--color-text-muted);
            font-weight: 600;
        }

        .hero-details .state-value {
            font-size: 3.5rem;
            font-weight: 800;
            line-height: 1.1;
            margin-top: 0.3rem;
            letter-spacing: -0.02em;
        }

        .hero-meta {
            display: flex;
            gap: 2rem;
            margin-top: 1rem;
        }

        .hero-meta-item {
            display: flex;
            flex-direction: column;
        }

        .hero-meta-label {
            font-size: 0.8rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
        }

        .hero-meta-value {
            font-size: 1.1rem;
            font-weight: 600;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }

        /* Diagnostic Grid */
        .diag-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 1.5rem;
        }

        .diag-card {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 1.8rem;
            box-shadow: var(--card-shadow);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .diag-card:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.08);
        }

        .card-header {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--color-text-muted);
            margin-bottom: 0.8rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-value {
            font-size: 2.2rem;
            font-weight: 600;
            font-family: 'Outfit', sans-serif;
            letter-spacing: -0.02em;
        }

        .card-subtext {
            font-size: 0.85rem;
            color: var(--color-text-muted);
            margin-top: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.05);
            color: var(--color-text);
        }

        .badge.blue {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .badge.green {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        /* Console Area */
        .terminal-log {
            background: rgba(10, 12, 17, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.2rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            height: 180px;
            overflow-y: auto;
            color: #38bdf8;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
        }

        .log-entry {
            margin-bottom: 0.4rem;
            display: flex;
            gap: 0.8rem;
        }

        .log-time {
            color: #64748b;
            user-select: none;
        }

        .log-msg {
            color: #e2e8f0;
        }

        .log-msg.error {
            color: var(--color-stale);
        }

        .log-msg.success {
            color: var(--color-active);
        }

        footer {
            margin-top: 3rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--color-text-muted);
        }

        footer a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-section">
                <h1>NEURONCAST BROADCAST</h1>
                <p>Telemetry & Operator Control Dashboard</p>
            </div>
            <div class="badge blue">OPERATOR PORTAL</div>
        </header>

        <!-- Status Hero -->
        <div id="heroCard" class="status-hero pulsing">
            <div class="indicator-ring">
                <div class="indicator-dot"></div>
            </div>
            <div class="hero-details">
                <div class="state-title">Connection Status</div>
                <div id="stateValue" class="state-value">CONNECTING</div>
                <div class="hero-meta">
                    <div class="hero-meta-item">
                        <div class="hero-meta-label">Telemetry Source</div>
                        <div id="telemetrySource" class="hero-meta-value">POLLING</div>
                    </div>
                    <div class="hero-meta-item">
                        <div class="hero-meta-label">Last Ping</div>
                        <div id="lastPingTime" class="hero-meta-value">-</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Grid -->
        <div class="diag-grid">
            <!-- NeuronCast Web Server -->
            <div class="diag-card">
                <div class="card-header">
                    <span>NeuronCast Server Uptime</span>
                    <span id="serverStatusBadge" class="badge">Checking</span>
                </div>
                <div id="serverStatus" class="card-value">STANDBY</div>
                <div id="serverUptimeSubtext" class="card-subtext">HTTP node webserver process</div>
            </div>

            <!-- GSI Signal Latency -->
            <div class="diag-card">
                <div class="card-header">
                    <span>CS2 GSI Latency</span>
                </div>
                <div id="gsiLatency" class="card-value">-</div>
                <div id="gsiSubtext" class="card-subtext">Time since last CS2 packet</div>
            </div>

            <!-- Clients Connected -->
            <div class="diag-card">
                <div class="card-header">
                    <span>OBS Browser Sources</span>
                </div>
                <div id="connectedClients" class="card-value">0</div>
                <div class="card-subtext">Active WebSocket connections</div>
            </div>

            <!-- Active Map -->
            <div class="diag-card">
                <div class="card-header">
                    <span>Active Map</span>
                </div>
                <div id="activeMap" class="card-value">de_mirage</div>
                <div id="activePhase" class="card-subtext">Phase: live</div>
            </div>
        </div>

        <!-- Console Log -->
        <div>
            <div style="margin-bottom: 0.6rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted);">Uptime Log Feed</div>
            <div id="terminalLog" class="terminal-log">
                <div class="log-entry"><span class="log-time">[System]</span><span class="log-msg">Initializing status monitoring console...</span></div>
            </div>
        </div>

        <footer>
            NeuronCast CS2 Overlay Webserver &bull; v${appVersion}${gitCommit ? ' (git: ' + gitCommit + ')' : ''} &bull; <a href="/hud/" target="_blank">Open HUD</a>
        </footer>
    </div>

    <script>
        const heroCard = document.getElementById('heroCard');
        const stateValue = document.getElementById('stateValue');
        const lastPingTime = document.getElementById('lastPingTime');
        const serverStatus = document.getElementById('serverStatus');
        const serverStatusBadge = document.getElementById('serverStatusBadge');
        const serverUptimeSubtext = document.getElementById('serverUptimeSubtext');
        const gsiLatency = document.getElementById('gsiLatency');
        const gsiSubtext = document.getElementById('gsiSubtext');
        const connectedClients = document.getElementById('connectedClients');
        const activeMap = document.getElementById('activeMap');
        const activePhase = document.getElementById('activePhase');
        const terminalLog = document.getElementById('terminalLog');
        const telemetrySource = document.getElementById('telemetrySource');

        let isServerOnline = false;
        let lastKnownGsiState = '';

        function formatDuration(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            const parts = [];
            if (h > 0) parts.push(h + 'h');
            if (m > 0 || h > 0) parts.push(m + 'm');
            parts.push(s + 's');
            return parts.join(' ');
        }

        function log(message, type) {
            type = type || 'info';
            const time = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            
            let typeClass = '';
            if (type === 'error') typeClass = 'error';
            else if (type === 'success') typeClass = 'success';

            entry.innerHTML = '<span class="log-time">[' + time + ']</span><span class="log-msg ' + typeClass + '">' + message + '</span>';
            terminalLog.appendChild(entry);
            terminalLog.scrollTop = terminalLog.scrollHeight;
        }

        async function updateStatus() {
            try {
                const start = performance.now();
                const res = await fetch('/api/status');
                const duration = Math.round(performance.now() - start);

                if (!res.ok) throw new Error('HTTP Error ' + res.status);

                const data = await res.json();
                lastPingTime.textContent = duration + 'ms';

                if (!isServerOnline) {
                    isServerOnline = true;
                    log('NeuronCast Web Server connection established.', 'success');
                }

                // Update Server Card
                serverStatus.textContent = formatDuration(data.uptimeSeconds);
                serverStatus.style.color = 'var(--color-active)';
                serverStatusBadge.className = 'badge green';
                serverStatusBadge.textContent = 'HEALTHY';
                const startedTime = new Date(data.serverStartedAt).toLocaleTimeString();
                serverUptimeSubtext.textContent = 'Started at ' + startedTime;

                // Dev mode indicator
                if (data.uiDevMode) {
                    telemetrySource.textContent = 'UI DEV MODE';
                    telemetrySource.style.color = '#38bdf8';
                } else {
                    telemetrySource.textContent = 'LIVE GSI';
                    telemetrySource.style.color = '';
                }

                // Update GSI State
                const state = data.gsiState.toUpperCase();
                stateValue.textContent = state;
                
                // Track state transitions for logging
                if (state !== lastKnownGsiState) {
                    if (lastKnownGsiState !== '') {
                        log('GSI Status transitioned from ' + lastKnownGsiState + ' to ' + state + '.', state === 'ACTIVE' ? 'success' : 'error');
                    } else {
                        log('Initial GSI Status: ' + state, state === 'ACTIVE' ? 'success' : 'info');
                    }
                    lastKnownGsiState = state;
                }

                // Apply dynamic status colors
                if (state === 'ACTIVE') {
                    heroCard.style.setProperty('--status-color', 'var(--color-active)');
                    heroCard.style.setProperty('--status-color-alpha', 'rgba(16, 185, 129, 0.15)');
                } else if (state === 'WAITING') {
                    heroCard.style.setProperty('--status-color', 'var(--color-waiting)');
                    heroCard.style.setProperty('--status-color-alpha', 'rgba(245, 158, 11, 0.15)');
                } else {
                    heroCard.style.setProperty('--status-color', 'var(--color-stale)');
                    heroCard.style.setProperty('--status-color-alpha', 'rgba(239, 68, 68, 0.15)');
                }

                // GSI Latency
                if (data.lastGsiSecondsAgo !== null) {
                    const secs = data.lastGsiSecondsAgo.toFixed(1);
                    gsiLatency.textContent = secs + 's';
                    const gsiTime = new Date(data.lastSuccessfulGsiAt).toLocaleTimeString();
                    gsiSubtext.textContent = 'Last GSI received at ' + gsiTime;
                    if (data.lastGsiSecondsAgo > 5) {
                        gsiLatency.style.color = 'var(--color-stale)';
                    } else {
                        gsiLatency.style.color = 'var(--color-active)';
                    }
                } else {
                    gsiLatency.textContent = 'N/A';
                    gsiSubtext.textContent = 'Waiting for first GSI packet';
                    gsiLatency.style.color = 'var(--color-waiting)';
                }

                // OBS Clients
                connectedClients.textContent = data.connectedClients;
                if (data.connectedClients > 0) {
                    connectedClients.style.color = 'var(--color-active)';
                } else {
                    connectedClients.style.color = 'var(--color-waiting)';
                }

                // Map & Phase
                activeMap.textContent = data.mapName || 'NO MAP';
                activePhase.textContent = data.phase ? ('Phase: ' + data.phase) : 'Phase: lobby/menu';

            } catch (err) {
                // Connection Failure (Server Down)
                if (isServerOnline || lastKnownGsiState === '') {
                    isServerOnline = false;
                    lastKnownGsiState = 'OFFLINE';
                    log('NeuronCast Web Server disconnected: ' + err.message, 'error');
                }

                serverStatus.textContent = 'OFFLINE';
                serverStatus.style.color = 'var(--color-stale)';
                serverStatusBadge.className = 'badge';
                serverStatusBadge.textContent = 'CRITICAL';
                serverUptimeSubtext.textContent = 'Server is unreachable';

                stateValue.textContent = 'OFFLINE';
                heroCard.style.setProperty('--status-color', 'var(--color-stale)');
                heroCard.style.setProperty('--status-color-alpha', 'rgba(239, 68, 68, 0.15)');

                lastPingTime.textContent = 'FAIL';
                gsiLatency.textContent = 'DOWN';
                gsiLatency.style.color = 'var(--color-stale)';
                gsiSubtext.textContent = 'Server is unreachable';

                connectedClients.textContent = '-';
                connectedClients.style.color = 'var(--color-stale)';

                activeMap.textContent = 'DISCONNECTED';
                activePhase.textContent = 'Cannot fetch server status';
            }
        }

        // Poll immediately and then every second
        updateStatus();
        setInterval(updateStatus, 1000);
    </script>
</body>
</html>`
	})

	router.get('/operator/readiness', (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		context.type = 'html'
		context.body = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuronCast Operator Readiness Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-gradient: radial-gradient(circle at top left, #0e1117, #07090e);
            --card-bg: rgba(22, 28, 38, 0.6);
            --card-border: 1px solid rgba(255, 255, 255, 0.08);
            
            --color-pass: #2ecc71;
            --color-warn: #f1c40f;
            --color-fail: #e74c3c;
            --color-text: #adbac7;
            --color-text-muted: #768390;
            --color-text-bright: #f0f6fc;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg-gradient);
            background-attachment: fixed;
            color: var(--color-text);
            min-height: 100vh;
            padding: 2rem;
            display: flex;
            justify-content: center;
        }

        .container {
            width: 100%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 1.5rem;
        }

        .logo-section h1 {
            font-size: 1.8rem;
            font-weight: 800;
            letter-spacing: 0.15em;
            color: var(--color-text-bright);
            background: linear-gradient(90deg, #58a6ff, #1f6feb);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .logo-section p {
            font-size: 0.85rem;
            color: var(--color-text-muted);
            letter-spacing: 0.05em;
            margin-top: 0.2rem;
            text-transform: uppercase;
        }

        .badge {
            padding: 0.35rem 0.75rem;
            font-size: 0.75rem;
            font-weight: 700;
            border-radius: 4px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .badge-ready {
            background: rgba(46, 204, 113, 0.15);
            border: 1px solid rgba(46, 204, 113, 0.3);
            color: var(--color-pass);
        }

        .badge-degraded {
            background: rgba(241, 196, 15, 0.15);
            border: 1px solid rgba(241, 196, 15, 0.3);
            color: var(--color-warn);
        }

        .badge-not-ready {
            background: rgba(231, 76, 60, 0.15);
            border: 1px solid rgba(231, 76, 60, 0.3);
            color: var(--color-fail);
        }

        /* Status Hero */
        .status-hero {
            background: var(--card-bg);
            border: var(--card-border);
            border-radius: 12px;
            padding: 2.5rem;
            display: flex;
            align-items: center;
            gap: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: border-color 0.5s ease;
        }

        .indicator-ring {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            border: 4px solid var(--status-color-alpha, rgba(46, 204, 113, 0.15));
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.5s ease;
        }

        .indicator-dot {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: var(--status-color, var(--color-pass));
            box-shadow: 0 0 25px var(--status-color, var(--color-pass));
            transition: all 0.5s ease;
        }

        .hero-details {
            flex-grow: 1;
        }

        .state-title {
            font-size: 0.85rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 600;
        }

        .state-value {
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: 0.02em;
            margin-top: 0.2rem;
            color: var(--color-text-bright);
            transition: color 0.5s ease;
        }

        .hero-meta {
            display: flex;
            gap: 3rem;
            margin-top: 1.2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 1rem;
        }

        .hero-meta-item {
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
        }

        .hero-meta-label {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .hero-meta-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            color: var(--color-text-bright);
        }

        /* Checklist Panel */
        .checklist-panel {
            background: var(--card-bg);
            border: var(--card-border);
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .panel-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--color-text-bright);
            margin-bottom: 1.5rem;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 0.75rem;
        }

        .checklist-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        .checklist-table th {
            font-size: 0.8rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
            padding: 0.75rem 1rem;
            border-bottom: 2px solid rgba(255, 255, 255, 0.05);
        }

        .checklist-table td {
            padding: 1.2rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 0.95rem;
            vertical-align: middle;
        }

        .check-label {
            font-weight: 600;
            color: var(--color-text-bright);
            width: 25%;
        }

        .check-status {
            width: 15%;
        }

        .check-status span {
            padding: 0.25rem 0.6rem;
            font-size: 0.7rem;
            font-weight: 700;
            border-radius: 4px;
            text-transform: uppercase;
        }

        .status-pass {
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.2);
            color: var(--color-pass);
        }

        .status-warn {
            background: rgba(241, 196, 15, 0.1);
            border: 1px solid rgba(241, 196, 15, 0.2);
            color: var(--color-warn);
        }

        .status-fail {
            background: rgba(231, 76, 60, 0.1);
            border: 1px solid rgba(231, 76, 60, 0.2);
            color: var(--color-fail);
        }

        .check-message {
            color: var(--color-text);
            width: 60%;
        }

        footer {
            margin-top: 1rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--color-text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-section">
                <h1>NEURONCAST BROADCAST</h1>
                <p>Operator Readiness & Telemetry Checks</p>
            </div>
            <div id="globalBadge" class="badge badge-degraded">CHECKING</div>
        </header>

        <!-- Status Hero -->
        <div id="heroCard" class="status-hero">
            <div class="indicator-ring">
                <div class="indicator-dot"></div>
            </div>
            <div class="hero-details">
                <div class="state-title">Broadcast Readiness State</div>
                <div id="stateValue" class="state-value">ANALYZING STATUS...</div>
                <div class="hero-meta">
                    <div class="hero-meta-item">
                        <div class="hero-meta-label">Validator Status</div>
                        <div id="themeValidationMeta" class="hero-meta-value">-</div>
                    </div>
                    <div class="hero-meta-item">
                        <div class="hero-meta-label">Active Overlay Sources</div>
                        <div id="activeOverlayMeta" class="hero-meta-value">-</div>
                    </div>
                    <div class="hero-meta-item">
                        <div class="hero-meta-label">Last Checked</div>
                        <div id="lastPingTime" class="hero-meta-value">-</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Checklist Grid -->
        <div class="checklist-panel">
            <div class="panel-title">Pre-Broadcast Telemetry Checklist</div>
            <table class="checklist-table">
                <thead>
                    <tr>
                        <th>Metric Target</th>
                        <th>Status Check</th>
                        <th>Diagnostics Message / Details</th>
                    </tr>
                </thead>
                <tbody id="checklist-tbody">
                    <tr>
                        <td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: 3rem;">
                            Fetching system readiness checklist...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <footer>
            NeuronCast Operations • <a href="/operator/status" style="color: #3b82f6; text-decoration: none;">Uptime Telemetry Console</a>
        </footer>
    </div>

    <script>
        const heroCard = document.getElementById('heroCard');
        const stateValue = document.getElementById('stateValue');
        const globalBadge = document.getElementById('globalBadge');
        const checklistTbody = document.getElementById('checklist-tbody');
        
        const themeValidationMeta = document.getElementById('themeValidationMeta');
        const activeOverlayMeta = document.getElementById('activeOverlayMeta');
        const lastPingTime = document.getElementById('lastPingTime');

        const colors = {
            ready: '#2ecc71',
            degraded: '#f1c40f',
            'not-ready': '#e74c3c'
        };

        const colorsAlpha = {
            ready: 'rgba(46, 204, 113, 0.15)',
            degraded: 'rgba(241, 196, 15, 0.15)',
            'not-ready': 'rgba(231, 76, 60, 0.15)'
        };

        async function updateReadiness() {
            try {
                const res = await fetch('/api/readiness');
                if (!res.ok) throw new Error('HTTP Status ' + res.status);
                const data = await res.json();

                const state = data.readiness;
                const stateUpper = state.replace('-', ' ').toUpperCase();

                // Update Hero Card details
                stateValue.textContent = stateUpper;
                stateValue.style.color = colors[state];

                heroCard.style.setProperty('--status-color', colors[state]);
                heroCard.style.setProperty('--status-color-alpha', colorsAlpha[state]);
                heroCard.style.borderColor = colors[state];

                // Update badge
                globalBadge.className = 'badge ' + (
                    state === 'ready' ? 'badge-ready' : 
                    state === 'degraded' ? 'badge-degraded' : 'badge-not-ready'
                );
                globalBadge.textContent = stateUpper;

                // Update general metadata items
                const validatorCheck = data.checks.find(c => c.id === 'theme-validator');
                if (validatorCheck) {
                    themeValidationMeta.textContent = validatorCheck.status.toUpperCase();
                    themeValidationMeta.style.color = colors[validatorCheck.status === 'pass' ? 'ready' : 'not-ready'];
                }

                const clientCheck = data.checks.find(c => c.id === 'hud-clients');
                if (clientCheck) {
                    const count = clientCheck.details?.connectedClientsCount ?? 0;
                    activeOverlayMeta.textContent = count + ' Connected';
                    activeOverlayMeta.style.color = colors[count > 0 ? 'ready' : 'degraded'];
                }

                lastPingTime.textContent = new Date(data.generatedAt).toLocaleTimeString();

                // Re-build Checklist Table body
                checklistTbody.innerHTML = '';
                data.checks.forEach(check => {
                    const row = document.createElement('tr');
                    
                    const labelTd = document.createElement('td');
                    labelTd.className = 'check-label';
                    labelTd.textContent = check.label;

                    const statusTd = document.createElement('td');
                    statusTd.className = 'check-status';
                    const statusSpan = document.createElement('span');
                    statusSpan.className = 'status-' + check.status;
                    statusSpan.textContent = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
                    statusTd.appendChild(statusSpan);

                    const messageTd = document.createElement('td');
                    messageTd.className = 'check-message';
                    messageTd.innerHTML = '<strong>' + check.message + '</strong>';

                    // Append debugging sub-details if warning or failing
                    if (check.status !== 'pass' && check.details) {
                        const detailBlock = document.createElement('div');
                        detailBlock.style.background = 'rgba(0,0,0,0.2)';
                        detailBlock.style.padding = '8px';
                        detailBlock.style.borderRadius = '4px';
                        detailBlock.style.marginTop = '8px';
                        detailBlock.style.fontSize = '0.75rem';
                        detailBlock.style.fontFamily = 'JetBrains Mono, monospace';
                        detailBlock.style.whiteSpace = 'pre-wrap';
                        detailBlock.style.color = 'rgba(255,255,255,0.6)';

                        if (check.id === 'legacy-aliases' && Array.isArray(check.details.keys)) {
                            detailBlock.textContent = 'Migratable Keys detected:\n' + 
                                check.details.keys.map(function(k) { return '  - ' + k.key + ' -> ' + k.migratesTo; }).join('\n');
                            messageTd.appendChild(detailBlock);
                        } else if (check.id === 'theme-validator' && check.details.report) {
                            const rep = check.details.report;
                            let msg = 'Validator Logs:\n';
                            if (rep.errors && rep.errors.length) {
                                msg += rep.errors.map(function(e) { return '  [ERROR] ' + e.message + ' (' + e.context + ')'; }).join('\n') + '\n';
                            }
                            if (rep.warnings && rep.warnings.length) {
                                msg += rep.warnings.map(function(w) { return '  [WARN] ' + w.message + ' (' + w.context + ')'; }).join('\n');
                            }
                            detailBlock.textContent = msg;
                            messageTd.appendChild(detailBlock);
                        } else if (check.id === 'scraper-cache' && check.details) {
                            const d = check.details;
                            detailBlock.textContent = 'Caches Audit:\n' +
                                '  - komplettligaen: ' + (d.komplettligaen?.exists ? 'Available (' + d.komplettligaen.ageMinutes + 'm old)' : 'Missing') + '\n' +
                                '  - matches: ' + (d.matches?.exists ? 'Available (' + d.matches.ageMinutes + 'm old)' : 'Missing') + '\n' +
                                '  - standings: ' + (d.standings?.exists ? 'Available (' + d.standings.ageMinutes + 'm old)' : 'Missing');
                            messageTd.appendChild(detailBlock);
                        }
                    }

                    row.appendChild(labelTd);
                    row.appendChild(statusTd);
                    row.appendChild(messageTd);
                    
                    checklistTbody.appendChild(row);
                });

            } catch (err) {
                // Connection Failure
                stateValue.textContent = 'OFFLINE';
                stateValue.style.color = colors['not-ready'];

                heroCard.style.setProperty('--status-color', colors['not-ready']);
                heroCard.style.setProperty('--status-color-alpha', colorsAlpha['not-ready']);
                heroCard.style.borderColor = colors['not-ready'];

                globalBadge.className = 'badge badge-not-ready';
                globalBadge.textContent = 'OFFLINE';

                themeValidationMeta.textContent = 'FAIL';
                themeValidationMeta.style.color = colors['not-ready'];

                activeOverlayMeta.textContent = '-';
                activeOverlayMeta.style.color = colors['not-ready'];

                lastPingTime.textContent = 'FAIL';

                checklistTbody.innerHTML = '<tr>' +
                    '<td colspan="3" style="text-align: center; color: var(--color-fail); padding: 3rem; font-weight: bold;">' +
                        'NeuronCast Server is unreachable: ' + err.message +
                    '</td>' +
                '</tr>';
            }
        }

        updateReadiness();
        setInterval(updateReadiness, 2000);
    </script>
</body>
</html>`
	})
}

export const getState = () => ({
	gsiState,
	additionalState,
	unixTimestamp: lastGsiMeta.acceptedAtUnixTimestamp
})

const resetVolatileMatchState = () => {
	additionalState.roundDamages = {}
	additionalState.moneyAtStartOfRound = {}
	additionalState.currentRoundProb = 0.5
	additionalState.probHistory = []
	additionalState.maxProbSwing = 0
	additionalState.roundKillStats = {}
	additionalState.lastKnownBombPlantedCountdown = {}
	additionalState.mvpDisplay = null
}

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

	if (! hasPlayer) {
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

	if (! bomb || bomb.state !== 'planted') {
		additionalState.lastKnownBombPlantedCountdown = {}
		return
	}

	additionalState.lastKnownBombPlantedCountdown = {
		unixTimestamp: +new Date(),
		value: bomb.countdown,
	}
}

const processAllPlayers = (body, mapChanged, wasRoundFreezetime) => {
	if (! body.allplayers) return

	const isFreezetime = body.round?.phase === 'freezetime'
	const isLive = body.round?.phase === 'live' || body.map?.phase === 'live' || body.bomb?.state === 'planted'
	const roundNumber = body.map?.round + 1 - Number(body.phase_countdowns?.phase === 'over')

	if (isFreezetime && !wasRoundFreezetime) {
		additionalState.moneyAtStartOfRound = {}
	}

	let ctPlayers = 0, tPlayers = 0
	let ctHp = 0, tHp = 0

	for (const [steam64Id, player] of Object.entries(body.allplayers)) {
		if (!player) continue

		// A. Observer Slot
		if (player.observer_slot !== null && player.observer_slot !== undefined) {
			additionalState.lastKnownPlayerObserverSlot[steam64Id] = player.observer_slot
		}

		// B. Money at start
		if (
			isFreezetime
			&& player.state
			&& additionalState.moneyAtStartOfRound[steam64Id] === undefined
		) {
			additionalState.moneyAtStartOfRound[steam64Id] = player.state.money ?? 0
		}

		// C. Round Damages
		if (roundNumber) {
			if (! additionalState.roundDamages[steam64Id]) {
				additionalState.roundDamages[steam64Id] = {}
			}
			const roundDmg = player.state?.round_totaldmg ?? 0
			if (roundDmg !== 0 || ! additionalState.roundDamages[steam64Id].hasOwnProperty(roundNumber)) {
				additionalState.roundDamages[steam64Id][roundNumber] = roundDmg
			}
		}

		// D. Win Prob Accumulators
		if (isLive && player.state && player.state.health > 0) {
			if (player.team === 'CT') {
				ctPlayers++
				ctHp += player.state.health
			} else if (player.team === 'T') {
				tPlayers++
				tHp += player.state.health
			}
		}
	}

	// 2. Finalize Win Probability
	if (isLive && (ctPlayers + tPlayers > 0)) {
		const totalPlayers = ctPlayers + tPlayers
		const playerWeight = ctPlayers / totalPlayers
		const hpRatio = (ctHp + tHp) > 0 ? ctHp / (ctHp + tHp) : 0.5
		let prob = (playerWeight * 0.5) + (hpRatio * 0.5)

		if (body.bomb?.state === 'planted') {
			const countdown = body.bomb.countdown || 40
			const bombFactor = Math.pow(countdown / 40, 2)
			prob = prob * bombFactor
		}

		additionalState.currentRoundProb = prob
		const lastProb = additionalState.probHistory[additionalState.probHistory.length - 1]
		if (lastProb === undefined || Math.abs(prob - lastProb) > 0.01) {
			additionalState.probHistory.push(prob)
		}
	}
}

const HIGHLIGHT_LOG_DIR = path.join(process.cwd(), 'logs')
const HIGHLIGHT_LOG_PATH = path.join(HIGHLIGHT_LOG_DIR, 'highlights.txt')

// Ensure directory exists
if (!fs.existsSync(HIGHLIGHT_LOG_DIR)) {
	fs.mkdirSync(HIGHLIGHT_LOG_DIR, { recursive: true })
}

// Helper to log highlights locally
const logHighlight = (roundNum, clutchMetric, mvpName) => {
	const logLine = `[${new Date().toISOString()}] Round ${roundNum} | Huge Swing: ${clutchMetric} | Clutch King: ${mvpName}\n`
	fs.appendFile(HIGHLIGHT_LOG_PATH, logLine, (err) => {
		if (err) console.error('Failed to write highlight log', err)
	})
}

const handleRoundEnd = (body) => {
	const winner = body.round?.win_team
	const roundNum = body.map?.round || 0
	const finalProb = winner === 'CT' ? 1.0 : 0.0
	
	const lowestProb = additionalState.probHistory.length > 0 ? Math.min(...additionalState.probHistory) : 0.5
	const highestProb = additionalState.probHistory.length > 0 ? Math.max(...additionalState.probHistory) : 0.5
	
	// Calculate swing
	if (winner === 'CT') {
		additionalState.maxProbSwing = finalProb - lowestProb
	} else {
		additionalState.maxProbSwing = highestProb - finalProb
	}

	const mvpName = body.player?.name || 'Unknown'
	const clutchMetric = (additionalState.maxProbSwing * 100).toFixed(1) + '%'

	if (additionalState.maxProbSwing > 0.6) {
		logHighlight(roundNum, clutchMetric, mvpName)
	}

	// Logging
	logRound({
		round_num: roundNum,
		winner,
		mvp_player_name: mvpName,
		clutch_metric: clutchMetric,
		final_stats: body.allplayers || {}
	})
}

const broadcastMvp = (websocket) => {
	let mvpId = null
	let maxScore = -1

	for (const [id, damages] of Object.entries(additionalState.roundDamages)) {
		const roundNum = Object.keys(damages).sort((a,b) => b-a)[0]
		if (!roundNum) continue
		const dmg = damages[roundNum] || 0
		if (dmg > maxScore) {
			maxScore = dmg
			mvpId = id
		}
	}

	if (mvpId && gsiState.allplayers?.[mvpId]) {
		const player = gsiState.allplayers[mvpId]
		websocket.broadcastToWebsockets('MVP_DISPLAY', {
			name: player.name,
			title: additionalState.maxProbSwing > 0.4 ? 'Clutch King' : 'Top Performer',
			swingPct: (additionalState.maxProbSwing * 100).toFixed(0),
			kills: player.match_stats?.kills || 0
		})
	}
}

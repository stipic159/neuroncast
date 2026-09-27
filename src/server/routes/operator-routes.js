import path from 'node:path'
import { promises as fsPromises } from 'node:fs'
import { exec } from 'node:child_process'
import { gsiState } from '../state.js'
import { lastGsiMeta } from '../gsi.js'
import { isUiDevMode } from '../dev-mode.js'
import { builtinRootDirectory, userspaceSettingsPath } from '../helpers/paths.js'
import { readJsonIfExists } from '../helpers/json-file.js'
import { getCacheMetadata } from '../cache/scraper-cache.js'
import { LEGACY_TO_CANONICAL } from '../helpers/canonical-map.js'
import { getActiveSession, readSession } from '../sessions/session-store.js'

const serverStartedAt = new Date().toISOString()

// Cache status and readiness HTML files in memory
const STATUS_HTML_PATH = path.join(process.cwd(), 'public', 'operator', 'status.html')
const READINESS_HTML_PATH = path.join(process.cwd(), 'public', 'operator', 'readiness.html')

let cachedStatusHtml = null
let cachedReadinessHtml = null

async function getStatusHtml() {
	if (!cachedStatusHtml) {
		cachedStatusHtml = await fsPromises.readFile(STATUS_HTML_PATH, 'utf8')
	}
	return cachedStatusHtml
}

async function getReadinessHtml() {
	if (!cachedReadinessHtml) {
		cachedReadinessHtml = await fsPromises.readFile(READINESS_HTML_PATH, 'utf8')
	}
	return cachedReadinessHtml
}

// App Version
let appVersion = 'unknown'
try {
	const pkgPath = path.join(builtinRootDirectory, 'package.json')
	readJsonIfExists(pkgPath).then(pkg => {
		if (pkg?.version) appVersion = pkg.version
	}).catch(() => {})
} catch (_) {}

// Git Commit
let gitCommit = null
try {
	exec('git rev-parse --short HEAD', { cwd: builtinRootDirectory }, (err, stdout) => {
		if (!err && stdout) gitCommit = stdout.trim()
	})
} catch (_) {}

// Theme Validator Cache Variables
let lastThemeValidationAt = null
let lastThemeValidationStatus = 'pending'
let lastThemeValidationDetails = null
let activeValidationPromise = null

function runThemeValidationCached() {
	if (activeValidationPromise) {
		return activeValidationPromise
	}

	if (lastThemeValidationAt && (Date.now() - lastThemeValidationAt < 30000)) {
		return Promise.resolve({
			status: lastThemeValidationStatus,
			at: lastThemeValidationAt,
			details: lastThemeValidationDetails
		})
	}

	activeValidationPromise = new Promise((resolve) => {
		exec('node scripts/theme-validate.js --json', { cwd: builtinRootDirectory }, (err, stdout) => {
			lastThemeValidationAt = Date.now()
			activeValidationPromise = null
			try {
				const report = JSON.parse(stdout)
				lastThemeValidationStatus = report.passed ? 'pass' : 'fail'
				lastThemeValidationDetails = {
					errors: report.errors || [],
					warnings: report.warnings || [],
					stats: report.stats || {}
				}
			} catch (parseErr) {
				lastThemeValidationStatus = 'fail'
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

export function registerOperatorRoutes(router, websocket) {
	const getStatusHandler = (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		const elapsedMs = lastGsiMeta.acceptedAtUnixTimestamp > 0
			? Date.now() - lastGsiMeta.acceptedAtUnixTimestamp
			: null

		let gsiStateStr = 'waiting'
		if (lastGsiMeta.acceptedAtUnixTimestamp > 0) {
			gsiStateStr = (elapsedMs <= 5000 || isUiDevMode) ? 'active' : 'stale'
		} else if (isUiDevMode) {
			gsiStateStr = 'active'
		}

		const connectedClients = websocket?.websocket?.clients?.size ?? 0
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
			appName: 'NeuronCast',
			version: appVersion,
			gitCommit,
			serverStartedAt,
			uptimeSeconds: Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000),
			activeSessionId: activeSession ? activeSession.id : null,
			activeSessionSlug: activeSession ? activeSession.slug : null,
			sessionStatus: activeSession ? activeSession.status : 'inactive',
			eventsRecorded
		}
	}

	// GET /api/gsi/status and /api/status (legacy alias)
	router.get('/api/gsi/status', getStatusHandler)
	router.get('/api/status', getStatusHandler)

	// GET /api/readiness
	router.get('/api/readiness', async (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')

		const checks = []

		// 1. Server Online Check
		checks.push({
			id: 'server-online',
			label: 'Server Online',
			status: 'pass',
			message: 'NeuronCast HTTP Koa Webserver is online and responsive.',
			details: {
				uptimeSeconds: Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000)
			}
		})

		// 2. GSI State Check
		const elapsedMs = lastGsiMeta.acceptedAtUnixTimestamp > 0
			? Date.now() - lastGsiMeta.acceptedAtUnixTimestamp
			: null

		let gsiStatus = 'warn'
		let gsiMessage = 'Waiting for first Game State Integration GSI packet from Counter-Strike 2.'
		if (lastGsiMeta.acceptedAtUnixTimestamp > 0) {
			if (elapsedMs > 5000 && !isUiDevMode) {
				gsiStatus = 'fail'
				gsiMessage = 'CS2 GSI signal is stale. No GSI packet received in last 5 seconds.'
			} else {
				gsiStatus = 'pass'
				gsiMessage = 'CS2 GSI connection is active and receiving live telemetry ticks.'
			}
		} else if (isUiDevMode) {
			gsiStatus = 'pass'
			gsiMessage = 'Server running in UI Development mode (Simulated GSI).'
		}

		checks.push({
			id: 'gsi-state',
			label: 'CS2 GSI Signal Connection',
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
		const connectedClients = websocket?.websocket?.clients?.size ?? 0
		let clientsStatus = 'pass'
		let clientsMessage = `Connected clients active: ${connectedClients} HUD/Browser websocket source(s).`
		if (connectedClients === 0) {
			clientsStatus = 'warn'
			clientsMessage = '0 active HUD overlay or browser-source websocket clients connected.'
		}

		checks.push({
			id: 'hud-clients',
			label: 'HUD Overlay WebSockets',
			status: clientsStatus,
			message: clientsMessage,
			details: {
				connectedClientsCount: connectedClients
			}
		})

		// 4. Theme Validation Check (Cached 30s)
		const themeVal = await runThemeValidationCached()
		checks.push({
			id: 'theme-validator',
			label: 'Theme Configurations Preflight',
			status: themeVal.status,
			message: themeVal.status === 'pass'
				? 'Theme validator preflight completed successfully. Configurations are valid.'
				: 'Theme preflight validator caught critical option inconsistencies or file errors.',
			details: {
				lastCheckedAt: new Date(themeVal.at).toISOString(),
				report: themeVal.details
			}
		})

		// 5. Userspace Config Check
		let configStatus = 'pass'
		let configMessage = 'Userspace theme override configuration (theme.json) exists and is readable.'
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
				configStatus = 'fail'
				configMessage = 'src/themes/userspace/theme.json config options structure is missing or corrupt.'
			}
		} catch (err) {
			configStatus = 'fail'
			configMessage = `Failed to read or parse userspace theme overrides: ${err.message}`
		}

		checks.push({
			id: 'userspace-config',
			label: 'Userspace Settings Config',
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

		let cacheStatus = 'pass'
		let cacheMessage = 'Komplettligaen flat-file persistence caches exist and are healthy.'
		let anyMissing = !komplettligaenMeta.exists || !matchesMeta.exists || !standingsMeta.exists
		let anyStale = komplettligaenMeta.stale || matchesMeta.stale || standingsMeta.stale

		if (anyMissing) {
			cacheStatus = 'warn'
			cacheMessage = 'One or more Komplettligaen scraper caches are missing (first live scrape will populate them).'
		} else if (anyStale) {
			cacheStatus = 'warn'
			cacheMessage = 'Scraper persistence caches are stale. Active caches are older than 5 minutes.'
		}

		checks.push({
			id: 'scraper-cache',
			label: 'Scraper Caches Offline Backup',
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
		let legacyStatus = 'pass'
		let legacyMessage = '0 legacy alias overrides or deprecated configuration keys found in userspace settings.'
		if (legacyAliasesCount > 0) {
			legacyStatus = 'warn'
			legacyMessage = `Found ${legacyAliasesCount} legacy aliases or deprecated layout settings in userspace/theme.json.`
		}

		checks.push({
			id: 'legacy-aliases',
			label: 'Deprecated Options Legacy Aliases',
			status: legacyStatus,
			message: legacyMessage,
			details: {
				legacyAliasesCount,
				keys: foundLegacyKeys
			}
		})

		// 8. Match Session Lifecycle Check
		const activeSessionReadiness = getActiveSession()
		let sessionStatus = 'warn'
		let sessionMsg = 'No active match session is currently running. Event logging is inactive.'
		if (activeSessionReadiness) {
			sessionStatus = 'pass'
			sessionMsg = `Active match session "${activeSessionReadiness.slug}" is running and recording timeline events.`
		}

		checks.push({
			id: 'session-storage',
			label: 'Match Session Telemetry',
			status: sessionStatus,
			message: sessionMsg,
			details: {
				activeSessionId: activeSessionReadiness ? activeSessionReadiness.id : null,
				activeSessionSlug: activeSessionReadiness ? activeSessionReadiness.slug : null
			}
		})

		// Aggregate Readiness Severity
		let readiness = 'ready'
		const hasFails = checks.some(c => c.status === 'fail')
		const hasWarns = checks.some(c => c.status === 'warn')

		if (hasFails) {
			readiness = 'not-ready'
		} else if (hasWarns) {
			readiness = 'degraded'
		}

		context.body = {
			ok: true,
			readiness,
			checks,
			generatedAt: new Date().toISOString()
		}
	})

	// GET /operator/status
	router.get('/operator/status', async (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')
		context.type = 'html'
		context.body = await getStatusHtml()
	})

	// GET /operator/readiness
	router.get('/operator/readiness', async (context) => {
		context.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		context.set('Pragma', 'no-cache')
		context.set('Expires', '0')
		context.type = 'html'
		context.body = await getReadinessHtml()
	})
}

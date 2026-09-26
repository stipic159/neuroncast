import { join } from 'path'
import { createReadStream } from 'fs'
import { access } from 'fs/promises'

import { readJsonIfExists, writeJson } from './helpers/json-file.js'
import { userspaceDirectory } from './helpers/paths.js'
import { fetchFastcupMatch, extractMatchId } from './integrations/fastcup/fetcher.js'
import { 
	getAssetFilePath, 
	clearAssetCache, 
	getDefaultAssetPlaceholder,
	ensureAssetDir
} from './integrations/fastcup/asset-cache.js'

const configPath = join(userspaceDirectory, 'fastcup.json')
const cachePath = join(userspaceDirectory, 'cache', 'fastcup_match.json')

const defaultConfig = {
	matchId: '',
	sessionCookie: '',
	autoRefresh: true,
	providerActive: false,
}

let cachedMatchPayload = null
let lastFetchedTime = 0
let fetchInProgressPromise = null
let pollIntervalTimer = null

/**
 * Gets the current FastCup configuration.
 */
export const getFastcupConfig = async () => ({
	...defaultConfig,
	...(await readJsonIfExists(configPath)),
})

/**
 * Saves updated FastCup configuration.
 */
export const saveFastcupConfig = async (patch) => {
	const current = await getFastcupConfig()
	const updated = { ...current, ...patch }
	await writeJson(configPath, updated)
	return updated
}

/**
 * Helper to get nested value by dot path (e.g. 'teams.team1.name')
 */
export function getValueByPath(obj, path) {
	if (!obj || !path) return undefined
	const parts = path.split('.')
	let curr = obj
	for (const part of parts) {
		if (curr === null || curr === undefined) return undefined
		curr = curr[part]
	}
	return curr
}

/**
 * Helper to set nested value by dot path (e.g. 'teams.team1.name')
 */
export function setValueByPath(obj, path, val) {
	if (!obj || !path) return
	const parts = path.split('.')
	let curr = obj
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]
		if (!curr[part] || typeof curr[part] !== 'object') {
			curr[part] = {}
		}
		curr = curr[part]
	}
	curr[parts[parts.length - 1]] = val
}

/**
 * Merges fresh match data from API with existing user overrides (Override Immutability).
 */
export function mergePayloadWithOverrides(freshData, existingData) {
	if (!existingData || !existingData.overrides) return freshData

	const lockedFields = existingData.overrides.lockedFields || []
	const customData = existingData.overrides.customData || {}

	const result = { ...freshData }
	result.overrides = {
		lockedFields: [...lockedFields],
		customData: { ...customData },
	}

	// Preserve locked field values from existingData or customData
	for (const path of lockedFields) {
		const savedVal = customData[path] !== undefined ? customData[path] : getValueByPath(existingData, path)
		if (savedVal !== undefined) {
			setValueByPath(result, path, savedVal)
		}
	}

	return result
}

/**
 * Returns Adaptive TTL in milliseconds depending on match status.
 * - veto / in_progress -> 10 seconds
 * - live -> 60 seconds
 * - finished -> 600 seconds
 */
export function getAdaptiveTtlMs(status) {
	if (status === 'veto' || status === 'in_progress') return 10 * 1000
	if (status === 'live') return 60 * 1000
	if (status === 'finished') return 600 * 1000
	return 30 * 1000
}

/**
 * Loads cached match data from disk if memory cache is empty.
 */
export const loadCachedMatchFromDisk = async () => {
	if (cachedMatchPayload) return cachedMatchPayload
	try {
		const stored = await readJsonIfExists(cachePath)
		if (stored && stored.matchId) {
			cachedMatchPayload = stored
			return stored
		}
	} catch (err) {
		// Cache read error
	}
	return null
}

/**
 * Fetches and returns the active FastCup match bundle.
 */
export const getFastcupBundle = async (forceRefresh = false) => {
	const config = await getFastcupConfig()
	const matchId = extractMatchId(config.matchId)

	if (!matchId) {
		return {
			match: null,
			config,
			status: 'no_match_configured',
			fetchedAt: Date.now(),
		}
	}

	const diskCached = await loadCachedMatchFromDisk()
	const currentPayload = cachedMatchPayload || diskCached
	const ttl = getAdaptiveTtlMs(currentPayload?.status)

	const isStale = !currentPayload || (Date.now() - lastFetchedTime > ttl)

	if (!forceRefresh && !isStale && currentPayload) {
		return {
			match: currentPayload,
			config,
			status: 'cached',
			fetchedAt: lastFetchedTime,
		}
	}

	if (fetchInProgressPromise) {
		await fetchInProgressPromise.catch(() => {})
		return {
			match: cachedMatchPayload || diskCached,
			config,
			status: 'fetched',
			fetchedAt: lastFetchedTime,
		}
	}

	fetchInProgressPromise = (async () => {
		try {
			const freshData = await fetchFastcupMatch(matchId, config.sessionCookie)
			const merged = mergePayloadWithOverrides(freshData, currentPayload)

			cachedMatchPayload = merged
			lastFetchedTime = Date.now()

			await writeJson(cachePath, merged).catch(() => {})
		} catch (err) {
			// On error, keep existing cached data if available
			if (!cachedMatchPayload) {
				cachedMatchPayload = null
			}
		} finally {
			fetchInProgressPromise = null
		}
	})()

	await fetchInProgressPromise

	return {
		match: cachedMatchPayload,
		config,
		status: 'fetched',
		fetchedAt: lastFetchedTime,
	}
}

/**
 * Previews match data for a given Match ID without saving it into production state.
 */
export const previewFastcupMatch = async (matchIdOrUrl, sessionCookie = '') => {
	const matchId = extractMatchId(matchIdOrUrl)
	if (!matchId) throw new Error('Invalid Match ID or URL')
	return await fetchFastcupMatch(matchId, sessionCookie)
}

/**
 * Sets or removes a custom override for a field.
 */
export const setFastcupOverride = async (fieldPath, value, isLocked = true) => {
	const diskCached = await loadCachedMatchFromDisk()
	if (!diskCached && !cachedMatchPayload) {
		throw new Error('No active FastCup match loaded to apply overrides.')
	}

	const payload = cachedMatchPayload || diskCached
	if (!payload.overrides) {
		payload.overrides = { lockedFields: [], customData: {} }
	}

	const lockedSet = new Set(payload.overrides.lockedFields || [])
	if (isLocked) {
		lockedSet.add(fieldPath)
		payload.overrides.customData[fieldPath] = value
		setValueByPath(payload, fieldPath, value)
	} else {
		lockedSet.delete(fieldPath)
		delete payload.overrides.customData[fieldPath]
	}

	payload.overrides.lockedFields = Array.from(lockedSet)
	cachedMatchPayload = payload

	await writeJson(cachePath, payload).catch(() => {})
	return payload
}

/**
 * Resets memory and disk cache for FastCup matches and assets.
 */
export const resetFastcupCache = async () => {
	cachedMatchPayload = null
	lastFetchedTime = 0
	await clearAssetCache()
	await writeJson(cachePath, {}).catch(() => {})
}

/**
 * Registers Koa HTTP routes for FastCup integration.
 */
export function registerFastcupRoutes(router, websocket) {
	// GET /config/fastcup - Get configuration & status
	router.get('/config/fastcup', async (ctx) => {
		const bundle = await getFastcupBundle()
		ctx.body = {
			config: bundle.config,
			match: bundle.match,
			status: bundle.status,
			fetchedAt: bundle.fetchedAt,
		}
	})

	// PUT /config/fastcup - Update configuration
	router.put('/config/fastcup', async (ctx) => {
		const body = ctx.request.body || {}
		const updatedConfig = await saveFastcupConfig({
			matchId: body.matchId !== undefined ? String(body.matchId) : undefined,
			sessionCookie: body.sessionCookie !== undefined ? String(body.sessionCookie) : undefined,
			autoRefresh: body.autoRefresh !== undefined ? !!body.autoRefresh : undefined,
			providerActive: body.providerActive !== undefined ? !!body.providerActive : undefined,
		})

		// Trigger background fetch for the new match ID
		const bundle = await getFastcupBundle(true)
		if (websocket && typeof websocket.broadcastToWebsockets === 'function') {
			websocket.broadcastToWebsockets('fastcup:updated', { config: updatedConfig, match: bundle.match })
		}

		ctx.body = {
			config: updatedConfig,
			match: bundle.match,
			success: true,
		}
	})

	// GET /api/fastcup/preview - Preview match data
	router.get('/api/fastcup/preview', async (ctx) => {
		const matchId = ctx.query.matchId || ctx.query.id
		const cookie = ctx.query.cookie || ''
		if (!matchId) {
			ctx.status = 400
			ctx.body = { error: 'Missing matchId query parameter' }
			return
		}

		try {
			const preview = await previewFastcupMatch(matchId, cookie)
			ctx.body = { match: preview, success: true }
		} catch (err) {
			ctx.status = 422
			ctx.body = { error: err.message, success: false }
		}
	})

	// POST /config/fastcup/override - Lock/Unlock user field override
	router.post('/config/fastcup/override', async (ctx) => {
		const { fieldPath, value, isLocked } = ctx.request.body || {}
		if (!fieldPath) {
			ctx.status = 400
			ctx.body = { error: 'Missing fieldPath parameter' }
			return
		}

		try {
			const payload = await setFastcupOverride(fieldPath, value, isLocked !== false)
			if (websocket && typeof websocket.broadcastToWebsockets === 'function') {
				websocket.broadcastToWebsockets('fastcup:updated', { match: payload })
			}
			ctx.body = { match: payload, success: true }
		} catch (err) {
			ctx.status = 400
			ctx.body = { error: err.message, success: false }
		}
	})

	// POST /config/fastcup/refresh - Force immediate data refresh
	router.post('/config/fastcup/refresh', async (ctx) => {
		try {
			const bundle = await getFastcupBundle(true)
			if (websocket && typeof websocket.broadcastToWebsockets === 'function') {
				websocket.broadcastToWebsockets('fastcup:updated', { match: bundle.match })
			}
			ctx.body = { match: bundle.match, status: bundle.status, success: true }
		} catch (err) {
			ctx.status = 500
			ctx.body = { error: err.message, success: false }
		}
	})

	// POST /config/fastcup/cache-reset - Clear cache & assets
	router.post('/config/fastcup/cache-reset', async (ctx) => {
		await resetFastcupCache()
		ctx.body = { success: true, message: 'FastCup cache and asset storage cleared.' }
	})

	// GET /api/fastcup/assets/:file - Serve cached image assets
	router.get('/api/fastcup/assets/:file', async (ctx) => {
		const filename = ctx.params.file
		const filePath = getAssetFilePath(filename)

		try {
			await access(filePath)
			ctx.type = filename.endsWith('.png') ? 'image/png' : (filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : (filename.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream'))
			ctx.body = createReadStream(filePath)
		} catch (err) {
			// Asset missing, return SVG default placeholder
			ctx.type = 'image/svg+xml'
			ctx.body = getDefaultAssetPlaceholder(filename.includes('team') ? 'logo' : 'avatar')
		}
	})
}

/**
 * Initializes background polling for active FastCup match.
 */
export function startFastcupPolling(websocket) {
	if (pollIntervalTimer) clearInterval(pollIntervalTimer)

	pollIntervalTimer = setInterval(async () => {
		try {
			const config = await getFastcupConfig()
			if (!config.providerActive || !config.autoRefresh || !config.matchId) return

			const bundle = await getFastcupBundle(false)
			if (bundle.status === 'fetched' && websocket && typeof websocket.broadcastToWebsockets === 'function') {
				websocket.broadcastToWebsockets('fastcup:updated', { config: bundle.config, match: bundle.match })
			}
		} catch (err) {
			// Polling background silence
		}
	}, 15 * 1000)
}

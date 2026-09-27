import { createReadStream } from 'fs'
import { access, mkdir } from 'fs/promises'
import { join, basename } from 'path'

import { readJsonIfExists, writeJson } from './helpers/json-file.js'
import { userspaceDirectory } from './helpers/paths.js'
import { clearAssetCache, getAssetFilePath, getDefaultAssetPlaceholder } from './integrations/fastcup/asset-cache.js'
import { fetchFastcupMatch, extractMatchId } from './integrations/fastcup/fetcher.js'

const configPath = join(userspaceDirectory, 'fastcup.json')
const cachePath = join(userspaceDirectory, 'cache/fastcup_match.json')

const defaultConfig = {
	matchId: '',
	sessionCookie: '',
	autoRefresh: true,
	providerActive: false,
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

const MIME_MAP = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	svg: 'image/svg+xml',
	webp: 'image/webp',
}

let cachedMatchPayload = null
let fetchInProgressPromise = null
let lastFetchedTime = 0
let pollingTimer = null

/**
 * Reads FastCup config from disk, applying defaults.
 */
export const getFastcupConfig = async () => ({
	...defaultConfig,
	...(await readJsonIfExists(configPath)),
})

/**
 * Saves updated FastCup config to disk.
 */
export const saveFastcupConfig = async (newFields = {}) => {
	const current = await getFastcupConfig()
	const updated = {
		...current,
		...newFields,
	}
	await mkdir(userspaceDirectory, { recursive: true })
	await writeJson(configPath, updated)
	return updated
}

/**
 * Recursively updates a property in an object given a dot-separated path.
 * Protected against Prototype Pollution.
 */
function setValueByPath(obj, path, value) {
	if (!obj || typeof obj !== 'object' || typeof path !== 'string') return

	const parts = path.split('.')
	let curr = obj

	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i]
		if (FORBIDDEN_KEYS.has(key)) return

		if (!curr[key] || typeof curr[key] !== 'object') {
			curr[key] = {}
		}
		curr = curr[key]
	}

	const lastKey = parts[parts.length - 1]
	if (!FORBIDDEN_KEYS.has(lastKey)) {
		curr[lastKey] = value
	}
}

/**
 * Merges fresh match data from FastCup with active user-overridden fields.
 */
export function mergePayloadWithOverrides(freshPayload, previousPayload) {
	if (!previousPayload || !previousPayload.overrides) {
		return freshPayload
	}

	const { lockedFields = [], customData = {} } = previousPayload.overrides
	const result = {
		...freshPayload,
		overrides: {
			lockedFields: [...lockedFields],
			customData: { ...customData },
		},
	}

	for (const fieldPath of lockedFields) {
		if (customData[fieldPath] !== undefined) {
			setValueByPath(result, fieldPath, customData[fieldPath])
		}
	}

	return result
}

/**
 * Returns Adaptive TTL in milliseconds depending on match status.
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
		console.warn('[FastCup] Failed to read disk cache:', err.message)
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

			await writeJson(cachePath, merged).catch((err) => {
				console.warn('[FastCup] Failed to write match cache to disk:', err.message)
			})

			return merged
		} catch (err) {
			console.warn(`[FastCup] Fetch failed for match ${matchId}:`, err.message)
			if (currentPayload) {
				return currentPayload
			}
			throw err
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
	if (typeof fieldPath !== 'string' || fieldPath.split('.').some((k) => FORBIDDEN_KEYS.has(k))) {
		throw new Error('Invalid or restricted fieldPath parameter.')
	}

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

	await writeJson(cachePath, payload).catch((err) => {
		console.warn('[FastCup] Failed to persist override to cache:', err.message)
	})

	return payload
}

/**
 * Resets memory and disk cache for FastCup matches and assets.
 */
export const resetFastcupCache = async () => {
	cachedMatchPayload = null
	lastFetchedTime = 0
	await clearAssetCache()
	await writeJson(cachePath, {}).catch((err) => {
		console.warn('[FastCup] Failed to clear disk cache:', err.message)
	})
}

/**
 * Stops active background polling.
 */
export function stopFastcupPolling() {
	if (pollingTimer) {
		clearTimeout(pollingTimer)
		pollingTimer = null
	}
}

/**
 * Starts background polling with adaptive intervals based on match state.
 */
export function startFastcupPolling(websocket) {
	stopFastcupPolling()

	const poll = async () => {
		let delay = 15000

		try {
			const config = await getFastcupConfig()
			if (config.providerActive && config.autoRefresh && config.matchId) {
				const bundle = await getFastcupBundle()

				if (bundle.status === 'fetched' && websocket && typeof websocket.broadcastToWebsockets === 'function') {
					websocket.broadcastToWebsockets('fastcup:updated', { config, match: bundle.match })
				}

				if (bundle.match?.status) {
					delay = Math.max(5000, getAdaptiveTtlMs(bundle.match.status))
				}
			}
		} catch (err) {
			console.warn('[FastCup Polling] Tick error:', err.message)
		} finally {
			pollingTimer = setTimeout(poll, delay)
			if (pollingTimer.unref) pollingTimer.unref()
		}
	}

	pollingTimer = setTimeout(poll, 1000)
	if (pollingTimer.unref) pollingTimer.unref()
}

/**
 * Registers Koa HTTP routes for FastCup integration.
 */
export function registerFastcupRoutes(router, websocket) {
	// GET /config/fastcup or /api/fastcup/config
	router.get(['/config/fastcup', '/api/fastcup/config'], async (ctx) => {
		const bundle = await getFastcupBundle()
		ctx.body = {
			config: bundle.config,
			match: bundle.match,
			status: bundle.status,
			fetchedAt: bundle.fetchedAt,
		}
	})

	// PUT /config/fastcup or /api/fastcup/config
	router.put(['/config/fastcup', '/api/fastcup/config'], async (ctx) => {
		const body = ctx.request.body || {}
		const updatedConfig = await saveFastcupConfig({
			matchId: body.matchId !== undefined ? String(body.matchId) : undefined,
			sessionCookie: body.sessionCookie !== undefined ? String(body.sessionCookie) : undefined,
			autoRefresh: body.autoRefresh !== undefined ? Boolean(body.autoRefresh) : undefined,
			providerActive: body.providerActive !== undefined ? Boolean(body.providerActive) : undefined,
		})

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

	// GET /api/fastcup/preview
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

	// POST /config/fastcup/override or /api/fastcup/override
	router.post(['/config/fastcup/override', '/api/fastcup/override'], async (ctx) => {
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

	// POST /config/fastcup/refresh or /api/fastcup/refresh
	router.post(['/config/fastcup/refresh', '/api/fastcup/refresh'], async (ctx) => {
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

	// POST /config/fastcup/cache-reset or /api/fastcup/cache-reset
	router.post(['/config/fastcup/cache-reset', '/api/fastcup/cache-reset'], async (ctx) => {
		await resetFastcupCache()
		ctx.body = { success: true, message: 'FastCup cache and asset storage cleared.' }
	})

	// GET /api/fastcup/assets/:file
	router.get('/api/fastcup/assets/:file', async (ctx) => {
		const rawFilename = ctx.params.file
		const filename = basename(rawFilename)

		// Path Traversal check: only allow safe alphanumerics, dots, hyphens and underscores
		if (!filename || filename !== rawFilename || !/^[\w.-]+$/.test(filename)) {
			ctx.status = 400
			ctx.body = { error: 'Invalid asset filename' }
			return
		}

		const filePath = getAssetFilePath(filename)

		try {
			await access(filePath)
			const ext = filename.split('.').pop()?.toLowerCase()
			ctx.type = MIME_MAP[ext] || 'application/octet-stream'
			ctx.body = createReadStream(filePath)
		} catch {
			ctx.type = 'image/svg+xml'
			ctx.body = getDefaultAssetPlaceholder(filename.includes('team') ? 'logo' : 'avatar')
		}
	})
}

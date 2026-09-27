import {
	importFaceitMatch,
	getActiveMatchConfig as getActiveFaceitConfig,
	setActiveMatchConfig as setActiveFaceitConfig,
	getActiveMatchVeto as getActiveFaceitVeto,
	cacheMatchAssets as cacheFaceitAssets,
} from '../integrations/faceit/faceit-service.js'

import {
	importFastcupMatch,
	getActiveFastcupMatchConfig,
	setActiveFastcupMatchConfig,
	getActiveFastcupMatchVeto,
	cacheMatchAssets as cacheFastcupAssets,
} from '../integrations/fastcup/fastcup-service.js'

import { extractMatchId as extractFastcupId } from '../integrations/fastcup/fetcher.js'
import { extractMatchId as extractFaceitId } from '../integrations/faceit/faceit-parser.js'

let activeProvider = 'fastcup' // Default primary platform

export function getActiveMatchConfig() {
	if (activeProvider === 'faceit') {
		return getActiveFaceitConfig() || getActiveFastcupMatchConfig()
	}
	return getActiveFastcupMatchConfig() || getActiveFaceitConfig()
}

export function setActiveMatchConfig(config, provider = 'fastcup') {
	activeProvider = provider
	if (provider === 'faceit') {
		setActiveFaceitConfig(config)
	} else {
		setActiveFastcupMatchConfig(config)
	}
	return config
}

export function getActiveMatchVeto() {
	if (activeProvider === 'faceit') {
		return getActiveFaceitVeto() || getActiveFastcupMatchVeto()
	}
	return getActiveFastcupMatchVeto() || getActiveFaceitVeto()
}

/**
 * Universal match importer: detects platform (FastCup or FACEIT) with FastCup as primary default.
 */
export async function importMatch(urlOrId, options = {}) {
	const trimmed = String(urlOrId || '').trim()

	// 1. Explicit FACEIT check
	const isFaceitUrl = trimmed.toLowerCase().includes('faceit.com')
	const faceitUuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
	const isFaceitPrefix = trimmed.startsWith('1-')

	if (isFaceitUrl || (faceitUuidMatch && isFaceitPrefix)) {
		const result = await importFaceitMatch(trimmed, options)
		activeProvider = 'faceit'
		return { ...result, provider: 'faceit' }
	}

	// 2. FastCup (Numeric ID or FastCup URL)
	const isFastcupUrl = trimmed.toLowerCase().includes('fastcup.net')
	const isPureNumeric = /^\d+$/.test(trimmed)

	if (isFastcupUrl || isPureNumeric) {
		try {
			const result = await importFastcupMatch(trimmed, options)
			activeProvider = 'fastcup'
			return { ...result, provider: 'fastcup' }
		} catch (fcErr) {
			// If pure numeric failed on FastCup, try FACEIT only if it could be FACEIT room ID
			throw fcErr
		}
	}

	// 3. Fallback: try FastCup first as preferred platform, then FACEIT
	try {
		const result = await importFastcupMatch(trimmed, options)
		activeProvider = 'fastcup'
		return { ...result, provider: 'fastcup' }
	} catch (fcErr) {
		try {
			const result = await importFaceitMatch(trimmed, options)
			activeProvider = 'faceit'
			return { ...result, provider: 'faceit' }
		} catch (fiErr) {
			throw new Error(`Failed to import match from FastCup (${fcErr.message}) and FACEIT (${fiErr.message})`)
		}
	}
}

export function registerMatchRoutes(router, websocket) {
	// Import match from FastCup (default) or FACEIT
	router.post('/api/match/import', async (context) => {
		const body = context.request.body || {}
		const url = body.url || body.matchId || body.matchUrl

		if (!url || typeof url !== 'string') {
			context.status = 400
			context.body = {
				ok: false,
				error: 'Missing match URL or matchId in request body',
			}
			return
		}

		try {
			const result = await importMatch(url, {
				apiKey: body.apiKey,
				sessionCookie: body.sessionCookie,
				autoCache: body.autoCache !== false,
			})

			// Notify connected overlays & mobile remotes
			if (websocket?.broadcastToWebsockets) {
				websocket.broadcastToWebsockets('match:config_updated', result.match)
				if (result.veto) {
					websocket.broadcastToWebsockets('match:veto_imported', result.veto)
				}
			}

			context.body = {
				ok: true,
				match: result.match,
				veto: result.veto,
				provider: result.provider || activeProvider,
				source: result.source,
			}
		} catch (err) {
			console.error(`[Match Import Error] ${err.message}`)
			context.status = 422
			context.body = {
				ok: false,
				error: err.message,
				fallback: 'manual',
			}
		}
	})

	// Get active match configuration
	router.get('/api/match/config', async (context) => {
		const match = getActiveMatchConfig()
		const veto = getActiveMatchVeto()

		context.body = {
			ok: true,
			config: match,
			veto,
			activeProvider,
		}
	})

	// Set or update active match configuration manually
	const setMatchConfigHandler = async (context) => {
		const body = context.request.body || {}
		const config = body.config || body

		if (!config || typeof config !== 'object') {
			context.status = 400
			context.body = { ok: false, error: 'Invalid config payload' }
			return
		}

		const provider = config.source || body.provider || activeProvider
		setActiveMatchConfig(config, provider)

		if (body.autoCache) {
			const cacheFn = provider === 'faceit' ? cacheFaceitAssets : cacheFastcupAssets
			await cacheFn(config).catch((err) => {
				console.warn(`[Asset Cache Warning] ${err.message}`)
			})
		}

		if (websocket?.broadcastToWebsockets) {
			websocket.broadcastToWebsockets('match:config_updated', config)
		}

		context.body = {
			ok: true,
			config,
		}
	}

	router.post('/api/match/config', setMatchConfigHandler)
	router.put('/api/match/config', setMatchConfigHandler)

	// Trigger asset caching for active config
	router.post('/api/match/cache-assets', async (context) => {
		const activeConfig = getActiveMatchConfig()
		if (!activeConfig) {
			context.status = 404
			context.body = { ok: false, error: 'No active match config found to cache' }
			return
		}

		try {
			const cacheFn = activeProvider === 'faceit' ? cacheFaceitAssets : cacheFastcupAssets
			const updated = await cacheFn(activeConfig)
			setActiveMatchConfig(updated, activeProvider)

			if (websocket?.broadcastToWebsockets) {
				websocket.broadcastToWebsockets('match:config_updated', updated)
			}

			context.body = {
				ok: true,
				config: updated,
			}
		} catch (err) {
			context.status = 500
			context.body = { ok: false, error: err.message }
		}
	})

	// Reset active match configuration
	router.delete('/api/match/config', async (context) => {
		setActiveMatchConfig(null, activeProvider)

		if (websocket?.broadcastToWebsockets) {
			websocket.broadcastToWebsockets('match:config_reset', {})
		}

		context.body = { ok: true }
	})
}

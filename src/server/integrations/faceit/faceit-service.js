import { extractMatchId, parseFaceitMatch } from './faceit-parser.js'
import { cacheRemoteAsset, batchCacheAssets } from '../../cache/asset-cache-manager.js'

let activeMatchConfig = null
let activeMatchVeto = null

/**
 * Fetches match data using FACEIT Data API v4 with Authorization Bearer.
 */
async function fetchFromDataApiV4(matchId, apiKey, timeoutMs = 6000) {
	const url = `https://open.faceit.com/data/v4/matches/${encodeURIComponent(matchId)}`
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'Authorization': `Bearer ${apiKey.trim()}`,
				'Accept': 'application/json',
			},
		})
		clearTimeout(timeoutId)

		if (!res.ok) {
			const errorText = await res.text().catch(() => '')
			throw new Error(`Data API v4 responded with HTTP ${res.status}: ${errorText}`)
		}

		return await res.json()
	} catch (err) {
		clearTimeout(timeoutId)
		throw err
	}
}

/**
 * Fetches match data using FACEIT Public Web Endpoint (v2) without API key.
 */
async function fetchFromPublicApiV2(matchId, timeoutMs = 6000) {
	const url = `https://api.faceit.com/match/v2/match/${encodeURIComponent(matchId)}`
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			},
		})
		clearTimeout(timeoutId)

		if (!res.ok) {
			const errorText = await res.text().catch(() => '')
			throw new Error(`Public API v2 responded with HTTP ${res.status}: ${errorText}`)
		}

		const data = await res.json()
		return data.payload || data
	} catch (err) {
		clearTimeout(timeoutId)
		throw err
	}
}

/**
 * Downloads and caches all team logos and player avatars locally.
 */
export async function cacheMatchAssets(matchConfig) {
	if (!matchConfig) return matchConfig

	const itemsToCache = []

	// Team 1 Logo
	if (matchConfig.team1?.logoUrlOriginal) {
		itemsToCache.push({
			url: matchConfig.team1.logoUrlOriginal,
			subfolder: 'teams',
			key: `team1_${matchConfig.team1.id || 't1'}`,
		})
	}

	// Team 2 Logo
	if (matchConfig.team2?.logoUrlOriginal) {
		itemsToCache.push({
			url: matchConfig.team2.logoUrlOriginal,
			subfolder: 'teams',
			key: `team2_${matchConfig.team2.id || 't2'}`,
		})
	}

	// Team 1 Players
	if (Array.isArray(matchConfig.team1?.players)) {
		for (const player of matchConfig.team1.players) {
			if (player.avatarUrlOriginal) {
				itemsToCache.push({
					url: player.avatarUrlOriginal,
					subfolder: 'avatars',
					key: player.steamId64 || player.nickname,
				})
			}
		}
	}

	// Team 2 Players
	if (Array.isArray(matchConfig.team2?.players)) {
		for (const player of matchConfig.team2.players) {
			if (player.avatarUrlOriginal) {
				itemsToCache.push({
					url: player.avatarUrlOriginal,
					subfolder: 'avatars',
					key: player.steamId64 || player.nickname,
				})
			}
		}
	}

	const cachedMap = await batchCacheAssets(itemsToCache)

	// Update matchConfig with local cached paths
	if (matchConfig.team1?.logoUrlOriginal) {
		matchConfig.team1.logoUrlLocal = cachedMap.get(matchConfig.team1.logoUrlOriginal) || matchConfig.team1.logoUrlLocal
	}
	if (matchConfig.team2?.logoUrlOriginal) {
		matchConfig.team2.logoUrlLocal = cachedMap.get(matchConfig.team2.logoUrlOriginal) || matchConfig.team2.logoUrlLocal
	}

	if (Array.isArray(matchConfig.team1?.players)) {
		for (const player of matchConfig.team1.players) {
			if (player.avatarUrlOriginal) {
				player.avatarUrlLocal = cachedMap.get(player.avatarUrlOriginal) || player.avatarUrlLocal
			}
		}
	}

	if (Array.isArray(matchConfig.team2?.players)) {
		for (const player of matchConfig.team2.players) {
			if (player.avatarUrlOriginal) {
				player.avatarUrlLocal = cachedMap.get(player.avatarUrlOriginal) || player.avatarUrlLocal
			}
		}
	}

	matchConfig.isOfflineReady = true
	matchConfig.cachedAt = new Date().toISOString()
	return matchConfig
}

/**
 * Imports match from FACEIT using URL or Match ID with automatic multi-tier fallback.
 */
export async function importFaceitMatch(matchInput, options = {}) {
	const matchId = extractMatchId(matchInput)
	if (!matchId) {
		throw new Error(`Invalid FACEIT Match URL or ID: "${matchInput}"`)
	}

	const apiKey = options.apiKey || process.env.FACEIT_API_KEY || null
	const autoCache = options.autoCache !== false

	let rawPayload = null
	let fetchSource = 'v4'

	// Tier 1: Data API v4 if API Key provided
	if (apiKey) {
		try {
			rawPayload = await fetchFromDataApiV4(matchId, apiKey)
		} catch (v4Err) {
			console.warn(`[FACEIT Import] Data API v4 failed: ${v4Err.message}. Falling back to public endpoint...`)
		}
	}

	// Tier 2: Public API v2 fallback
	if (!rawPayload) {
		try {
			rawPayload = await fetchFromPublicApiV2(matchId)
			fetchSource = 'v2_public'
		} catch (v2Err) {
			console.warn(`[FACEIT Import] Public API v2 failed: ${v2Err.message}`)
			throw new Error(`Could not fetch match "${matchId}" from FACEIT API: ${v2Err.message}`)
		}
	}

	const { matchConfig, vetoData } = parseFaceitMatch(rawPayload, fetchSource)

	if (autoCache) {
		await cacheMatchAssets(matchConfig)
	}

	activeMatchConfig = matchConfig
	activeMatchVeto = vetoData

	return {
		ok: true,
		match: matchConfig,
		veto: vetoData,
		source: fetchSource,
	}
}

/**
 * Returns currently active match configuration.
 */
export function getActiveMatchConfig() {
	return activeMatchConfig
}

/**
 * Sets active match configuration manually.
 */
export function setActiveMatchConfig(config) {
	activeMatchConfig = config
	return activeMatchConfig
}

/**
 * Returns currently active imported veto data (if available).
 */
export function getActiveMatchVeto() {
	return activeMatchVeto
}

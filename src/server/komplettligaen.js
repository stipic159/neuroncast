import { mkdir } from 'fs/promises'
import { join } from 'path'

import { readJsonIfExists, writeJson } from './helpers/json-file.js'
import { userspaceDirectory } from './helpers/paths.js'
import {
	scrapeMatch,
	scrapeTable,
	scrapeTeamGames,
} from './integrations/komplettligaen/scraper.js'
import { isUiDevMode } from './dev-mode.js'

// Import Persistence Cache Layer (Phase 13)
import { 
	readCache, 
	writeCache, 
	invalidateCache, 
	readCacheItem, 
	writeCacheItem, 
	getCacheMetadata 
} from './cache/scraper-cache.js'

// Import Default Structured Fallbacks (Phase 13)
import { 
	getMatchFallback, 
	getTableFallback, 
	getTeamGamesFallback 
} from './fallbacks/payload-fallbacks.js'

const configPath = join(userspaceDirectory, 'komplettligaen.json')
const cache = new Map()
const ttlMs = 60 * 1000

// In-memory store for tracking the last fetch error
let lastFetchFailureReason = null;

const defaultConfig = {
	matchId: '',
	activeView: 'match',
}

const readConfig = async () => ({
	...defaultConfig,
	...(await readJsonIfExists(configPath)),
})

const cached = async (key, fetcher) => {
	const hit = cache.get(key)
	if (hit && Date.now() - hit.createdAt < ttlMs) return hit.value

	const value = await fetcher()
	cache.set(key, { createdAt: Date.now(), value })
	return value
}

/**
 * Executes a promise with a hard timeout, throwing a timeout error if it hangs.
 */
const withTimeout = (promise, ms, description = 'Operation') => {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`${description} timed out after ${ms}ms`));
		}, ms);
	});
	return Promise.race([
		promise.then(res => {
			clearTimeout(timeoutId);
			return res;
		}),
		timeoutPromise
	]);
};

const getMockMatch = () => ({
	id: 'mock-123',
	division: '1. Divisjon',
	round: 'Runde 8',
	startsAt: new Date().toISOString(),
	bestOf: 3,
	home: { 
		name: 'Ember', 
		logo: '/hud/img/logos/t.png', 
		score: 0,
		stats: [
			{ name: 'Astra', kills: 22, assists: 4, deaths: 18, rating: '1.24' },
			{ name: 'Bolt', kills: 18, assists: 6, deaths: 19, rating: '1.05' },
			{ name: 'Cipher', kills: 15, assists: 3, deaths: 20, rating: '0.88' },
			{ name: 'Drift', kills: 12, assists: 2, deaths: 21, rating: '0.72' },
			{ name: 'Echo', kills: 9, assists: 8, deaths: 22, rating: '0.65' }
		]
	},
	away: { 
		name: 'Nord', 
		logo: '/hud/img/logos/ct.png', 
		score: 1,
		stats: [
			{ name: 'Frost', kills: 26, assists: 2, deaths: 14, rating: '1.45' },
			{ name: 'Ghost', kills: 21, assists: 8, deaths: 15, rating: '1.32' },
			{ name: 'Haze', kills: 19, assists: 4, deaths: 16, rating: '1.18' },
			{ name: 'Ion', kills: 16, assists: 5, deaths: 17, rating: '1.02' },
			{ name: 'Juno', kills: 14, assists: 7, deaths: 18, rating: '0.94' }
		]
	},
	maps: [
		{ name: 'Mirage', image: '/hud/img/maps/de_mirage.png', status: 'finished', homeScore: 13, awayScore: 16, finished: true, winner: 'away' },
		{ name: 'Anubis', image: '/hud/img/maps/de_anubis.png', status: 'live', homeScore: 9, awayScore: 8, finished: false },
		{ name: 'Ancient', image: '/hud/img/maps/de_ancient.png', status: 'scheduled', homeScore: null, awayScore: null, finished: false }
	],
	currentMap: { name: 'Anubis', image: '/hud/img/maps/de_anubis.png', homeScore: 9, awayScore: 8, finished: false }
})

export const getKomplettligaenConfig = readConfig

export const getKomplettligaenBundle = async (matchId, teamId = null) => {
	// If UI Dev Mode mock match
	if ((!matchId || String(matchId).startsWith('mock-')) && isUiDevMode) {
		return {
			match: getMockMatch(),
			table: getTableFallback(),
			teamGames: getTeamGamesFallback(),
			generatedAt: new Date().toISOString(),
			stale: false,
			source: 'mock'
		}
	}
	
	if (!matchId) {
		return {
			match: getMatchFallback(matchId),
			table: getTableFallback(),
			teamGames: getTeamGamesFallback(),
			stale: false,
			source: 'fallback'
		}
	}

	let match = null
	let table = null
	let teamGames = null
	let stale = false
	let cacheAgeMinutes = 0
	let source = 'live'
	let errorsOccurred = false

	// Hard request timeout ceiling (5000ms)
	const TIMEOUT_CEILING = 5000;

	// 1. Fetch Match
	try {
		match = await withTimeout(cached(`match:${matchId}`, () => scrapeMatch(matchId)), TIMEOUT_CEILING, 'Match scraper fetch');
		// Write to matches.json cache as map item (Log warning only on failure)
		await writeCacheItem('matches', matchId, match, 'scrapeMatch');
	} catch (err) {
		errorsOccurred = true;
		lastFetchFailureReason = `Match fetch failed: ${err.message}`;
		console.warn(`[Scraper Warning] Failed to fetch live match ${matchId}: ${err.message}. Retrying local cache...`);
		
		// Fallback to matches.json item cache
		const cachedMatch = await readCacheItem('matches', matchId);
		if (cachedMatch) {
			match = cachedMatch.payload;
			stale = true;
			source = 'cache';
			cacheAgeMinutes = Math.max(cacheAgeMinutes, Math.floor((Date.now() - new Date(cachedMatch.savedAt)) / 60000));
		} else {
			match = getMatchFallback(matchId);
			source = 'fallback';
		}
	}

	// 2. Fetch Standings / Table
	const divisionId = match ? (match.divisionId || undefined) : undefined;
	const divisionName = match ? match.division : 'Unknown';
	const tableKey = `${divisionId || 'default'}:${divisionName}`;

	try {
		table = await withTimeout(cached(`table:${tableKey}`, () => scrapeTable(divisionId, divisionName)), TIMEOUT_CEILING, 'Standings scraper fetch');
		// Write to standings.json cache as map item
		await writeCacheItem('standings', tableKey, table, 'scrapeTable');
	} catch (err) {
		errorsOccurred = true;
		lastFetchFailureReason = `Table fetch failed: ${err.message}`;
		console.warn(`[Scraper Warning] Failed to fetch live standings for ${divisionName}: ${err.message}. Retrying local cache...`);
		
		// Fallback to standings.json item cache
		const cachedTable = await readCacheItem('standings', tableKey);
		if (cachedTable) {
			table = cachedTable.payload;
			stale = true;
			if (source !== 'fallback') source = 'cache';
			cacheAgeMinutes = Math.max(cacheAgeMinutes, Math.floor((Date.now() - new Date(cachedTable.savedAt)) / 60000));
		} else {
			table = getTableFallback();
			if (source !== 'cache') source = 'fallback';
		}
	}

	// 3. Fetch TeamGames / Schedule
	try {
		teamGames = await withTimeout(cached(`team-games:${matchId}:${teamId || ''}`, () => scrapeTeamGames(matchId, teamId)), TIMEOUT_CEILING, 'Schedule scraper fetch');
	} catch (err) {
		errorsOccurred = true;
		lastFetchFailureReason = `TeamGames fetch failed: ${err.message}`;
		console.warn(`[Scraper Warning] Failed to fetch live schedule: ${err.message}. Defaulting to structured fallback...`);
		teamGames = getTeamGamesFallback();
	}

	// 4. Ultimate Full Bundle Backup Cache (komplettligaen.json)
	// If any component completely failed to resolve via live/item-cache, try to recover using the full bundle backup
	if (source === 'fallback') {
		const fullBackup = await readCache('komplettligaen');
		if (fullBackup && fullBackup.payload && fullBackup.payload.match) {
			match = fullBackup.payload.match;
			table = fullBackup.payload.table || table;
			teamGames = fullBackup.payload.teamGames || teamGames;
			stale = true;
			source = 'cache';
			cacheAgeMinutes = Math.floor((Date.now() - new Date(fullBackup.savedAt)) / 60000);
		}
	}

	const bundle = {
		match,
		table,
		teamGames,
		generatedAt: new Date().toISOString(),
		stale,
		cacheAgeMinutes,
		source
	};

	// Save successfully resolved live data as full backup komplettligaen.json (Never fails live request)
	if (!errorsOccurred && source === 'live') {
		await writeCache('komplettligaen', bundle, 'getBundle');
		lastFetchFailureReason = null; // Clear failure reason on clean live load
	}

	return bundle;
}

export const registerKomplettligaenRoutes = (router, websocket) => {
	router.get('/config/komplettligaen', async (context) => {
		context.body = await readConfig()
	})

	router.put('/config/komplettligaen', async (context) => {
		const current = await readConfig()
		const incoming = context.request.body || {}
		const config = {
			...current,
			matchId: String(incoming.matchId ?? current.matchId ?? '').trim(),
			activeView: String(incoming.activeView ?? current.activeView ?? defaultConfig.activeView),
		}

		await mkdir(userspaceDirectory, { recursive: true })
		await writeJson(configPath, config)
		websocket.broadcastRefresh()
		context.body = config
	})

	router.get('/api/komplettligaen', async (context) => {
		const config = await readConfig()
		context.body = {
			config,
			data: await getKomplettligaenBundle(config.matchId, context.query.teamId),
		}
	})

	router.get('/api/komplettligaen/preview', async (context) => {
		const matchId = String(context.query.matchId || '').trim()
		if (!matchId) {
			context.status = 400
			context.body = { error: 'matchId is required' }
			return
		}

		context.body = await getKomplettligaenBundle(matchId, context.query.teamId)
	})

	router.post('/config/komplettligaen/refresh', async (context) => {
		cache.clear()
		context.status = 204
	})

	// 5. Diagnostics & Admin API Routes (Phase 13)
	router.get('/api/komplettligaen/cache-status', async (context) => {
		const komplettligaenMeta = await getCacheMetadata('komplettligaen');
		const matchesMeta = await getCacheMetadata('matches');
		const standingsMeta = await getCacheMetadata('standings');

		context.body = {
			exists: komplettligaenMeta.exists || matchesMeta.exists || standingsMeta.exists,
			savedAt: komplettligaenMeta.savedAt || matchesMeta.savedAt || null,
			stale: komplettligaenMeta.stale || matchesMeta.stale || standingsMeta.stale || false,
			source: komplettligaenMeta.source || matchesMeta.source || 'N/A',
			ageMinutes: komplettligaenMeta.exists ? komplettligaenMeta.ageMinutes : matchesMeta.exists ? matchesMeta.ageMinutes : 0,
			fetchFailureReason: lastFetchFailureReason,
			files: {
				komplettligaen: komplettligaenMeta,
				matches: matchesMeta,
				standings: standingsMeta
			}
		};
	})

	router.post('/config/komplettligaen/cache-reset', async (context) => {
		await invalidateCache('komplettligaen');
		await invalidateCache('matches');
		await invalidateCache('standings');
		cache.clear();
		lastFetchFailureReason = null;
		websocket.broadcastRefresh();
		context.status = 204;
	})
}

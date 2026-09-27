import { fetchFastcupMatch, extractMatchId, normalizeMapName } from './fetcher.js'
import { cacheRemoteAsset, batchCacheAssets } from '../../cache/asset-cache-manager.js'
import { CS2_ACTIVE_MAP_POOL } from '../faceit/faceit-parser.js'

let activeFastcupMatchConfig = null
let activeFastcupVetoData = null

/**
 * Normalizes player object from FastcupMatchPayload into standard MatchConfig player schema.
 */
function normalizeFastcupPlayer(p, idx) {
	const avatarOriginal = p.avatarUrl && !p.avatarUrl.includes('radar-dead-player') ? p.avatarUrl : ''
	return {
		fastcupId: p.fastcupId || String(p.id || ''),
		steamId64: String(p.steamId64 || p.steam_id64 || '').trim(),
		nickname: String(p.nickname || p.name || `Player ${idx + 1}`).slice(0, 32),
		realName: null,
		avatarUrlOriginal: avatarOriginal,
		avatarUrlLocal: avatarOriginal || '/assets/placeholders/default_avatar.svg',
		elo: typeof p.rating === 'number' ? p.rating : null,
		countryCode: null,
	}
}

/**
 * Normalizes FastCup team into standard MatchConfig team schema.
 */
function normalizeFastcupTeam(rawTeam, teamKey = 'team1') {
	const defaultName = teamKey === 'team1' ? 'Team 1' : 'Team 2'
	const name = rawTeam?.name || defaultName
	const tag = rawTeam?.tag || name.slice(0, 8).toUpperCase()
	const logoOriginal = rawTeam?.logoUrl || ''

	const players = Array.isArray(rawTeam?.players)
		? rawTeam.players.map(normalizeFastcupPlayer)
		: []

	const eloValues = players.map(p => p.elo).filter(e => typeof e === 'number' && e > 0)
	const avgElo = eloValues.length > 0
		? Math.round(eloValues.reduce((a, b) => a + b, 0) / eloValues.length)
		: null

	return {
		id: String(rawTeam?.id || teamKey),
		name: String(name).slice(0, 48),
		shortName: tag,
		tag,
		logoUrlOriginal: logoOriginal,
		logoUrlLocal: logoOriginal || '/assets/placeholders/default_team.svg',
		primaryColor: teamKey === 'team1' ? '#3B82F6' : '#EF4444',
		secondaryColor: '#000000',
		countryCode: null,
		avgElo,
		players,
	}
}

/**
 * Converts FastCup veto steps into VetoEngine compatible structure.
 */
export function parseFastcupVeto(fastcupVeto, format = 'bo1') {
	if (!fastcupVeto || !Array.isArray(fastcupVeto.steps) || fastcupVeto.steps.length === 0) {
		return null
	}

	const steps = fastcupVeto.steps
	const mapsStatus = {}
	const actionHistory = []

	// Start with full standard pool
	CS2_ACTIVE_MAP_POOL.forEach(mapId => {
		mapsStatus[mapId] = {
			mapId,
			status: 'AVAILABLE',
			actionTeam: null,
			pickedSide: null,
			orderIndex: null,
		}
	})

	steps.forEach((step, idx) => {
		const mapId = normalizeMapName(step.mapName || step.map_name)
		const actionType = (step.action || 'ban').toUpperCase()
		const team = step.team === 'team2' ? 'team2' : 'team1'

		let status = 'BANNED'
		if (actionType === 'PICK') {
			status = 'PICKED'
		}

		mapsStatus[mapId] = {
			mapId,
			status,
			actionTeam: team,
			orderIndex: idx + 1,
		}

		actionHistory.push({
			stepIndex: idx,
			type: actionType,
			team,
			mapId,
			timestamp: Date.now(),
		})
	})

	// Check if only 1 map left as decider
	const remaining = CS2_ACTIVE_MAP_POOL.filter(m => mapsStatus[m]?.status === 'AVAILABLE')
	if (remaining.length === 1 && (format === 'bo1' || format === 'bo3')) {
		const deciderMap = remaining[0]
		mapsStatus[deciderMap] = {
			mapId: deciderMap,
			status: 'DECIDER',
			actionTeam: null,
			orderIndex: steps.length + 1,
		}
		actionHistory.push({
			stepIndex: steps.length,
			type: 'DECIDER',
			team: null,
			mapId: deciderMap,
			timestamp: Date.now(),
		})
	}

	return {
		activeMapPool: CS2_ACTIVE_MAP_POOL,
		mapsStatus,
		actionHistory,
		isPredefined: actionHistory.length > 0,
	}
}

/**
 * Downloads and caches all team logos and player avatars locally.
 */
export async function cacheMatchAssets(matchConfig) {
	if (!matchConfig) return matchConfig

	const itemsToCache = []

	// Team 1 Logo
	if (matchConfig.team1?.logoUrlOriginal && !matchConfig.team1.logoUrlOriginal.startsWith('/')) {
		itemsToCache.push({
			url: matchConfig.team1.logoUrlOriginal,
			subfolder: 'teams',
			key: `team1_${matchConfig.team1.id || 't1'}`,
		})
	}

	// Team 2 Logo
	if (matchConfig.team2?.logoUrlOriginal && !matchConfig.team2.logoUrlOriginal.startsWith('/')) {
		itemsToCache.push({
			url: matchConfig.team2.logoUrlOriginal,
			subfolder: 'teams',
			key: `team2_${matchConfig.team2.id || 't2'}`,
		})
	}

	// Team 1 Players
	if (Array.isArray(matchConfig.team1?.players)) {
		for (const player of matchConfig.team1.players) {
			if (player.avatarUrlOriginal && !player.avatarUrlOriginal.startsWith('/')) {
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
			if (player.avatarUrlOriginal && !player.avatarUrlOriginal.startsWith('/')) {
				itemsToCache.push({
					url: player.avatarUrlOriginal,
					subfolder: 'avatars',
					key: player.steamId64 || player.nickname,
				})
			}
		}
	}

	if (itemsToCache.length > 0) {
		const cachedMap = await batchCacheAssets(itemsToCache)

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
	}

	matchConfig.isOfflineReady = true
	matchConfig.cachedAt = new Date().toISOString()
	return matchConfig
}

/**
 * Imports match from FastCup URL or numeric ID.
 */
export async function importFastcupMatch(matchInput, options = {}) {
	const matchId = extractMatchId(matchInput)
	if (!matchId) {
		throw new Error(`Invalid FastCup Match URL or ID: "${matchInput}"`)
	}

	const sessionCookie = options.sessionCookie || ''
	const autoCache = options.autoCache !== false

	const fastcupPayload = await fetchFastcupMatch(matchId, sessionCookie)

	const team1 = normalizeFastcupTeam(fastcupPayload.teams?.team1, 'team1')
	const team2 = normalizeFastcupTeam(fastcupPayload.teams?.team2, 'team2')

	const rawFormat = String(fastcupPayload.format || 'BO1').toLowerCase()
	const format = rawFormat === 'bo3' ? 'bo3' : (rawFormat === 'bo5' ? 'bo5' : 'bo1')

	const vetoData = parseFastcupVeto(fastcupPayload.veto, format)

	const matchConfig = {
		id: String(matchId),
		source: 'fastcup',
		title: `${team1.name} vs ${team2.name}`,
		format,
		scheduledTime: new Date().toISOString(),
		team1,
		team2,
		activeMapPool: vetoData?.activeMapPool || CS2_ACTIVE_MAP_POOL,
		cachedAt: new Date().toISOString(),
		isOfflineReady: false,
	}

	if (autoCache) {
		await cacheMatchAssets(matchConfig)
	}

	activeFastcupMatchConfig = matchConfig
	activeFastcupVetoData = vetoData

	return {
		ok: true,
		match: matchConfig,
		veto: vetoData,
		source: 'fastcup',
	}
}

export function getActiveFastcupMatchConfig() {
	return activeFastcupMatchConfig
}

export function setActiveFastcupMatchConfig(config) {
	activeFastcupMatchConfig = config
	return activeFastcupMatchConfig
}

export function getActiveFastcupMatchVeto() {
	return activeFastcupVetoData
}

/**
 * Parser and normalizer for FACEIT match data (Data API v4 & Public API v2).
 */

export const CS2_ACTIVE_MAP_POOL = [
	'de_mirage',
	'de_inferno',
	'de_nuke',
	'de_ancient',
	'de_anubis',
	'de_dust2',
	'de_vertigo',
]

export const MAP_DISPLAY_NAMES = {
	de_mirage: 'Mirage',
	de_inferno: 'Inferno',
	de_nuke: 'Nuke',
	de_ancient: 'Ancient',
	de_anubis: 'Anubis',
	de_dust2: 'Dust II',
	de_vertigo: 'Vertigo',
	de_train: 'Train',
	de_overpass: 'Overpass',
	de_cache: 'Cache',
}

/**
 * Normalizes any map string to canonical `de_mapname`.
 */
export function normalizeMapId(rawName) {
	if (!rawName || typeof rawName !== 'string') return 'unknown'
	const clean = rawName.trim().toLowerCase().replace(/[\s-]+/g, '_')

	if (clean === 'dust2' || clean === 'dust_2' || clean === 'dustii' || clean === 'dust_ii' || clean === 'dust ii') return 'de_dust2'
	if (clean === 'mirage') return 'de_mirage'
	if (clean === 'inferno') return 'de_inferno'
	if (clean === 'nuke') return 'de_nuke'
	if (clean === 'ancient') return 'de_ancient'
	if (clean === 'anubis') return 'de_anubis'
	if (clean === 'vertigo') return 'de_vertigo'
	if (clean === 'train') return 'de_train'
	if (clean === 'overpass') return 'de_overpass'

	if (clean.startsWith('de_')) {
		if (clean === 'de_dust_2' || clean === 'de_dustii' || clean === 'de_dust_ii') return 'de_dust2'
		return clean
	}

	return `de_${clean}`
}

/**
 * Extracts FACEIT Match ID from full URL, short URL, or raw ID string.
 */
export function extractMatchId(input) {
	if (!input || typeof input !== 'string') return null
	const trimmed = input.trim()

	// 1. Check for standard UUID or FACEIT room ID with prefix (1-xxxx)
	const uuidRegex = /(?:room\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
	const match = trimmed.match(uuidRegex)
	if (match && match[1]) {
		return match[1]
	}

	// 2. Pure hexadecimal GUIDs (32 chars)
	if (/^[0-9a-f]{32}$/i.test(trimmed)) {
		return trimmed
	}

	return null
}

/**
 * Formats player object from raw FACEIT player payload.
 */
function normalizePlayer(rawPlayer) {
	if (!rawPlayer) return null

	const nickname = rawPlayer.nickname || rawPlayer.game_player_name || 'Player'
	const steamId64 = rawPlayer.game_player_id || rawPlayer.steam_id_64 || ''
	const avatarUrlOriginal = rawPlayer.avatar || ''
	const elo = Number(rawPlayer.elo || rawPlayer.game_skill_level || 0) || null
	const countryCode = (rawPlayer.country || rawPlayer.country_code || '').toLowerCase() || null

	return {
		faceitId: rawPlayer.player_id || rawPlayer.id || null,
		steamId64: String(steamId64).trim(),
		nickname: String(nickname).slice(0, 32),
		realName: rawPlayer.name || null,
		avatarUrlOriginal,
		avatarUrlLocal: avatarUrlOriginal || '/assets/placeholders/default_avatar.svg',
		elo,
		countryCode,
	}
}

/**
 * Formats team object from raw FACEIT faction payload.
 */
function normalizeTeam(faction, defaultName = 'Team', factionKey = 'team1') {
	if (!faction) {
		return {
			id: factionKey,
			name: defaultName,
			shortName: defaultName.slice(0, 8).toUpperCase(),
			tag: defaultName.slice(0, 8).toUpperCase(),
			logoUrlOriginal: '',
			logoUrlLocal: '/assets/placeholders/default_team.svg',
			primaryColor: factionKey === 'team1' ? '#3B82F6' : '#EF4444',
			secondaryColor: '#000000',
			countryCode: null,
			avgElo: null,
			players: [],
		}
	}

	const name = faction.name || faction.nickname || defaultName
	const roster = Array.isArray(faction.roster)
		? faction.roster.map(normalizePlayer).filter(Boolean)
		: Array.isArray(faction.players)
			? faction.players.map(normalizePlayer).filter(Boolean)
			: []

	const eloValues = roster.map(p => p.elo).filter(e => typeof e === 'number' && e > 0)
	const avgElo = eloValues.length > 0
		? Math.round(eloValues.reduce((a, b) => a + b, 0) / eloValues.length)
		: null

	return {
		id: faction.faction_id || faction.id || factionKey,
		name: String(name).slice(0, 48),
		shortName: String(faction.tag || name).slice(0, 8).toUpperCase(),
		tag: String(faction.tag || name).slice(0, 8).toUpperCase(),
		logoUrlOriginal: faction.avatar || faction.icon || '',
		logoUrlLocal: faction.avatar || faction.icon || '/assets/placeholders/default_team.svg',
		primaryColor: factionKey === 'team1' ? '#3B82F6' : '#EF4444',
		secondaryColor: '#000000',
		countryCode: (faction.country || '').toLowerCase() || null,
		avgElo,
		players: roster,
	}
}

/**
 * Parses FACEIT voting data to extract pre-existing map pick/ban result.
 */
export function parseFaceitVeto(voting, format = 'bo1') {
	if (!voting || !voting.map) {
		return null
	}

	const mapVoting = voting.map
	const entities = Array.isArray(mapVoting.entities) ? mapVoting.entities : []
	const picks = Array.isArray(mapVoting.pick) ? mapVoting.pick : []

	const activeMapPool = entities.map(e => normalizeMapId(e.class_name || e.name || e.guid))
	const mapsStatus = {}
	const actionHistory = []

	// Initialize all maps as AVAILABLE
	activeMapPool.forEach(mapId => {
		mapsStatus[mapId] = {
			mapId,
			status: 'AVAILABLE',
		}
	})

	// Process pick sequence from FACEIT
	picks.forEach((pickItem, idx) => {
		const mapRaw = typeof pickItem === 'string' ? pickItem : (pickItem.class_name || pickItem.name || pickItem.guid)
		const mapId = normalizeMapId(mapRaw)
		if (!mapId || mapId === 'unknown') return

		const actionTeam = (idx % 2 === 0) ? 'team1' : 'team2'
		const isLast = idx === picks.length - 1

		let status = 'BANNED'
		if (format === 'bo1' && isLast) {
			status = 'DECIDER'
		}

		mapsStatus[mapId] = {
			mapId,
			status,
			actionTeam,
			orderIndex: idx + 1,
		}

		actionHistory.push({
			stepIndex: idx,
			type: status === 'DECIDER' ? 'DECIDER' : 'BAN',
			team: actionTeam,
			mapId,
			timestamp: Date.now(),
		})
	})

	return {
		activeMapPool: activeMapPool.length > 0 ? activeMapPool : CS2_ACTIVE_MAP_POOL,
		mapsStatus,
		actionHistory,
		isPredefined: actionHistory.length > 0,
	}
}

/**
 * Main parser converting raw FACEIT payload into normalized MatchConfig & VetoData.
 */
export function parseFaceitMatch(rawPayload, source = 'v4') {
	if (!rawPayload || typeof rawPayload !== 'object') {
		throw new Error('Invalid or empty match payload from FACEIT')
	}

	const matchId = rawPayload.match_id || rawPayload.id || 'unknown_match'
	const teams = rawPayload.teams || {}
	const faction1 = teams.faction1 || rawPayload.faction1 || null
	const faction2 = teams.faction2 || rawPayload.faction2 || null

	const team1 = normalizeTeam(faction1, 'Team 1', 'team1')
	const team2 = normalizeTeam(faction2, 'Team 2', 'team2')

	let bestOf = 1
	if (rawPayload.best_of) {
		bestOf = Number(rawPayload.best_of) || 1
	} else if (rawPayload.game_type && rawPayload.game_type.includes('bo3')) {
		bestOf = 3
	} else if (rawPayload.game_type && rawPayload.game_type.includes('bo5')) {
		bestOf = 5
	}

	const format = bestOf === 3 ? 'bo3' : bestOf === 5 ? 'bo5' : 'bo1'
	const title = rawPayload.competition_name || rawPayload.entity?.name || `${team1.name} vs ${team2.name}`
	const votingData = parseFaceitVeto(rawPayload.voting, format)

	const matchConfig = {
		id: matchId,
		source: 'faceit',
		title,
		format,
		scheduledTime: rawPayload.scheduled_at ? new Date(rawPayload.scheduled_at * 1000).toISOString() : new Date().toISOString(),
		team1,
		team2,
		activeMapPool: votingData?.activeMapPool || CS2_ACTIVE_MAP_POOL,
		cachedAt: new Date().toISOString(),
		isOfflineReady: false,
	}

	return {
		matchConfig,
		vetoData: votingData,
	}
}

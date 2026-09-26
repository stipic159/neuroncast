import { toSteamID64 } from './steam-utils.js'
import { downloadAsset } from './asset-cache.js'

/**
 * Extracts a numeric Match ID from a raw string, URL, or path.
 * Examples: '1048294', 'https://cs.fastcup.net/match/1048294', 'cs.fastcup.net/match/1048294?tab=info'
 * 
 * @param {string} input 
 * @returns {string|null}
 */
export function extractMatchId(input) {
	if (input === null || input === undefined) return null
	const str = String(input).trim()
	if (!str) return null

	// Pure number
	if (/^\d+$/.test(str)) {
		return str
	}

	// URL pattern matching /match/12345 or match-12345
	const match = str.match(/(?:match|matches)[/-](\d+)/i)
	if (match) {
		return match[1]
	}

	return null
}

/**
 * Normalizes map names (e.g. 'de_dust2' -> 'de_dust2', 'dust2' -> 'de_dust2')
 */
export function normalizeMapName(mapName) {
	if (!mapName) return 'de_tbd'
	const str = String(mapName).trim().toLowerCase()
	if (str.startsWith('de_') || str.startsWith('cs_')) return str
	return `de_${str}`
}

/**
 * Normalizes raw FastCup API match data into canonical FastcupMatchPayload structure.
 */
export async function normalizeFastcupPayload(rawData, matchId) {
	const data = rawData.data || rawData.match || rawData

	// Format BO1, BO3, BO5
	let format = 'BO1'
	const rawBo = data.best_of || data.bestOf || data.bo || (data.maps ? data.maps.length : 1)
	if (Number(rawBo) === 3) format = 'BO3'
	if (Number(rawBo) === 5) format = 'BO5'

	// Match Status
	let status = 'upcoming'
	const rawStatus = String(data.status || '').toLowerCase()
	if (['veto', 'pick_ban', '1', 'draft'].includes(rawStatus)) status = 'veto'
	else if (['live', 'in_progress', '2', 'playing', 'started'].includes(rawStatus)) status = 'live'
	else if (['finished', 'completed', 'ended', '3', 'closed'].includes(rawStatus)) status = 'finished'
	else if (data.is_live || data.isLive) status = 'live'
	else if (data.is_finished || data.isFinished) status = 'finished'

	// Parse Team 1 & Team 2
	const rawTeam1 = data.team1 || data.team_1 || data.teams?.[0] || {}
	const rawTeam2 = data.team2 || data.team_2 || data.teams?.[1] || {}

	const parseTeam = async (rawTeam, teamKey, defaultSide) => {
		const rawPlayers = rawTeam.players || rawTeam.roster || rawTeam.members || []
		const parsedPlayers = []

		let captainSteamId64 = ''

		for (const p of rawPlayers) {
			const rawSteam = p.steam_id64 || p.steam64Id || p.steam_id || p.steamId || p.steam32 || p.steam || p.fastcup_id || p.id
			const steamId64 = toSteamID64(rawSteam) || `765611990000000${parsedPlayers.length + 1}`
			const fastcupId = String(p.id || p.fastcup_id || p.fastcupId || '')
			const nickname = String(p.nickname || p.name || p.username || `Player_${steamId64.slice(-4)}`).trim()
			
			const origAvatar = p.avatar_url || p.avatarUrl || p.avatar || null
			const avatarUrl = origAvatar ? (await downloadAsset(origAvatar, `avatar_${steamId64}`)) : '/hud/img/icons/radar-dead-player.svg'
			
			const rating = p.rating ?? p.elo ?? p.points ?? 1000
			const rank = String(p.rank || p.division || 'Unranked')

			if (p.is_captain || p.isCaptain || p.role === 'captain' || !captainSteamId64) {
				captainSteamId64 = steamId64
			}

			parsedPlayers.push({
				steamId64,
				fastcupId,
				nickname,
				avatarUrl,
				rating,
				rank,
			})
		}

		const isMixTeam = !rawTeam.name || rawTeam.is_mix || rawTeam.isMix || rawTeam.name.toLowerCase().includes('team_')
		const captainPlayer = parsedPlayers.find(p => p.steamId64 === captainSteamId64) || parsedPlayers[0]
		const defaultTeamName = captainPlayer ? `Team ${captainPlayer.nickname}` : (teamKey === 'team1' ? 'Alpha' : 'Bravo')
		const name = (rawTeam.name && !rawTeam.name.startsWith('team_')) ? rawTeam.name : defaultTeamName
		const tag = rawTeam.tag || name.slice(0, 4).toUpperCase()

		const rawLogo = rawTeam.logo_url || rawTeam.logoUrl || rawTeam.avatar || rawTeam.logo || captainPlayer?.avatarUrl || null
		const logoUrl = rawLogo ? (await downloadAsset(rawLogo, `team_${teamKey}`)) : null

		return {
			id: String(rawTeam.id || teamKey),
			name,
			tag,
			logoUrl,
			isMixTeam: !!isMixTeam,
			captainSteamId64: captainSteamId64 || (parsedPlayers[0]?.steamId64 ?? ''),
			players: parsedPlayers,
		}
	}

	const team1 = await parseTeam(rawTeam1, 'team1', 'CT')
	const team2 = await parseTeam(rawTeam2, 'team2', 'T')

	// Parse Pick / Ban Veto
	const rawVetoSteps = data.veto || data.picks_bans || data.veto_steps || []
	const steps = []

	if (Array.isArray(rawVetoSteps)) {
		rawVetoSteps.forEach((step, idx) => {
			const teamRef = (step.team_id === team1.id || step.team === 'team1' || step.side === 1) ? 'team1' : 'team2'
			const action = step.action || (step.type === 'ban' ? 'ban' : (step.type === 'pick' ? 'pick' : 'decider'))
			steps.push({
				team: teamRef,
				action,
				mapName: normalizeMapName(step.map_name || step.mapName || step.map),
				order: idx + 1,
			})
		})
	}

	let vetoStatus = 'pending'
	if (steps.length > 0) {
		vetoStatus = (status === 'live' || status === 'finished') ? 'completed' : 'in_progress'
	}

	return {
		matchId: String(matchId),
		provider: 'fastcup',
		format,
		status,
		fetchedAt: Date.now(),
		teams: {
			team1,
			team2,
		},
		veto: {
			status: vetoStatus,
			activePicker: data.active_picker === team2.id ? 'team2' : 'team1',
			steps,
		},
		overrides: {
			lockedFields: [],
			customData: {},
		}
	}
}

/**
 * Fetches match details from cs.fastcup.net given a match ID or match URL.
 * 
 * @param {string} matchIdOrUrl 
 * @param {string} sessionCookie Optional authentication session cookie
 * @returns {Promise<Object>} FastcupMatchPayload
 */
export async function fetchFastcupMatch(matchIdOrUrl, sessionCookie = '') {
	const matchId = extractMatchId(matchIdOrUrl)
	if (!matchId) {
		throw new Error(`Invalid FastCup Match ID or URL: "${matchIdOrUrl}"`)
	}

	const urls = [
		`https://cs.fastcup.net/api/v3/matches/${matchId}`,
		`https://fastcup.net/api/v3/matches/${matchId}`,
		`https://cs.fastcup.net/match/${matchId}`,
	]

	const headers = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Accept': 'application/json, text/html, */*',
		'Referer': 'https://cs.fastcup.net/',
		'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
	}

	if (sessionCookie) {
		headers['Cookie'] = sessionCookie.includes('=') ? sessionCookie : `session=${sessionCookie}`
	}

	let lastError = null

	for (const url of urls) {
		try {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), 6000)

			const response = await fetch(url, { headers, signal: controller.signal })
			clearTimeout(timer)

			if (!response.ok) {
				throw new Error(`FastCup HTTP ${response.status}: ${response.statusText}`)
			}

			const contentType = response.headers.get('content-type') || ''
			let jsonData = null

			if (contentType.includes('application/json')) {
				jsonData = await response.json()
			} else {
				const htmlText = await response.text()
				// Try to extract window.__INITIAL_STATE__ or json scripts from HTML
				const stateMatch = htmlText.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});<\/script>/)
				if (stateMatch) {
					try {
						jsonData = JSON.parse(stateMatch[1])
					} catch (e) {
						// JSON parse failed
					}
				}
			}

			if (jsonData) {
				return await normalizeFastcupPayload(jsonData, matchId)
			}
		} catch (err) {
			lastError = err
		}
	}

	throw new Error(`Failed to fetch FastCup match #${matchId}: ${lastError?.message || 'Network error'}`)
}

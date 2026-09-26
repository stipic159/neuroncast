const GENERIC_GSI_NAMES = new Set([
	'terrorist',
	'terrorists',
	'counter-terrorist',
	'counter-terrorists',
	'ct',
	't',
])

const normalize = (value) => String(value || '').trim()

export const isGenericGsiTeamName = (name) => {
	const normalized = normalize(name).toLowerCase()
	return !normalized || GENERIC_GSI_NAMES.has(normalized)
}

const candidate = (source, value, details = {}) => ({
	source,
	value: normalize(value) || null,
	valid: details.valid ?? !!normalize(value),
	reason: details.reason || null,
	meta: details.meta || {},
})

const sideFallbackName = (side) => side === 'CT' ? 'CT' : 'T'

const pickFirstValid = (candidates) => candidates.find((item) => item.valid && item.value) || null

const confidenceForSource = (source) => ({
	override: 'high',
	fastcup: 'high',
	komplettligaen: 'high',
	'match-session': 'medium',
	gsi: 'medium',
	'filesystem-logo': 'low',
	fallback: 'low',
}[source] || 'low')

export const resolveTeamIdentity = (side, context) => {
	const sideKey = side.toLowerCase()
	const slot = context.slots?.[sideKey] || {}
	const gsiName = slot.gsi?.name || ''
	const fc = slot.fastcup || {}
	const kl = slot.komplettligaen || {}
	const session = slot.session || {}
	const fsLogo = slot.filesystemLogo || {}

	const nameCandidates = [
		candidate('override', slot.override?.name, {
			reason: slot.override?.name ? 'Manual operator override for this sidebar slot.' : 'No manual override configured.',
		}),
		candidate('fastcup', fc.name, {
			reason: fc.name ? 'FastCup match identity mapped via SteamID quorum to this side.' : 'No FastCup team name available.',
			meta: { matchId: context.fastcup?.config?.matchId || null },
		}),
		candidate('komplettligaen', kl.name, {
			reason: kl.name ? 'GG Arena match identity mapped to the current sidebar slot.' : 'No GG Arena team name available for this slot.',
			meta: { matchId: context.komplettligaen?.config?.matchId || null },
		}),
		candidate('match-session', session.name, {
			reason: session.name ? 'Active match session metadata contains a team name.' : 'No active match session team name available.',
			meta: { sessionId: context.session?.id || null },
		}),
		candidate('gsi', gsiName, {
			valid: !!normalize(gsiName) && !isGenericGsiTeamName(gsiName),
			reason: isGenericGsiTeamName(gsiName)
				? 'GSI name is a generic CS side label and is ignored.'
				: 'Live GSI supplied a non-generic team name.',
		}),
		candidate('fallback', sideFallbackName(side), {
			reason: 'Last-resort side fallback.',
		}),
	]

	const finalName = pickFirstValid(nameCandidates)
	const resolvedName = finalName?.value || sideFallbackName(side)

	const logoCandidates = [
		candidate('override', slot.override?.logo, {
			reason: 'No manual team logo override is currently configured.',
			valid: false,
		}),
		candidate('fastcup', fc.logo, {
			reason: fc.logo ? 'FastCup match identity provides this team logo.' : 'No FastCup logo available for this side.',
			meta: { matchId: context.fastcup?.config?.matchId || null },
		}),
		candidate('komplettligaen', kl.logo, {
			reason: kl.logo ? 'GG Arena match identity provides this logo.' : 'No GG Arena logo available for this slot.',
			meta: { matchId: context.komplettligaen?.config?.matchId || null },
		}),
		candidate('match-session', session.logo, {
			reason: session.logo ? 'Active match session metadata contains a logo.' : 'No active match session logo available.',
			meta: { sessionId: context.session?.id || null },
		}),
		candidate('gsi', null, {
			valid: false,
			reason: 'CS2 GSI does not provide team logos.',
		}),
		candidate('filesystem-logo', fsLogo.path, {
			valid: !!fsLogo.exists,
			reason: fsLogo.exists
				? 'A matching local filesystem logo exists in the HUD theme chain.'
				: 'No matching local filesystem logo exists for the resolved team name.',
			meta: { exists: !!fsLogo.exists },
		}),
		candidate('fallback', null, {
			valid: false,
			reason: 'No fallback team logo is configured.',
		}),
	]

	const finalLogo = pickFirstValid(logoCandidates)
	const warnings = []
	if (isGenericGsiTeamName(gsiName)) {
		warnings.push(`Ignored generic GSI ${side} name "${gsiName || sideFallbackName(side)}".`)
	}
	if (!finalLogo?.value) {
		warnings.push(`No resolved ${side} team logo.`)
	}

	return {
		side,
		final: {
			name: resolvedName,
			logo: finalLogo?.value || null,
			nameSource: finalName?.source || 'fallback',
			logoSource: finalLogo?.source || null,
			confidence: confidenceForSource(finalName?.source),
			warnings,
		},
		candidates: {
			name: nameCandidates,
			logo: logoCandidates,
		},
	}
}

export const resolveTeamIdentities = (context) => {
	const teams = {
		CT: resolveTeamIdentity('CT', context),
		T: resolveTeamIdentity('T', context),
	}

	const warnings = []
	const ctName = teams.CT.final.name?.trim().toLowerCase()
	const tName = teams.T.final.name?.trim().toLowerCase()
	const ctLogo = teams.CT.final.logo?.trim().toLowerCase()
	const tLogo = teams.T.final.logo?.trim().toLowerCase()

	if (ctName && tName && ctName === tName) {
		warnings.push(`Duplicate resolved team name: "${teams.CT.final.name}".`)
		teams.CT.final.warnings.push('Resolved name duplicates the T side.')
		teams.T.final.warnings.push('Resolved name duplicates the CT side.')
	}

	if (ctLogo && tLogo && ctLogo === tLogo) {
		warnings.push(`Duplicate resolved team logo: "${teams.CT.final.logo}".`)
		teams.CT.final.warnings.push('Resolved logo duplicates the T side.')
		teams.T.final.warnings.push('Resolved logo duplicates the CT side.')
	}

	return {
		generatedAt: new Date().toISOString(),
		teams,
		warnings,
	}
}

const hudSlotForTeam = (teams, side) => {
	const index = teams?.findIndex((team) => team?.side === (side === 'CT' ? 3 : 2)) ?? -1
	return {
		index,
		slot: index === 0 ? 'left' : index === 1 ? 'right' : side === 'CT' ? 'right' : 'left',
		team: index >= 0 ? teams[index] : null,
	}
}

const makeHudSlot = ({ side, slot, team, options, klEntry }) => {
	const overrideName = slot === 'left'
		? options?.['teams.leftTeamName']
		: options?.['teams.rightTeamName']
	const candidateNameForLogo = normalize(overrideName)
		|| normalize(klEntry?.name)
		|| (!isGenericGsiTeamName(team?.name) ? normalize(team?.name) : sideFallbackName(side))

	return {
		side,
		sidebarSlot: slot,
		override: {
			name: overrideName || null,
			logo: null,
		},
		komplettligaen: {
			name: klEntry?.name || null,
			logo: klEntry?.logo || null,
		},
		session: {
			name: null,
			logo: null,
		},
		gsi: {
			name: team?.name || null,
			score: team?.score ?? null,
		},
		filesystemLogo: {
			path: `/hud/team-logos/${candidateNameForLogo}.png`,
			exists: false,
		},
	}
}

// ---- which scraped team is on which side? ---------------------------------
// The old rule was positional (home = T, away = CT, whatever the game said),
// so every match where the home team started CT - and every second half -
// showed the names the wrong way round (2026-09-17, live). Three sources, in
// order of trust:
//   1. the game feed's own team names (league servers set them) matched
//      against the scraped home/away names
//   2. the match page's starting side for the current map, plus the round
//      number (MR12: sides swap after round 12; overtime swaps every 3 rounds)
//   3. the old positional guess
// The operator's "swap" switch is applied last, on top of whatever was found.
const normalizeTeamName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const teamNamesMatch = (a, b) => {
	const x = normalizeTeamName(a)
	const y = normalizeTeamName(b)
	if (!x || !y) return false
	if (x === y) return true
	const shorter = x.length < y.length ? x : y
	return shorter.length >= 4 && (x.includes(y) || y.includes(x))
}

export const normalizeMapName = (value) => String(value || '').toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '').replace(/ii$/, '2')

const otherSide = (side) => (side === 'CT' ? 'T' : 'CT')

/** The side a team is on in round `roundNumber` (1-based) given where it
 * started. MR12 regulation (24 rounds), then 3-round overtime halves. */
export const sideInRound = (startSide, roundNumber, regulationRounds = 24) => {
	if (!startSide) return null
	const r = Math.max(1, Number(roundNumber) || 1)
	const half = regulationRounds / 2
	let swapped
	if (r <= half) swapped = false
	else if (r <= regulationRounds) swapped = true
	else swapped = Math.floor((r - regulationRounds - 1) / 3) % 2 === 1
	return swapped ? otherSide(startSide) : startSide
}

/**
 * @param {object} p
 * @param {object} p.match       scraped match ({home, away, maps[]})
 * @param {object} p.options     options map (the swap switch)
 * @param {{name?:string, score?:number}} p.ct   the game feed's CT team
 * @param {{name?:string, score?:number}} p.t    the game feed's T team
 * @param {string} [p.mapName]   the game feed's map (de_ancient)
 * @returns {{ct: object|null, t: object|null, source: string}}
 */
export const assignKlSides = ({ match, options = {}, ct = {}, t = {}, mapName = null } = {}) => {
	const home = match?.home || null
	const away = match?.away || null
	if (!home?.name && !away?.name) return { ct: null, t: null, source: 'none' }
	let sideOfHome = null
	let source = null

	// 1. by the game feed's team names
	const ctName = isGenericGsiTeamName(ct?.name) ? '' : ct?.name
	const tName = isGenericGsiTeamName(t?.name) ? '' : t?.name
	const homeIsCt = teamNamesMatch(home?.name, ctName)
	const homeIsT = teamNamesMatch(home?.name, tName)
	const awayIsCt = teamNamesMatch(away?.name, ctName)
	const awayIsT = teamNamesMatch(away?.name, tName)
	if ((homeIsCt && !homeIsT) || (awayIsT && !awayIsCt)) { sideOfHome = 'CT'; source = 'gsi-name' }
	else if ((homeIsT && !homeIsCt) || (awayIsCt && !awayIsT)) { sideOfHome = 'T'; source = 'gsi-name' }

	// 2. by the match page's starting side for this map + the round number
	if (!source && mapName && Array.isArray(match?.maps)) {
		const wanted = normalizeMapName(mapName)
		const entry = match.maps.find((m) => normalizeMapName(m?.name) === wanted)
		if (entry?.homeStartSide) {
			const roundNumber = (Number(ct?.score) || 0) + (Number(t?.score) || 0) + 1
			sideOfHome = sideInRound(entry.homeStartSide, roundNumber)
			source = 'starting-side'
		}
	}

	// 3. the old positional guess (home = T, away = CT)
	if (!source) { sideOfHome = 'T'; source = 'home-away' }

	// operator override, on top
	if (options?.['preferences.topBar.swapScrapedTeams']) { sideOfHome = otherSide(sideOfHome); source += '+swapped' }

	return sideOfHome === 'CT' ? { ct: home, t: away, source } : { ct: away, t: home, source }
}

export const buildHudTeamIdentityContext = ({ teams = [], options = {}, match = null, map = null } = {}) => {
	const ct = hudSlotForTeam(teams, 'CT')
	const t = hudSlotForTeam(teams, 'T')
	const klSides = assignKlSides({
		match, options,
		ct: { name: ct.team?.name, score: ct.team?.score },
		t: { name: t.team?.name, score: t.team?.score },
		mapName: map?.name || null,
	})

	return {
		options,
		themeTree: [],
		komplettligaen: {
			config: {},
			match,
			sideSource: klSides.source,
		},
		session: null,
		slots: {
			ct: makeHudSlot({
				side: 'CT',
				slot: ct.slot,
				team: ct.team,
				options,
				klEntry: klSides.ct,
			}),
			t: makeHudSlot({
				side: 'T',
				slot: t.slot,
				team: t.team,
				options,
				klEntry: klSides.t,
			}),
		},
	}
}

let stickyFastcupSides = null

export const assignFastcupSides = ({ match, gsiAllPlayers }) => {
	if (!match || !match.teams || !match.teams.team1 || !match.teams.team2) {
		return { ct: null, t: null, source: 'none' }
	}

	const fcTeam1 = match.teams.team1
	const fcTeam2 = match.teams.team2

	const team1SteamIds = new Set((fcTeam1.players || []).map(p => p.steamId64))
	const team2SteamIds = new Set((fcTeam2.players || []).map(p => p.steamId64))

	let team1CtCount = 0
	let team1TCount = 0
	let team2CtCount = 0
	let team2TCount = 0

	const playersList = Array.isArray(gsiAllPlayers) 
		? gsiAllPlayers 
		: Object.entries(gsiAllPlayers || {}).map(([steamId, p]) => ({ ...p, steamId64: steamId }))

	for (const p of playersList) {
		const sId = p.steam64Id || p.steamId || p.steamid
		const team = String(p.team || p.side || '').toUpperCase()
		const side = (team === 'CT' || p.side === 3) ? 'CT' : ((team === 'T' || p.side === 2) ? 'T' : null)

		if (!sId || !side) continue

		if (team1SteamIds.has(sId)) {
			if (side === 'CT') team1CtCount++
			else if (side === 'T') team1TCount++
		}
		if (team2SteamIds.has(sId)) {
			if (side === 'CT') team2CtCount++
			else if (side === 'T') team2TCount++
		}
	}

	let resolvedSideTeam1 = null

	if (team1CtCount > team1TCount && (team1CtCount >= 2 || team1CtCount > team2CtCount)) {
		resolvedSideTeam1 = 'CT'
	} else if (team1TCount > team1CtCount && (team1TCount >= 2 || team1TCount > team2TCount)) {
		resolvedSideTeam1 = 'T'
	} else if (team2CtCount > team2TCount) {
		resolvedSideTeam1 = 'T'
	} else if (team2TCount > team2CtCount) {
		resolvedSideTeam1 = 'CT'
	}

	if (resolvedSideTeam1) {
		const ctTeam = resolvedSideTeam1 === 'CT' ? fcTeam1 : fcTeam2
		const tTeam = resolvedSideTeam1 === 'CT' ? fcTeam2 : fcTeam1
		stickyFastcupSides = {
			ct: { name: ctTeam.name, logo: ctTeam.logoUrl, tag: ctTeam.tag, players: ctTeam.players },
			t: { name: tTeam.name, logo: tTeam.logoUrl, tag: tTeam.tag, players: tTeam.players },
			source: 'fastcup-quorum',
		}
		return stickyFastcupSides
	}

	if (stickyFastcupSides) {
		return stickyFastcupSides
	}

	return {
		ct: { name: fcTeam1.name, logo: fcTeam1.logoUrl, tag: fcTeam1.tag, players: fcTeam1.players },
		t: { name: fcTeam2.name, logo: fcTeam2.logoUrl, tag: fcTeam2.tag, players: fcTeam2.players },
		source: 'fastcup-default',
	}
}

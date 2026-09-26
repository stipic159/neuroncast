import { gsiState, options, players } from '/hud/core/state.js'
import { getOverriddenTeamName, getTeamNameOverrides } from '/hud/gsi/helpers/team-name-overrides.js'
import { isGenericGsiTeamName } from '/hud/helpers/team-identity-resolver.js'

const getGrenadeKey = (weaponName) => {
	switch (weaponName) {
		case 'weapon_decoy': return 'decoy'
		case 'weapon_flashbang': return 'flashbang'
		case 'weapon_hegrenade': return 'hegrenade'
		case 'weapon_smokegrenade': return 'smokegrenade'

		case 'weapon_incgrenade':
		case 'weapon_molotov':
			return 'molotov'
	}
}

const getAutoDerivedTeamName = (gsiTeamObject, teamMembers, side) => {
	const rawName = gsiTeamObject?.name?.trim()
	if (rawName && !isGenericGsiTeamName(rawName)) {
		return rawName
	}

	if (teamMembers && teamMembers.length > 0) {
		const clanCounts = {}
		for (const p of teamMembers) {
			const clan = p.clanTag?.trim()
			if (clan) {
				clanCounts[clan] = (clanCounts[clan] || 0) + 1
			}
		}
		let bestClan = null
		let maxCount = 0
		for (const [clan, count] of Object.entries(clanCounts)) {
			if (count > maxCount) {
				maxCount = count
				bestClan = clan
			}
		}
		if (bestClan && maxCount >= 2) {
			return bestClan
		}
	}

	return rawName || (side === 3 ? 'COUNTER-TERRORISTS' : 'TERRORISTS')
}

const makeTeam = (side, gsiTeamObject, teamNameOverrides) => {
	const teamMembers = players.filter((player) => player.side === side)
	gsiTeamObject = gsiTeamObject || {}

	const overriddenTeamName = getOverriddenTeamName(teamNameOverrides, teamMembers)
	const derivedName = getAutoDerivedTeamName(gsiTeamObject, teamMembers, side)

	const team = {
		side,

		consecutiveRoundLosses: gsiTeamObject.consecutive_round_losses,
		flag: gsiTeamObject.flag,
		matchesWonThisSeries: gsiTeamObject.matches_won_this_series,
		name: overriddenTeamName || derivedName,
		players: teamMembers,
		score: gsiTeamObject.score,
		timeoutsRemaining: gsiTeamObject.timeouts_remaining,

		grenades: {
			decoy: 0,
			flashbang: 0,
			hegrenade: 0,
			molotov: 0,
			smokegrenade: 0,
			total: 0,
		},
	}

	for (const player of teamMembers) {
		player.team = team

		for (const grenade of player.grenades) {
			team.grenades.total++
			team.grenades[getGrenadeKey(grenade.name)]++
		}
	}

	return team
}

// NB! This must be called AFTER parsePlayers!
export const parseTeams = () => {
	const teamNameOverrides = getTeamNameOverrides()

	const getSortKey = (team) => {
		const firstSlot = team.players?.[0]?.observerSlot
		if (firstSlot !== undefined && firstSlot !== null) return firstSlot
		return team.side === 2 ? 1 : 10
	}

	const sorted = [
		makeTeam(2, gsiState.map?.team_t, teamNameOverrides),
		makeTeam(3, gsiState.map?.team_ct, teamNameOverrides),
	].sort((a, b) => getSortKey(a) - getSortKey(b))

	// Simple team name overrides (takes priority over everything)
	const leftName = options['teams.leftTeamName']?.trim()
	const rightName = options['teams.rightTeamName']?.trim()

	if (leftName && sorted[0]) sorted[0].name = leftName
	if (rightName && sorted[1]) sorted[1].name = rightName

	return sorted
}

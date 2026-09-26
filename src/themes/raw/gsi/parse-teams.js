import { gsiState, options, players } from '/hud/core/state.js'
import { getOverriddenTeamName, getTeamNameOverrides } from '/hud/gsi/helpers/team-name-overrides.js'

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

const getFallbackNameFromSide = (side) => {
	return ''
}

const makeTeam = (side, gsiTeamObject, teamNameOverrides) => {
	const teamMembers = players.filter((player) => player.side === side)
	gsiTeamObject = gsiTeamObject || {}

	const overriddenTeamName = getOverriddenTeamName(teamNameOverrides, teamMembers)

	const team = {
		side,

		consecutiveRoundLosses: gsiTeamObject.consecutive_round_losses,
		flag: gsiTeamObject.flag,
		matchesWonThisSeries: gsiTeamObject.matches_won_this_series, // TODO we may want to have options override this
		name: overriddenTeamName || gsiTeamObject.name || getFallbackNameFromSide(side),
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

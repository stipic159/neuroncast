/**
 * Central player name and team logo path resolution helper.
 * This runs client-side in NeuronCast HUD overlays and intermission pages.
 */

/**
 * Resolves player display name based on SteamID64 against the playerNameOverrides configuration string.
 * Uses a safe segment-based regex split to support spaces in overridden names.
 */
export const getPlayerDisplayName = (steamId, rawName, nameOverridesOption) => {
	if (! steamId || ! nameOverridesOption) return rawName || ''
	const opt = nameOverridesOption
	if (! opt?.trim()?.length) return rawName || ''

	const lines = opt.trim().split('\n')
	for (const line of lines) {
		const segments = line.trim().split(/\s+/)
		if (
			segments.length >= 2
			&& /^\d+$/.test(segments[0])
			&& segments[0].startsWith('7656')
			&& segments[0] === steamId
		) {
			return segments.slice(1).join(' ')
		}
	}
	return rawName || ''
}

/**
 * Centrally constructs the URL path for team logos.
 */
export const getTeamLogoPath = (teamName) => {
	if (! teamName) return null
	return `/hud/team-logos/${teamName}.png`
}

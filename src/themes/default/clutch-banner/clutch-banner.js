import { getPlayerDisplayName } from '/hud/helpers/player-resolver.js'

export default {
	name: 'ClutchBanner',
	computed: {
		activeClutch() {
			// Only show during live round play (including when bomb is planted/defused)
			const phase = this.$gsiState?.round?.phase
			const bombPhase = this.$gsiState?.round?.bomb
			const isLive = phase === 'live' || bombPhase === 'planted' || bombPhase === 'defusing'
			if (!isLive) return null

			const players = this.$players || []
			if (!players.length) return null

			const ctAlive = players.filter(p => (p.side === 3 || p.team === 'CT') && (p.health > 0 || p.isAlive))
			const tAlive = players.filter(p => (p.side === 2 || p.team === 'T') && (p.health > 0 || p.isAlive))

			// CT Clutch (1 CT vs 2+ T)
			if (ctAlive.length === 1 && tAlive.length >= 2) {
				const clutcher = ctAlive[0]
				return {
					side: 'CT',
					steamId: clutcher.steam64Id || clutcher.steamId,
					name: getPlayerDisplayName(clutcher.steam64Id, clutcher.name, this.$opts?.['teams.playerNameOverrides']),
					hp: clutcher.health ?? 100,
					versus: tAlive.length,
					title: `1v${tAlive.length} CLUTCH`,
				}
			}

			// T Clutch (1 T vs 2+ CT)
			if (tAlive.length === 1 && ctAlive.length >= 2) {
				const clutcher = tAlive[0]
				return {
					side: 'T',
					steamId: clutcher.steam64Id || clutcher.steamId,
					name: getPlayerDisplayName(clutcher.steam64Id, clutcher.name, this.$opts?.['teams.playerNameOverrides']),
					hp: clutcher.health ?? 100,
					versus: ctAlive.length,
					title: `1v${ctAlive.length} CLUTCH`,
				}
			}

			return null
		},
	},
}

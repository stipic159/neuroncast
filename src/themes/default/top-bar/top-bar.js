import CurrentRound from '/hud/top-bar/center/current-round/current-round.vue'
import MatchPointRounds from '/hud/top-bar/center/match-point-rounds/match-point-rounds.vue'
import SeriesName from '/hud/top-bar/series-name/series-name.vue'
import { teamColorClass } from '/hud/helpers/team-color-class.js'
import { buildHudTeamIdentityContext, resolveTeamIdentities } from '/hud/helpers/team-identity-resolver.js'

export default {
	props: ['match'],

	components: {
		CurrentRound,
		MatchPointRounds,
		SeriesName,
	},

	methods: {
		teamColorClass,

		getResolvedTeamIdentity(teamIndex) {
			const team = this.$teams?.[teamIndex]
			if (!team) return null

			const context = buildHudTeamIdentityContext({
				teams: this.$teams,
				map: this.$map,
				options: this.$opts,
				match: this.match,
			})
			const resolved = resolveTeamIdentities(context)
			return team.side === 3 ? resolved.teams.CT : resolved.teams.T
		},

		getTeamName(teamIndex) {
			return this.getResolvedTeamIdentity(teamIndex)?.final.name || ''
		},

		getTeamLogo(teamIndex) {
			return this.getResolvedTeamIdentity(teamIndex)?.final.logo || null
		}
	},
}



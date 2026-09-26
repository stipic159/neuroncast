import { teamColorClass } from '/hud/helpers/team-color-class.js'
import { resolveOption } from '/hud/core/resolve-option.js'

export default {
	computed: {
		isActive() {
			if (! this.$teams?.[0] || ! this.$teams?.[1]) return false
			if (! this.$teams[0]?.players?.length || ! this.$teams[1]?.players?.length) return false
			
			// Resolve show/hide state using central resolver
			const visible = resolveOption('layout.playersAlive.visible', true)
			if (visible === false || visible === 'none') return false

			if (this.$opts['preferences.playersAlive.showDuringFreezetime']) {
				return true
			}

			return ! this.$round?.isFreezetime
		},

		leftTeamAlive() {
			return this.countAlivePlayers(this.$teams[0])
		},

		rightTeamAlive() {
			return this.countAlivePlayers(this.$teams[1])
		},

		leftTeamColorClass() {
			return teamColorClass(this.$teams[0])
		},

		rightTeamColorClass() {
			return teamColorClass(this.$teams[1])
		},
	},

	methods: {
		countAlivePlayers(team) {
			if (! team?.players?.length) return 0

			let alive = 0

			for (const player of team.players) {
				if (player.isAlive) alive++
			}

			return alive
		},
	}
}



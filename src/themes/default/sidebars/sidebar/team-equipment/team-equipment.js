import { positionClass } from '/hud/helpers/position-class.js'
import { teamColorClass } from '/hud/helpers/team-color-class.js'

export default {
	props: [
		'position',
		'team',
	],

	computed: {
		positionClass,

		colorClass() {
			return teamColorClass(this.team)
		},

		isActive() {
			if (!this.team) return false
			return this.$round.isFreezetime
				|| (this.$round.phase === 'live' && this.$round.phaseEndsInSec >= (this.$opts['cvars.mp_roundtime'] * 60 - this.$opts['preferences.sidebar.teamEquipment.activeIntoRoundSec']))
		},

		lossBonusValue() {
			if (!this.team) return 0
			return this.$opts['cvars.cash_team_loser_bonus'] + Math.min(4, this.team.consecutiveRoundLosses || 0) * this.$opts['cvars.cash_team_loser_bonus_consecutive_rounds']
		},

		teamMoney() {
			if (!this.team?.players) return 0
			return this.team.players.reduce((sum, player) => sum + player.money, 0)
		},

		teamEquipmentValue() {
			if (!this.team?.players) return 0
			return this.team.players.reduce((sum, player) => sum + player.equipmentValue, 0)
		},
	},
}



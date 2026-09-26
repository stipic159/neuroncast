import { teamColorClass } from '/hud/helpers/team-color-class.js'
import Digits from '/hud/digits/digits.vue'

export default {
	components: {
		Digits,
	},

	computed: {
		player() {
			return this.$players.focused
		},

		weapon() {
			const activeWeapon = this.player?.weapons?.find((weapon) => weapon.isActive && ! weapon.isGrenade && ! weapon.isKnife && ! weapon.isBomb)
			if (activeWeapon) return activeWeapon
			if (this.player?.primary?.isActive) return this.player.primary
			if (this.player?.secondary?.isActive) return this.player.secondary
			return this.player?.primary || this.player?.secondary
		},

		colorClass() {
			return teamColorClass(this.player?.team)
		},
	},
}



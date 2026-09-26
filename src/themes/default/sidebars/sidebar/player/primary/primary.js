import { positionClass } from '/hud/helpers/position-class.js'

export default {
	props: [
		'position',
		'player',
	],

	computed: {
		positionClass,

		iconUrl() {
			const weaponName = this.player?.primary?.unprefixedName
			return weaponName ? `/hud/img/weapons/${weaponName}.svg` : ''
		},
	},
}



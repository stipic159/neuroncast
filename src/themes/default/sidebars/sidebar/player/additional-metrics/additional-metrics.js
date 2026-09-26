import { positionClass } from '/hud/helpers/position-class.js'

export default {
	props: [
		'position',
		'player',
	],

	computed: {
		positionClass,

		isVisible() {
			return this.$round?.phase === 'freezetime'
		},
	},
}



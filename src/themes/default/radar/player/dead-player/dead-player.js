import { getLevel, levels } from '/hud/radar/helpers/radar-levels.js'
import { offsetX, offsetY } from '/hud/radar/helpers/radar-offset.js'
import { radarConfig } from '/hud/radar/helpers/radar-config.js'
import { teamColorClass } from '/hud/helpers/team-color-class.js'

export default {
	props: [
		'player',
	],

	computed: {
		levels,
		radarConfig,

		position() {
			return this.player.position
		},

		colorClass() {
			return teamColorClass(this.player.team)
		},

		coordinates() {
			return {
				x: this.offsetX(this.position[0]),
				y: this.offsetY(this.position[1]),
			}
		},

		level() {
			return this.getLevel(this.position[2])
		},

		isPositionValid() {
			const x = this.coordinates.x
			const y = this.coordinates.y
			
			// Valid if strictly within the radar container (0% to 100%)
			// This prevents both 0,0,0 leakage and off-map ghosting.
			const inBounds = x >= 0 && x <= 100 && y >= 0 && y <= 100

			return this.position && (this.position[0] !== 0 || this.position[1] !== 0) && inBounds
		},
	},

	methods: {
		getLevel,
		offsetX,
		offsetY,
	},
}



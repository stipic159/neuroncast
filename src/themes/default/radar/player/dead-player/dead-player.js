import { getLevel, levels } from '/hud/radar/helpers/radar-levels.js'
import { offsetX, offsetY } from '/hud/radar/helpers/radar-offset.js'
import { radarConfig } from '/hud/radar/helpers/radar-config.js'
import { teamColorClass } from '/hud/helpers/team-color-class.js'

export default {
	props: [
		'player',
	],

	data() {
		return {
			frozenDeathPosition: null,
		}
	},

	computed: {
		levels,
		radarConfig,

		position() {
			if (this.frozenDeathPosition) {
				return this.frozenDeathPosition
			}

			const pos = this.player?.position
			if (Array.isArray(pos) && pos.length >= 3 && (pos[0] !== 0 || pos[1] !== 0)) {
				this.frozenDeathPosition = [...pos]
				return this.frozenDeathPosition
			}

			return pos || [0, 0, 0]
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

	watch: {
		'player.steam64Id'() {
			this.frozenDeathPosition = null
		},
		'player.isAlive'(isAlive) {
			if (isAlive) {
				this.frozenDeathPosition = null
			}
		}
	},

	methods: {
		getLevel,
		offsetX,
		offsetY,
	},
}

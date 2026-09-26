import { getLevel, levels } from '/hud/radar/helpers/radar-levels.js'
import { offsetX, offsetY } from '/hud/radar/helpers/radar-offset.js'
import { radarConfig } from '/hud/radar/helpers/radar-config.js'
import { teamColorClass } from '/hud/helpers/team-color-class.js'
import { vectorDistance } from '/hud/helpers/vector-distance.js'

export default {
	data() {
		return {
			previousPositionsAndAngles: [],
		}
	},

	props: [
		'player',
	],

	computed: {
		levels,
		radarConfig,

		colorClass() {
			return teamColorClass(this.player.team)
		},

		coordinates() {
			const [x, y, z, a] = this.averagePreviousPositionsAndAngles()

			return {
				z,

				angle: a,
				x: this.offsetX(x),
				y: this.offsetY(y),
			}
		},

		level() {
			return this.getLevel(this.coordinates.z)
		},

		zIndex() {
			if (this.player.isFocused) return 8000000
			return 1000000 + Math.round(this.coordinates.z)
		},
	},

	watch: {
		'player.position': {
			handler() {
				this.rememberPositionAndAngle(this.getAngle())
			},
			deep: true,
			immediate: true
		}
	},

	methods: {
		getLevel,
		offsetX,
		offsetY,

		getAngle() {
			const [x, y] = this.player.forward || [0, 1]

			const radians = Math.atan2(x, y)
			const degrees = 180 * radians / Math.PI

			return (360 + Math.round(degrees)) % 360
		},

		// see src/themes/default/radar/helpers/previous-positions.js for an explanation of this
		averagePreviousPositionsAndAngles() {
			if (this.previousPositionsAndAngles.length === 0) {
				return [...(this.player.position || [0,0,0]), this.getAngle()]
			}

			let sumX = 0
			let sumY = 0
			let sumZ = 0
			let sumA = 0

			let anglesBetween0And90 = 0
			let anglesBetween270And360 = 0

			for (const [x, y, z, a] of this.previousPositionsAndAngles) {
				sumX += x
				sumY += y
				sumZ += z
				sumA += a

				if (a >= 0 && a <= 90) anglesBetween0And90++
				else if (a >= 270 && a <= 360) anglesBetween270And360++
			}

			if (anglesBetween0And90 && anglesBetween270And360) {
				sumA -= anglesBetween270And360 * 360
			}

			const count = this.previousPositionsAndAngles.length
			return [
				sumX / count,
				sumY / count,
				sumZ / count,
				sumA / count,
			]
		},

		rememberPositionAndAngle(angle) {
			const [x, y, z] = this.player.position || [0,0,0]

			// if players teleport across the map (e.g. at the beginning of a freezetime), clear the previous positions array first
			if (this.previousPositionsAndAngles.length > 0) {
				const distance = vectorDistance(this.previousPositionsAndAngles[this.previousPositionsAndAngles.length - 1], [x, y, z])

				if (distance > 128) {
					this.previousPositionsAndAngles.splice(0)
				}
			}

			this.previousPositionsAndAngles.push([x, y, z, angle])

			// Reduced from 16 to 8 for better responsiveness with CSS transitions
			if (this.previousPositionsAndAngles.length > 8) {
				this.previousPositionsAndAngles.shift()
			}
		},
	},
}



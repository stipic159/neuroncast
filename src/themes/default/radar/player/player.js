import AlivePlayer from '/hud/radar/player/alive-player/alive-player.vue'
import DeadPlayer from '/hud/radar/player/dead-player/dead-player.vue'
import { offsetX, offsetY } from '/hud/radar/helpers/radar-offset.js'
import { radarConfig } from '/hud/radar/helpers/radar-config.js'

export default {
	props: [
		'player',
	],

	components: {
		AlivePlayer,
		DeadPlayer,
	},

	computed: {
		radarConfig,

		hasRadarPosition() {
			if (! Array.isArray(this.player?.position) || this.player.position.length < 3) return false
			
			// Strictly ignore markers at 0,0 world coordinates (GS leakage)
			if (this.player.position[0] === 0 && this.player.position[1] === 0) return false

			// Safe bounds check: Hide markers that fall outside the 0-100% range of the radar container
			const x = this.offsetX(this.player.position[0])
			const y = this.offsetY(this.player.position[1])
			
			return x >= 0 && x <= 100 && y >= 0 && y <= 100
		},

		hasRadarForward() {
			return Array.isArray(this.player?.forward) && this.player.forward.length >= 2
		},
	},

	methods: {
		offsetX,
		offsetY,
	},
}



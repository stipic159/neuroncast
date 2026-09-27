import Bomb from '/hud/radar/bomb/bomb.vue'
import Grenade from '/hud/radar/grenade/grenade.vue'
import Player from '/hud/radar/player/player.vue'

export default {
	components: {
		Bomb,
		Grenade,
		Player,
	},

	computed: {
		radarConfig() {
			return this.$radars[this.$map.name] || this.$radars[this.$map.sanitizedName]
		},

		radarImageUrl() {
			return this.radarConfig?.radarImageUrl || `/hud/img/radars/ingame/${this.$map.sanitizedName}.png`
		},

		viewportStyle() {
			const zoom = this.radarConfig?.zoom || 1.18
			const originX = this.radarConfig?.origin_x || '50%'
			const originY = this.radarConfig?.origin_y || '50%'
			return {
				transform: `scale(${zoom})`,
				transformOrigin: `${originX} ${originY}`,
			}
		},
	},
}

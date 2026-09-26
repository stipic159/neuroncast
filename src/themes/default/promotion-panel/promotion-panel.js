export default {
	computed: {
		isVisible() {
			// Manual toggle from config
			if (this.$opts['promotion.visible']) return true

			// Automatic trigger during freezetime
			if (this.$opts['promotion.autoShow'] && this.$round.isFreezetime) return true

			return false
		},

		sideClass() {
			return `--${this.$opts['promotion.side'] || 'left'}`
		},

		imageUrl() {
			return this.$opts['promotion.imageUrl'] || ''
		},

		title() {
			return this.$opts['promotion.title'] || ''
		},

		subtitle() {
			return this.$opts['promotion.subtitle'] || ''
		}
	}
}



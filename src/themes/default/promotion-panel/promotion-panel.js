export default {
	computed: {
		isVisible() {
			// Real-time mobile ticker from phone
			if (this.$opts['branding.ticker'] && this.$opts['branding.ticker'].trim() !== '') return true

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
			if (this.$opts['branding.ticker'] && this.$opts['branding.ticker'].trim() !== '') {
				return this.$opts['promotion.title'] || '📢 ПРЯМОЙ ЭФИР'
			}
			return this.$opts['promotion.title'] || ''
		},

		subtitle() {
			if (this.$opts['branding.ticker'] && this.$opts['branding.ticker'].trim() !== '') {
				return this.$opts['branding.ticker']
			}
			return this.$opts['promotion.subtitle'] || ''
		}
	}
}

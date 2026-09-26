export default {
	data() {
		return {
			visible: false,
			mvp: null,
			timer: null,
		}
	},

	mounted() {
		// Listen for MVP_DISPLAY events
		window.addEventListener('socket:MVP_DISPLAY', this.handleSocketMvpDisplay)
	},

	beforeUnmount() {
		if (this.timer) clearTimeout(this.timer)
		window.removeEventListener('socket:MVP_DISPLAY', this.handleSocketMvpDisplay)
	},

	methods: {
		handleSocketMvpDisplay(e) {
			const data = e.detail
			if (!data) {
				this.visible = false
				return
			}
			this.mvp = data
			this.visible = true

			// Auto-hide after 8 seconds
			if (this.timer) clearTimeout(this.timer)
			this.timer = setTimeout(() => {
				this.visible = false
			}, 8000)
		}
	}
}



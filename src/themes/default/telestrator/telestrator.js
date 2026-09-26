export default {
	data() {
		return {
			canvas: null,
			ctx: null,
		}
	},

	mounted() {
		this.canvas = this.$refs.canvas
		if (this.canvas) {
			this.ctx = this.canvas.getContext('2d')
			this.resize()
			window.addEventListener('resize', this.resize)
		}

		// Listen for drawing events from the server
		window.addEventListener('socket:draw:line', this.handleSocketDrawLine)
		window.addEventListener('socket:draw:clear', this.handleSocketClear)
	},

	beforeUnmount() {
		window.removeEventListener('resize', this.resize)
		window.removeEventListener('socket:draw:line', this.handleSocketDrawLine)
		window.removeEventListener('socket:draw:clear', this.handleSocketClear)
	},

	methods: {
		resize() {
			if (! this.canvas) return
			const rect = this.canvas.parentElement.getBoundingClientRect()
			this.canvas.width = rect.width
			this.canvas.height = rect.height
		},

		handleSocketDrawLine(e) {
			const { x1, y1, x2, y2, color, size } = e.detail
			if (!this.ctx) return
			
			this.ctx.beginPath()
			this.ctx.moveTo(x1 * this.canvas.width, y1 * this.canvas.height)
			this.ctx.lineTo(x2 * this.canvas.width, y2 * this.canvas.height)
			
			this.ctx.strokeStyle = color || '#ff5a00'
			this.ctx.lineWidth = (size || 3) * (this.canvas.width / 1920) // Scale relative to 1080p width
			this.ctx.lineCap = 'round'
			this.ctx.lineJoin = 'round'
			this.ctx.stroke()
		},

		handleSocketClear() {
			if (!this.ctx) return
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
		}
	}
}



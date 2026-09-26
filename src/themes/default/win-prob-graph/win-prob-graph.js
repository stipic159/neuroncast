export default {
	computed: {
		history() {
			return this.$additionalState?.probHistory || [0.5]
		},

		points() {
			if (this.history.length === 0) return ''
			
			const width = 1000
			const height = 400
			const maxPoints = 100
			
			// Downsample if history is too long
			let dataset = this.history
			if (dataset.length > maxPoints) {
				const factor = dataset.length / maxPoints
				dataset = dataset.filter((_, i) => i % Math.floor(factor) === 0)
			}
			
			const stepX = width / (dataset.length - 1 || 1)
			return dataset.map((prob, i) => {
				const x = i * stepX
				const y = height - (prob * height)
				return `${x},${y}`
			}).join(' ')
		},

		currentProbPct() {
			return Math.round((this.$additionalState?.currentRoundProb || 0.5) * 100)
		}
	}
}



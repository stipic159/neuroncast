export default {
	computed: {
		match() {
			return this.$root.komplettligaenMatch
		},
		maps() {
			const m = this.match
			if (!m) return []
			const existing = m.maps || []
			if (existing.length > 0) return existing
			const count = m.bestOf || 3
			return Array.from({ length: count }, (_, i) => ({
				number: i + 1,
				name: 'TBD',
				image: null,
				status: 'upcoming',
				homeScore: null,
				awayScore: null,
				finished: false,
				winner: null,
				placeholder: true
			}))
		}
	},
	methods: {
		isCurrent(map) {
			if (!this.match?.currentMap) return false
			return this.match.currentMap.name === map.name
		}
	}
}

export default {
	props: {
		match: {
			type: Object,
			default: null
		}
	},
	computed: {
		maps() {
			return this.match?.maps || []
		}
	},
	methods: {
		isCurrent(map) {
			if (!this.match?.currentMap) return false
			return this.match.currentMap.name === map.name
		}
	}
}

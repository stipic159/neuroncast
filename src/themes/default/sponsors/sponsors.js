const normalizeAssetUrl = (value) => {
	if (! value?.trim()) return ''

	const trimmed = value.trim()
	if (
		trimmed.startsWith('/')
		|| trimmed.startsWith('http://')
		|| trimmed.startsWith('https://')
		|| trimmed.startsWith('data:')
	) return trimmed

	return `/hud/${trimmed.replace(/^\.?\//, '')}`
}

export default {
	data() {
		return {
			indices: {
				left: 0,
				right: 0,
			},
			interval: null,
		}
	},

	computed: {
		sponsorSlots() {
			return ['left', 'right']
				.map((position) => {
					const rawImages = this.$opts[`sponsors.${position}.imageUrl`]?.trim() || ''
					const imageUrls = rawImages.split(',').map(url => normalizeAssetUrl(url.trim())).filter(url => !!url)
					const currentIndex = this.indices[position] % (imageUrls.length || 1)

					return {
						position,
						href: this.$opts[`sponsors.${position}.href`]?.trim() || '',
						imageUrls,
						imageUrl: imageUrls[currentIndex] || '',
						title: this.$opts[`sponsors.${position}.title`]?.trim() || '',
					}
				})
				.filter((slot) => slot.imageUrl || slot.title)
		},

		hasSponsors() {
			return this.sponsorSlots.length > 0
		},
	},

	mounted() {
		this.startRotation()
	},

	unmounted() {
		this.stopRotation()
	},

	methods: {
		startRotation() {
			this.stopRotation()
			const ms = this.$opts['sponsors.rotationInterval'] || 5000
			this.interval = setInterval(this.rotate, ms)
		},

		stopRotation() {
			if (this.interval) clearInterval(this.interval)
			this.interval = null
		},

		rotate() {
			['left', 'right'].forEach(pos => {
				const raw = this.$opts[`sponsors.${pos}.imageUrl`]?.trim() || ''
				const count = raw.split(',').filter(u => !!u.trim()).length
				if (count > 1) {
					this.indices[pos] = (this.indices[pos] + 1) % count
				}
			})
		}
	},

	watch: {
		'$opts.sponsors.rotationInterval'() {
			this.startRotation()
		}
	}
}



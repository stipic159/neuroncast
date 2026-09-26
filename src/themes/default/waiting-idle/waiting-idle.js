// Waiting-scene idle character: a perfectly-looping breathing model standing
// at the screen edge, broken up by an occasional watch-check fidget. The two
// videos are rendered under an IDENTICAL locked camera (camlock= in
// eon-director tools/blender_cs2anim_render.py) and share the same base pose
// at every clip boundary, so the opacity swap between them is invisible.
// Loop counts alternate short/long so the fidget never reads as a metronome.
export default {
	data() {
		return {
			phase: 'loop', // 'loop' | 'fidget'
			repsLeft: 5,
			longNext: true,
			assetsOk: true,
			bootTs: Date.now(),
		}
	},

	computed: {
		enabled() {
			return this.$opts['director.waitingIdle.enabled'] !== false
		},

		agent() {
			return this.$opts['director.waitingIdle.agent'] || 'ct-sas'
		},

		side() {
			return this.$opts['director.waitingIdle.side'] === 'left' ? 'left' : 'right'
		},

		loopSrc() {
			return `/hud/waiting-idle/renders/${this.agent}-loop.webm?v=${this.bootTs}`
		},

		fidgetSrc() {
			return `/hud/waiting-idle/renders/${this.agent}-fidget-watch.webm?v=${this.bootTs}`
		},
	},

	watch: {
		agent() {
			// new :src loads automatically; restart the choreography from the top
			this.assetsOk = true
			this.phase = 'loop'
			this.repsLeft = this.repsFor(false)
			this.longNext = true
			this.$nextTick(() => this.$refs.loop?.play?.().catch(() => {}))
		},
	},

	mounted() {
		this.repsLeft = this.repsFor(false)
	},

	methods: {
		repsFor(long) {
			const key = long ? 'director.waitingIdle.loopsLong' : 'director.waitingIdle.loopsShort'
			const n = Number(this.$opts[key])
			return Number.isFinite(n) && n >= 1 ? Math.round(n) : (long ? 10 : 5)
		},

		onLoopEnded() {
			const loop = this.$refs.loop
			this.repsLeft -= 1
			if (this.repsLeft > 0 || !this.$refs.fidget) {
				loop.currentTime = 0
				loop.play().catch(() => {})
				return
			}
			this.phase = 'fidget'
			const fidget = this.$refs.fidget
			fidget.currentTime = 0
			fidget.play().catch(() => {})
		},

		onFidgetEnded() {
			this.phase = 'loop'
			this.repsLeft = this.repsFor(this.longNext)
			this.longNext = !this.longNext
			const loop = this.$refs.loop
			loop.currentTime = 0
			loop.play().catch(() => {})
		},
	},
}

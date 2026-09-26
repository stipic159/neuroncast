// bomb-callout - the moment the bomb is planted (or defused), say so FRONT
// AND CENTER for a few seconds. Driven by the bomb state in the feed itself,
// so it fires on every client the same way; the top bar keeps the running
// countdown afterwards. (The small "Bomb Planted" toast is the config page's
// caster alert, not this.)
const HOLD_MS = { planted: 3200, defused: 3000 }

export default {
	data() {
		return { shown: false, leaving: false, kind: null, site: null, lastState: null, _timers: [] }
	},

	computed: {
		title() {
			return this.kind === 'defused' ? 'Bomb defused' : 'Bomb planted'
		},
		countdown() {
			const c = this.$bomb?.countdownSec
			return Number.isFinite(c) ? Math.max(0, Math.ceil(c)) : null
		},
	},

	watch: {
		'$bomb.state'(state, prev) {
			// a fresh plant: anything -> planted (defusing -> planted is a cancelled
			// defuse, not a new plant). Defused: the round-winning moment.
			if (state === 'planted' && prev !== 'defusing') this.show('planted')
			else if (state === 'defused') this.show('defused')
			else if (state === 'exploded' && this.shown) this.hide()
		},
		'$map.name'() { this.hide(true) },
	},

	beforeUnmount() { this.clear() },

	methods: {
		clear() { for (const t of this._timers) clearTimeout(t); this._timers = [] },
		show(kind) {
			this.clear()
			this.kind = kind
			this.site = kind === 'planted' ? (this.$bomb?.bombsite ? String(this.$bomb.bombsite).toUpperCase() : null) : null
			this.leaving = false
			this.shown = true
			this._timers.push(setTimeout(() => this.hide(), HOLD_MS[kind] || 3000))
		},
		hide(now = false) {
			this.clear()
			if (now) { this.shown = false; this.leaving = false; return }
			this.leaving = true
			this._timers.push(setTimeout(() => { this.shown = false; this.leaving = false }, 450))
		},
	},
}

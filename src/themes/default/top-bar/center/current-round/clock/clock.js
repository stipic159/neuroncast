import Digits from '/hud/digits/digits.vue'
import { additionalState } from '/hud/core/state.js'

export default {
	components: {
		Digits,
	},

	data() {
		return {
			nowUnixTimestamp: Date.now(),
			timerInterval: null,
			// monotonic guard: the feed's countdown lags the wall clock by the
			// transport delay, so the locally extrapolated value crosses a whole
			// second BEFORE the next frame snaps it back above it - the
			// 7-6-7-6 flicker seen live (2026-09-17). Within one phase the shown
			// value may only go down; it resets on a phase change or a real jump.
			guardPhase: null,
			guardValue: null,
		}
	},

	mounted() {
		this.timerInterval = setInterval(() => {
			this.nowUnixTimestamp = Date.now()
		}, 250)
	},

	beforeUnmount() {
		if (this.timerInterval) clearInterval(this.timerInterval)
	},

	computed: {
		bombCountdown() {
			const countdown = this.$bomb?.countdownSec
			if (! Number.isFinite(countdown)) return 0
			return Math.max(0, Math.ceil(countdown))
		},

		rawEndsInSec() {
			const syncedAt = additionalState.unixTimestamp
			const phaseEndsInSec = Number(this.$round?.phaseEndsInSec)
			if (! Number.isFinite(phaseEndsInSec)) return 0
			if (additionalState.uiDevMode) return Math.max(0, Math.ceil(phaseEndsInSec))
			if (! syncedAt) return Math.max(0, Math.ceil(phaseEndsInSec))

			const elapsedSeconds = (this.nowUnixTimestamp - syncedAt) / 1000
			return Math.max(0, Math.ceil(phaseEndsInSec - elapsedSeconds))
		},

		roundEndsInSec() {
			const raw = this.rawEndsInSec
			const phase = this.$round?.phase || null
			// a new phase, or a genuine jump up (pause lifted, timer extended):
			// follow the feed. Otherwise never tick back up.
			if (phase !== this.guardPhase || this.guardValue == null || raw > this.guardValue + 1.5) {
				this.guardPhase = phase
				this.guardValue = raw
			} else if (raw < this.guardValue) {
				this.guardValue = raw
			}
			return this.guardValue
		},

		clockMinutes() {
			return Math.floor(this.roundEndsInSec / 60)
		},

		clockSeconds() {
			return Math.floor(this.roundEndsInSec % 60)
		},

		isClockRed() {
			if (this.$round?.phase === 'freezetime' && ! this.$opts['preferences.topBar.clock.tenSecondsRedInFreezetime']) return false
			if ((this.$round?.phase === 'timeout_ct' || this.$round?.phase === 'timeout_t') && ! this.$opts['preferences.topBar.clock.tenSecondsRedInTacticalTimeout']) return false
			if (this.$round?.phase === 'over' && ! this.$opts['preferences.topBar.clock.tenSecondsRedInRoundRestartDelay']) return false

			return this.clockMinutes === 0
				&& this.clockSeconds <= 10
		},
	},
}



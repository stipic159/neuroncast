import Round from '/hud/series-graph/match/round-graph/round/round.vue'

export default {
	components: {
		Round,
	},

	computed: {
		maxRounds() {
			const mr = Number(this.$opts?.['cvars.mp_maxrounds'])
			return Number.isFinite(mr) && mr > 0 ? mr : 24
		},

		otMaxRounds() {
			const ot = Number(this.$opts?.['cvars.mp_overtime_maxrounds'])
			return Number.isFinite(ot) && ot > 0 ? ot : 6
		},

		isSecondHalf() {
			if (this.$round?.isOvertime) return false
			const currentRound = Number(this.$round?.roundNumber) || 1
			return currentRound > (this.maxRounds / 2)
		},

		firstRoundNumber() {
			if (this.$round?.isOvertime) {
				const otNum = Math.max(1, Number(this.$round?.overtimeNumber) || 1)
				return this.maxRounds + (otNum - 1) * this.otMaxRounds + 1
			}

			return this.isSecondHalf
				? (this.maxRounds / 2) + 1
				: 1
		},

		lastRoundNumber() {
			if (this.$round?.isOvertime) {
				return this.firstRoundNumber + this.otMaxRounds - 1
			}

			return this.firstRoundNumber + (this.maxRounds / 2) - 1
		},

		currentOvertimeLastRoundNumberOfFirstHalf() {
			if (! this.$round?.isOvertime) return null
			return this.firstRoundNumber + (this.otMaxRounds / 2) - 1
		},

		rounds() {
			const rounds = []
			const existingRounds = Array.isArray(this.$rounds) ? this.$rounds : []

			for (let i = this.firstRoundNumber; i <= this.lastRoundNumber; i++) {
				const found = existingRounds.find((r) => r?.roundNumber === i) || { roundNumber: i }

				rounds.push({
					...found,
					roundNumber: i,
					isLastRoundOfHalf: i === this.currentOvertimeLastRoundNumberOfFirstHalf,
				})
			}

			return rounds
		},
	},
}

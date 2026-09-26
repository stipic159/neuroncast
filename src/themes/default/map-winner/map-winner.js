export default {
	computed: {
		forceWinner() {
			return this.$opts['preferences.celebration.forceWinner'] || 'none'
		},

		isActive() {
			if (this.forceWinner === 'hidden') return false
			if (this.forceWinner !== 'none') return true
			return this.$map && (this.$map.phase === 'results' || this.$map.phase === 'gameover')
		},

		winningTeam() {
			if (this.forceWinner === 'team1') return this.$teams?.[0] || { name: 'Team 1', score: 0, matchesWonThisSeries: 0, side: 'CT' }
			if (this.forceWinner === 'team2') return this.$teams?.[1] || { name: 'Team 2', score: 0, matchesWonThisSeries: 0, side: 'T' }
			
			if (! this.isActive || ! this.$teams || this.$teams.length < 1) return { name: '', score: 0, matchesWonThisSeries: 0, side: 'CT' }
			
			if (this.$teams.length === 1) return this.$teams[0]

			const team0 = this.$teams[0]
			const team1 = this.$teams[1]

			if (! team0 || ! team1) return team0 || team1 || { name: '', score: 0, matchesWonThisSeries: 0, side: 'CT' }

			return (team0.score || 0) > (team1.score || 0) ? team0 : team1
		},

		losingTeam() {
			if (this.forceWinner === 'team1') return this.$teams?.[1] || { name: 'Team 2', score: 0, matchesWonThisSeries: 0, side: 'T' }
			if (this.forceWinner === 'team2') return this.$teams?.[0] || { name: 'Team 1', score: 0, matchesWonThisSeries: 0, side: 'CT' }

			if (! this.isActive || ! this.$teams || this.$teams.length < 2) return { name: '', score: 0, matchesWonThisSeries: 0, side: 'T' }
			
			const team0 = this.$teams[0]
			const team1 = this.$teams[1]

			if (! team0 || ! team1) return { name: '', score: 0, matchesWonThisSeries: 0, side: 'T' }

			return (team0.score || 0) > (team1.score || 0) ? team1 : team0
		},

		colorClass() {
			const side = this.winningTeam?.side
			if (! side) return '--ct'
			
			if (typeof side === 'number') {
				return side === 2 ? '--t' : '--ct'
			}

			return `--${side.toLowerCase()}`
		},

		hasSeriesScore() {
			return typeof this.winningTeam?.matchesWonThisSeries === 'number' && typeof this.losingTeam?.matchesWonThisSeries === 'number'
		},
	},
}



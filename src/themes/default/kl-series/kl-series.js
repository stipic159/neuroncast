// kl-series - the series row inside the Komplettligaen waiting / result
// panels: one readable card per map (BO3 -> three), with the map image, the
// team logos, each team's STARTING side for that map (as the match page
// shows it), and the score or the state of the map. Takes the match as a
// prop so it never depends on what $root happens to be.
export default {
	props: {
		match: { type: Object, default: null },
	},
	computed: {
		cards() {
			const m = this.match
			if (!m) return []
			const total = Math.max(m.bestOf || 3, (m.maps || []).length)
			const currentName = m.currentMap?.name || null
			return Array.from({ length: total }, (_, i) => {
				const map = (m.maps || [])[i]
				if (!map) {
					return { number: i + 1, name: 'TBD', image: null, placeholder: true, current: false,
						homeScore: null, awayScore: null, winner: null, homeStartSide: null, awayStartSide: null,
						statusLabel: 'Not decided', stateClass: '--pending' }
				}
				const hasScore = map.homeScore != null || map.awayScore != null
				const finished = !!map.finished
				const live = !finished && hasScore
				const current = !!currentName && map.name === currentName
				let statusLabel, stateClass
				if (finished) { statusLabel = map.winner ? `${(map.winner === 'home' ? m.home?.name : m.away?.name) || 'Winner'}` : 'Finished'; stateClass = '--finished' }
				else if (live) { statusLabel = 'Live'; stateClass = '--live' }
				else if (current) { statusLabel = 'Next up'; stateClass = '--next' }
				else { statusLabel = 'Not started'; stateClass = '--pending' }
				return {
					number: map.number || i + 1,
					name: map.name || `Map ${i + 1}`,
					image: map.image || null,
					placeholder: false,
					current,
					homeScore: hasScore ? map.homeScore ?? 0 : null,
					awayScore: hasScore ? map.awayScore ?? 0 : null,
					winner: finished ? map.winner : null,
					homeStartSide: map.homeStartSide || null,
					awayStartSide: map.awayStartSide || null,
					statusLabel,
					stateClass,
				}
			})
		},
	},
}

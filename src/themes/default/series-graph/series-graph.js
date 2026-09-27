import { formatMapName } from '/hud/helpers/format-map-name.js'
import { seriesMapNumbers } from '/hud/helpers/series-map-numbers.js'
import Match from '/hud/series-graph/match/match.vue'

export default {
	components: {
		Match,
	},

	computed: {
		seriesMapNumbers,

		matches() {
			const maps = []
			const numbers = this.seriesMapNumbers || []

			for (const mapNumber of numbers) {
				const mapName = this.$opts?.[`series.maps.${mapNumber}.name`] || ''
				const scoreA = this.$opts?.[`series.maps.${mapNumber}.pickTeamScore`]
				const scoreB = this.$opts?.[`series.maps.${mapNumber}.enemyTeamScore`]

				const isOnlyMatch = numbers.length === 1
				const isFirstMapWithoutScores = ! scoreA && ! scoreB && (mapNumber === 1 || maps[maps.length - 1]?.scores)

				const cleanMapName = mapName.replace(/^(de_|cs_|ar_)/i, '').replace(/_/g, ' ')
				const formattedName = this.formatMapName ? this.formatMapName(mapName) : cleanMapName

				maps.push({
					id: `series-map-${mapNumber}-${mapName || 'pending'}`,
					mapNumber,
					isOnlyMatch,
					isCurrentMatch: isOnlyMatch || isFirstMapWithoutScores,
					isDecider: Boolean(this.$opts?.[`series.maps.${mapNumber}.isDecider`]),
					mapImageUrl: mapName ? `/hud/img/maps/${mapName}.png` : '/hud/img/maps/random.webp',
					mapName: formattedName,
					pickedByTeamName: this.$opts?.[`series.maps.${mapNumber}.pickTeam`],
					scores: scoreA || scoreB ? [scoreA, scoreB] : undefined,
				})
			}

			if (! maps.length) {
				const currentMapName = this.$map?.formattedName || this.$map?.name || 'Map'
				const sanitized = this.$map?.sanitizedName || 'random'
				return [{
					id: `series-map-fallback-${sanitized}`,
					mapNumber: 1,
					isCurrentMatch: true,
					isDecider: false,
					isOnlyMatch: true,
					mapImageUrl: `/hud/img/maps/${sanitized}.png`,
					mapName: currentMapName,
					pickedByTeamName: undefined,
					scores: undefined,
				}]
			}

			if (! maps.some((map) => map.isCurrentMatch)) {
				const currentFormatted = this.$map?.formattedName
				const mapWithSameName = currentFormatted ? maps.find((map) => map.mapName === currentFormatted) : null

				if (mapWithSameName) {
					mapWithSameName.isCurrentMatch = true
				}
			}

			return maps
		},
	},

	methods: {
		formatMapName,
	},
}

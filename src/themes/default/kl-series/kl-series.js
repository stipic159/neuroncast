// kl-series - the series row inside the match waiting / result panels:
// one readable card per map (BO1/BO2/BO3/BO5), with the map image, team logos,
// each team's STARTING side, and the score/state of the map.
// Designed for high-reliability, zero-flicker rendering in OBS CEF.

const MAP_DISPLAY_NAMES = {
	dust2: 'Dust II',
	mirage: 'Mirage',
	inferno: 'Inferno',
	nuke: 'Nuke',
	ancient: 'Ancient',
	anubis: 'Anubis',
	vertigo: 'Vertigo',
	overpass: 'Overpass',
	train: 'Train',
	cache: 'Cache',
	tuscan: 'Tuscan',
	basalt: 'Basalt',
	edin: 'Edin',
	palais: 'Palais',
	whistle: 'Whistle',
	office: 'Office',
	italy: 'Italy',
	baggage: 'Baggage',
	pool_day: 'Pool Day',
	shoots: 'Shoots',
}

/**
 * Normalizes raw map string (e.g., 'workshop/123/de_dust2', 'DE_INFERNO', 'Mirage')
 * into canonical lowercase key without prefixes (e.g., 'dust2', 'inferno', 'mirage').
 */
const normalizeMapKey = (rawName) => {
	if (!rawName) return ''
	let clean = String(rawName).trim().toLowerCase()
	// Strip workshop path if present
	if (clean.includes('/')) {
		clean = clean.split('/').pop()
	}
	// Strip prefix
	clean = clean.replace(/^(de_|cs_|ar_)/, '')
	// Strip file extension or extra tags
	clean = clean.replace(/\.(bsp|png|jpg|webp)$/, '')
	return clean
}

const resolveMapImage = (rawName) => {
	const key = normalizeMapKey(rawName)
	if (!key) return null

	// Maps with ar_ or cs_ prefix
	if (['office', 'italy'].includes(key)) {
		return `/assets/maps/cs_${key}.png`
	}
	if (['baggage', 'pool_day', 'shoots'].includes(key)) {
		return `/assets/maps/ar_${key}.png`
	}
	return `/assets/maps/de_${key}.png`
}

const formatMapDisplayName = (rawName, fallbackIndex) => {
	if (!rawName) return `Map ${fallbackIndex + 1}`
	const key = normalizeMapKey(rawName)
	if (MAP_DISPLAY_NAMES[key]) {
		return MAP_DISPLAY_NAMES[key]
	}
	// Fallback to capitalizing raw string cleanly
	const clean = String(rawName).replace(/^(de_|cs_|ar_)/i, '').replace(/_/g, ' ')
	return clean.charAt(0).toUpperCase() + clean.slice(1)
}

const normalizeSide = (side) => {
	if (!side) return null
	const s = String(side).trim().toUpperCase()
	if (s.startsWith('CT') || s.includes('COUNTER')) return 'CT'
	if (s.startsWith('T') || s.includes('TERROR')) return 'T'
	return null
}

export default {
	props: {
		match: { type: Object, default: null },
	},
	computed: {
		formatClass() {
			const total = this.cards.length
			if (total === 1) return '--bo1'
			if (total === 2) return '--bo2'
			if (total === 5) return '--bo5'
			return '--bo3'
		},
		cards() {
			const m = this.match
			if (!m) return []

			const total = Math.max(Number(m.bestOf) || 3, (m.maps || []).length)
			const currentNormalizedKey = normalizeMapKey(m.currentMap?.name)

			return Array.from({ length: total }, (_, i) => {
				const map = (m.maps || [])[i]
				if (!map) {
					return {
						id: `card-pending-${i + 1}`,
						number: i + 1,
						name: 'TBD',
						image: null,
						placeholder: true,
						current: false,
						homeScore: null,
						awayScore: null,
						winner: null,
						homeStartSide: null,
						awayStartSide: null,
						statusLabel: 'Not decided',
						stateClass: '--pending',
					}
				}

				const hasScore = map.homeScore != null || map.awayScore != null
				const finished = Boolean(map.finished)
				const live = !finished && hasScore
				const mapKey = normalizeMapKey(map.name)
				const current = Boolean(currentNormalizedKey && mapKey && mapKey === currentNormalizedKey)

				// Infer winner defensively if map is finished but winner field was omitted
				let resolvedWinner = null
				if (finished) {
					if (map.winner === 'home' || map.winner === 'away') {
						resolvedWinner = map.winner
					} else if (hasScore && Number(map.homeScore) !== Number(map.awayScore)) {
						resolvedWinner = Number(map.homeScore) > Number(map.awayScore) ? 'home' : 'away'
					}
				}

				let statusLabel = 'Not started'
				let stateClass = '--pending'

				if (finished) {
					const winnerName = resolvedWinner === 'home'
						? (m.home?.name || 'Home')
						: resolvedWinner === 'away'
							? (m.away?.name || 'Away')
							: 'Winner'
					statusLabel = resolvedWinner ? winnerName : 'Finished'
					stateClass = '--finished'
				} else if (live) {
					statusLabel = 'Live'
					stateClass = '--live'
				} else if (current) {
					statusLabel = 'Next up'
					stateClass = '--next'
				}

				let homeSide = normalizeSide(map.homeStartSide)
				let awaySide = normalizeSide(map.awayStartSide)
				if (homeSide && !awaySide) awaySide = (homeSide === 'CT' ? 'T' : 'CT')
				if (awaySide && !homeSide) homeSide = (awaySide === 'CT' ? 'T' : 'CT')

				return {
					id: `card-${map.number || i + 1}-${mapKey || 'tbd'}`,
					number: map.number || i + 1,
					name: formatMapDisplayName(map.name, i),
					image: map.image || resolveMapImage(map.name),
					placeholder: false,
					current,
					homeScore: hasScore ? (map.homeScore ?? 0) : null,
					awayScore: hasScore ? (map.awayScore ?? 0) : null,
					winner: resolvedWinner,
					homeStartSide: homeSide,
					awayStartSide: awaySide,
					statusLabel,
					stateClass,
				}
			})
		},
	},
}

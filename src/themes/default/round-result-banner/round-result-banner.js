import { getTeamLogoPath } from '/hud/helpers/player-resolver.js'
import { buildHudTeamIdentityContext, resolveTeamIdentities } from '/hud/helpers/team-identity-resolver.js'

const REASON_LABELS = {
	'bomb-defused': 'Bomb defused',
	'bomb-exploded': 'Bomb exploded',
	'elimination': 'Elimination',
	'time-expired': 'Time expired',
}

export default {
	props: ['match'],

	data() {
		return {
			visible: false,

			// Deduplication — hard invariant: map + round composite key.
			// Never reset mid-session; a new HUD page load starts fresh automatically.
			seenRoundId: null,

			// Display state
			winningSide: null,   // 'CT' | 'T'
			teamName: null,
			teamLogo: null,
			winReason: null,     // 'bomb-defused' | 'bomb-exploded' | 'elimination' | 'time-expired' | null
			logoFailed: false,

			// Narrative Engine metadata — stored only, no visual effect in Phase 22A.
			// Shape is shared with future ACE / Clutch / Momentum events.
			narrativeType: 'round-win',
			narrativeScore: 0,           // baseline: 0 = normal, 20 = important, 50 = critical
			roundImportance: 'normal',   // 'normal' | 'important' | 'critical'

			_timer: null,
		}
	},

	computed: {
		isEnabled() {
			return !!this.$opts['preferences.roundResultBanner.enabled']
		},

		showReasonEnabled() {
			return this.$opts['preferences.roundResultBanner.showReason'] !== false
		},

		durationMs() {
			return Number(this.$opts['preferences.roundResultBanner.durationMs']) || 3500
		},

		position() {
			return this.$opts['preferences.roundResultBanner.position'] || 'top-center'
		},

		sideClass() {
			return this.winningSide ? `--${this.winningSide.toLowerCase()}` : ''
		},

		positionClass() {
			return `--pos-${this.position}`
		},

		teamLogoSrc() {
			return this.teamLogo || getTeamLogoPath(this.teamName)
		},

		teamTag() {
			return getTeamTag(this.teamName, this.winningSide)
		},

		reasonLabel() {
			return REASON_LABELS[this.winReason] || null
		},
	},

	watch: {
		'$round.phase'(newPhase) {
			if (newPhase !== 'over') return
			if (!this.isEnabled) return

			const currentKey = buildRoundId(this.$map?.name, this.$round.roundNumber)
			if (this.seenRoundId === currentKey) return

			this._show(currentKey)
		},
	},

	beforeUnmount() {
		clearTimeout(this._timer)
	},

	methods: {
		_show(roundKey) {
			// Set deduplication key first — synchronous guard against any re-entry
			this.seenRoundId = roundKey

			this.winningSide = this.$round.winningSide
			const winningIdentity = this._resolveWinningTeamIdentity()
			this.teamName = winningIdentity?.final.name || this.winningSide
			this.teamLogo = winningIdentity?.final.logo || null
			this.winReason = this._deriveWinReason()
			this.roundImportance = this._deriveRoundImportance()
			this.narrativeScore = narrativeScoreFor(this.roundImportance)
			this.logoFailed = false
			this.visible = true

			clearTimeout(this._timer)
			this._timer = setTimeout(() => { this.visible = false }, this.durationMs)
		},

		_resolveWinningTeamIdentity() {
			const side = this.$round.winningSide
			if (!side) return null

			const context = buildHudTeamIdentityContext({
				teams: this.$teams,
				map: this.$map,
				options: this.$opts,
				match: this.match,
			})
			const resolved = resolveTeamIdentities(context)
			return side === 'CT' ? resolved.teams.CT : resolved.teams.T
		},

		_deriveWinReason() {
			const bombState = this.$bomb?.state
			if (bombState === 'defused') return 'bomb-defused'
			if (bombState === 'exploded') return 'bomb-exploded'

			const losingSide = this.$round.winningSide === 'CT' ? 2 : 3
			const anyLoserAlive = (this.$players || []).some(
				p => p.side === losingSide && p.isAlive
			)
			return anyLoserAlive ? 'time-expired' : 'elimination'
		},

		_deriveRoundImportance() {
			const side = this.$round.winningSide
			if (!side) return 'normal'

			// Any overtime round is match-critical
			if (this.$round.isOvertime) return 'critical'

			// Winner reaches match point
			const numericSide = side === 'CT' ? 3 : 2
			const winningTeam = this.$teams?.find(t => t.side === numericSide)
			if ((winningTeam?.score ?? 0) >= this.$round.matchPointAtScore) return 'critical'

			// Economy signals: loser's consecutive loss streak
			// consecutiveRoundLosses = 1 → loser broke a winning streak (eco break)
			// consecutiveRoundLosses >= 3 → extended slide
			const losingSide = side === 'CT' ? 2 : 3
			const losingTeam = this.$teams?.find(t => t.side === losingSide)
			const losses = losingTeam?.consecutiveRoundLosses ?? 0
			if (losses === 1 || losses >= 3) return 'important'

			return 'normal'
		},
	},
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRoundId(mapName, roundNumber) {
	return `${mapName || '_'}:${roundNumber ?? '_'}`
}

function narrativeScoreFor(importance) {
	if (importance === 'critical') return 50
	if (importance === 'important') return 20
	return 0
}

/**
 * Derives a short display tag from a team name, preferring esports-style branding.
 *
 * Priority:
 *   1. First word if it looks like an esports tag (short + mixed-case or numeric)
 *   2. Initials of each word (max 3 chars)
 *   3. First 3 chars of name (single-word fallback)
 *   4. Side label ('CT' / 'T')
 *
 * Examples: FaZe Clan→FAZE  NaVi→NAVI  G2 Esports→G2  6614 Gamers→6614
 *           Team Liquid→TL  Kebab Kings→KK  Astralis→AST
 */
function getTeamTag(teamName, side) {
	const fallback = side || 'CT'
	if (!teamName?.trim()) return fallback

	const words = teamName.trim().split(/\s+/).filter(Boolean)
	if (!words.length) return fallback

	const first = words[0]

	if (words.length === 1) {
		// Single word: use whole word if ≤4 chars, else first 3 chars
		return first.length <= 4
			? first.toUpperCase()
			: first.slice(0, 3).toUpperCase()
	}

	// Multi-word: treat first word as esports tag if short + distinctive
	// "Distinctive" = contains a digit (G2, 6614) or has uppercase after position 0 (FaZe, NaVi)
	const isEsportsTag = first.length <= 4 && (
		/\d/.test(first) ||
		/[A-Z]/.test(first.slice(1))
	)

	if (isEsportsTag) return first.toUpperCase()

	// Fall back to initials (max 3 chars)
	return words.map(w => w[0].toUpperCase()).join('').slice(0, 3)
}

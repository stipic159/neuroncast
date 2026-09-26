// scoreboard.js - a custom broadcast scoreboard overlay, TRIGGERED BY
// eon-director (not the built-in CS2 scoreboard). It is normally hidden; the
// director shows/hides it by sending a `draw:scoreboard` control event over
// eon's WebSocket, which the server relays to every overlay client and
// websocket-on-message.js re-dispatches as the DOM event `socket:draw:scoreboard`.
//
//   body { show: true }   -> show      body { show: false } -> hide
//   body {}               -> toggle    body { show, durationMs } -> auto-hide
//
// Data comes from the same reactive globals every component uses: $players
// (kills/assists/deaths/adr per player, side 2=T / 3=CT) and $teams (name +
// score). No GSI re-ingest, no new server code.

import { buildHudTeamIdentityContext, resolveTeamIdentities } from '/hud/helpers/team-identity-resolver.js'

const sideNum = (side) => {
	if (typeof side === 'number') return side
	if (side === 'CT') return 3
	if (side === 'T') return 2
	return side
}

export default {
	data() {
		return { visible: false, klMatch: null }
	},

	computed: {
		// resolved display names (override -> komplettligaen -> GSI), the SAME
		// source the top bar uses, so the scoreboard matches the broadcast.
		resolvedTeams() {
			const ctx = buildHudTeamIdentityContext({
				teams: this.$teams, map: this.$map, options: this.$opts, match: this.klMatch,
			})
			return resolveTeamIdentities(ctx).teams
		},

		ctTeam() {
			return { name: this.resolvedTeams.CT.final.name, score: this.scoreForSide(3) }
		},

		tTeam() {
			return { name: this.resolvedTeams.T.final.name, score: this.scoreForSide(2) }
		},

		ctPlayers() {
			return this.playersForSide(3)
		},

		tPlayers() {
			return this.playersForSide(2)
		},

		mapName() {
			return this.$map?.formattedName || this.$map?.name || ''
		},

		roundLabel() {
			const round = this.$map?.round
			return Number.isFinite(round) ? `Round ${round + 1}` : ''
		},
	},

	methods: {
		scoreForSide(side) {
			const match = (this.$teams || []).find((team) => sideNum(team.side) === side)
			return match?.score ?? 0
		},

		playersForSide(side) {
			return (this.$players || [])
				.filter((player) => player.side === side)
				.sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths))
		},

		async loadKl() {
			try {
				const res = await fetch('/api/komplettligaen')
				this.klMatch = (await res.json())?.data?.match || null
			} catch { /* no KL data - resolver falls back to overrides/GSI */ }
		},
	},

	watch: {
		// while the scoreboard is up, tag <body> so the theme fades the busy
		// sidebars/focused-player out (the top-bar score stays). CSS does the rest.
		visible(isVisible) {
			document.body.classList.toggle('scoreboard-active', isVisible)
		},
	},

	mounted() {
		this.loadKl()
		this._klTimer = setInterval(() => this.loadKl(), 60000)
		this._onDraw = (event) => {
			const body = event.detail || {}
			// user gate: hide-requests always honoured, show-requests only when enabled
			if (body.show !== false && this.$opts['director.scoreboard.enabled'] === false) return
			this.visible = typeof body.show === 'boolean' ? body.show : ! this.visible

			if (this._hideTimer) {
				clearTimeout(this._hideTimer)
				this._hideTimer = null
			}
			if (this.visible && body.durationMs > 0) {
				this._hideTimer = setTimeout(() => { this.visible = false }, body.durationMs)
			}
		}
		window.addEventListener('socket:draw:scoreboard', this._onDraw)
	},

	beforeUnmount() {
		window.removeEventListener('socket:draw:scoreboard', this._onDraw)
		document.body.classList.remove('scoreboard-active')
		if (this._hideTimer) clearTimeout(this._hideTimer)
		if (this._klTimer) clearInterval(this._klTimer)
	},
}

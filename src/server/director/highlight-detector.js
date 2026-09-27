import { EventEmitter } from 'node:events'

/**
 * Real-time GSI Highlight & Clutch Detector for CS2
 * Pure deterministic game-truth tracking:
 * - Dynamic 1vX Clutch capture and verification on round.phase === 'over'
 * - 4K Quad Kill and 5K ACE detection per round
 * - Pressure Defuse detection (Bomb defused with >=2 Ts alive)
 */
export class HighlightDetector extends EventEmitter {
	constructor() {
		super()
		this.resetState()
	}

	resetState() {
		this.currentRound = -1
		this.roundPhase = null
		this.startingKills = {} // steamid -> kills at start of round
		this.clutchCandidate = null // { player, side, vsCount, round, teamName }
		this.emittedHighlights = new Set() // deduplication key per round
		this.lastDefusedState = false
		this.lastBombState = null
	}

	/**
	 * Main ingress: process each GSI frame from CS2
	 * Returns the first emitted highlight in this frame (if any), or null
	 */
	processFrame(body = {}) {
		if (!body || !body.map) return null

		const roundNumber = Number(body.map.round ?? 0) || 1
		const phase = body.round?.phase || body.phase_countdowns?.phase || null
		const bombState = body.bomb?.state || (body.round?.bomb === 'defused' ? 'defused' : (body.round?.bomb === 'planted' ? 'planted' : null))
		const ctTeamName = body.map.team_ct?.name || 'CT'
		const tTeamName = body.map.team_t?.name || 'T'
		const emittedInThisFrame = []

		// 1. Detect Round Transition / Reset
		if (this.currentRound !== roundNumber || (phase === 'freezetime' && this.roundPhase !== 'freezetime')) {
			this.currentRound = roundNumber
			this.roundPhase = phase
			this.clutchCandidate = null
			this.lastDefusedState = false
			this.lastBombState = bombState
			this.emittedHighlights.clear()

			// Snapshot starting kills for every player at round start
			if (body.allplayers) {
				this.startingKills = {}
				for (const [steamid, p] of Object.entries(body.allplayers)) {
					if (!p) continue
					this.startingKills[steamid] = p.match_stats?.kills ?? 0
				}
			}

			if (phase === 'freezetime' || phase === 'warmup') {
				return null
			}
		}

		const wasLive = this.roundPhase === 'live'
		this.roundPhase = phase

		if (!body.allplayers) return null

		// Compute alive players
		const aliveCT = []
		const aliveT = []

		for (const [steamid, p] of Object.entries(body.allplayers)) {
			if (!p) continue
			const hp = p.state?.health ?? 0
			if (hp > 0) {
				const playerObj = {
					steamid,
					name: p.name || 'Player',
					team: (p.team || 'CT').toUpperCase(),
					observer_slot: p.observer_slot,
				}
				if (playerObj.team === 'CT') aliveCT.push(playerObj)
				else aliveT.push(playerObj)
			}
		}

		// 2. Real-time Clutch Opportunity Snapshot:
		// When team A drops to exactly 1 player alive while team B has >= 2 alive
		if (phase === 'live' || bombState === 'planted' || wasLive) {
			if (aliveCT.length === 1 && aliveT.length >= 2 && !this.clutchCandidate) {
				this.clutchCandidate = {
					player: aliveCT[0],
					side: 'CT',
					teamName: ctTeamName,
					vsCount: aliveT.length,
					round: roundNumber,
				}
			} else if (aliveT.length === 1 && aliveCT.length >= 2 && !this.clutchCandidate) {
				this.clutchCandidate = {
					player: aliveT[0],
					side: 'T',
					teamName: tTeamName,
					vsCount: aliveCT.length,
					round: roundNumber,
				}
			}
		}

		// 3. Pressure Defuse Detection (Bomb defused with >=2 Ts alive)
		if (bombState === 'defused' && !this.lastDefusedState) {
			this.lastDefusedState = true
			if (aliveT.length >= 2) {
				const defuser = aliveCT[0] || { name: 'CT Player', team: 'CT' }
				const hl = this.emitHighlight({
					round: roundNumber,
					type: 'PRESSURE_DEFUSE',
					playerName: defuser.name,
					team: ctTeamName,
					side: 'CT',
					steamid: defuser.steamid,
					vsCount: aliveT.length,
					headline: `${defuser.name} Pressure Defuse`,
					detail: `Defused with ${aliveT.length} Terrorists still alive`,
				})
				if (hl) emittedInThisFrame.push(hl)
			}
		}
		this.lastBombState = bombState

		// 4. Round Over: Evaluate Clutches & Multi-kills
		if (phase === 'over') {
			const winner = body.round?.win_team

			// Check Clutch Win: Did the solo player's team win the round?
			if (this.clutchCandidate && winner === this.clutchCandidate.side) {
				const vs = this.clutchCandidate.vsCount
				const clutchType = `CLUTCH_1V${vs}`
				const hl = this.emitHighlight({
					round: this.clutchCandidate.round,
					type: clutchType,
					playerName: this.clutchCandidate.player.name,
					team: this.clutchCandidate.teamName,
					side: this.clutchCandidate.side,
					steamid: this.clutchCandidate.player.steamid,
					vsCount: vs,
					headline: `${this.clutchCandidate.player.name} 1v${vs} Clutch`,
					detail: `Won round ${roundNumber} in a 1v${vs} clutch`,
				})
				if (hl) emittedInThisFrame.push(hl)
			}

			// Check Multi-kills (4K and ACE)
			for (const [steamid, p] of Object.entries(body.allplayers)) {
				if (!p) continue
				const stateKills = p.state?.round_kills
				let roundKills = 0
				if (typeof stateKills === 'number' && stateKills > 0) {
					roundKills = stateKills
				} else {
					const currentKills = p.match_stats?.kills ?? 0
					const startKills = this.startingKills[steamid] ?? currentKills
					roundKills = Math.max(0, currentKills - startKills)
				}

				const pTeamName = (p.team || '').toUpperCase() === 'CT' ? ctTeamName : tTeamName

				if (roundKills >= 5) {
					const hl = this.emitHighlight({
						round: roundNumber,
						type: 'ACE_5K',
						playerName: p.name,
						team: pTeamName,
						side: p.team,
						steamid,
						kills: roundKills,
						headline: `${p.name} 5K ACE`,
						detail: `Eliminated all 5 opponents in round ${roundNumber}`,
					})
					if (hl) emittedInThisFrame.push(hl)
				} else if (roundKills === 4) {
					const hl = this.emitHighlight({
						round: roundNumber,
						type: 'QUAD_4K',
						playerName: p.name,
						team: pTeamName,
						side: p.team,
						steamid,
						kills: roundKills,
						headline: `${p.name} 4K Quad Kill`,
						detail: `Secured 4 kills in round ${roundNumber}`,
					})
					if (hl) emittedInThisFrame.push(hl)
				}
			}
		}

		return emittedInThisFrame.length > 0 ? emittedInThisFrame[0] : null
	}

	emitHighlight(data) {
		const dedupKey = `${data.round}_${data.type}_${data.steamid || data.playerName}`
		if (this.emittedHighlights.has(dedupKey)) return null
		this.emittedHighlights.add(dedupKey)

		const nowSec = Math.floor(Date.now() / 1000)
		const highlight = {
			id: `rep_${nowSec}_r${data.round}`,
			timestamp: nowSec,
			timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
			...data,
		}

		this.emit('highlight', highlight)
		return highlight
	}
}

export const highlightDetector = new HighlightDetector()

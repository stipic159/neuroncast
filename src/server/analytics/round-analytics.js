import path from 'node:path'
import { promises as fsPromises, existsSync, mkdirSync } from 'node:fs'
import { additionalState, gsiState } from '../state.js'
import { logRound } from '../helpers/logger.js'

const HIGHLIGHT_LOG_DIR = path.join(process.cwd(), 'logs')
const HIGHLIGHT_LOG_PATH = path.join(HIGHLIGHT_LOG_DIR, 'highlights.txt')

// Ensure log directory exists asynchronously/safely
try {
	if (!existsSync(HIGHLIGHT_LOG_DIR)) {
		mkdirSync(HIGHLIGHT_LOG_DIR, { recursive: true })
	}
} catch (_) {}

/**
 * Logs round highlight asynchronously
 */
export const logHighlight = async (roundNum, clutchMetric, mvpName) => {
	const logLine = `[${new Date().toISOString()}] Round ${roundNum} | Huge Swing: ${clutchMetric} | Clutch King: ${mvpName}\n`
	try {
		await fsPromises.appendFile(HIGHLIGHT_LOG_PATH, logLine, 'utf8')
	} catch (err) {
		console.error('[RoundAnalytics] Failed to write highlight log:', err.message)
	}
}

/**
 * Resets per-match analytics state on map change or session restart
 */
export const resetVolatileMatchState = () => {
	additionalState.roundDamages = {}
	additionalState.moneyAtStartOfRound = {}
	additionalState.currentRoundProb = 0.5
	additionalState.probHistory = []
	additionalState.maxProbSwing = 0
	additionalState.roundKillStats = {}
	additionalState.lastKnownBombPlantedCountdown = {}
	additionalState.mvpDisplay = null
}

/**
 * Processes players telemetry, damages and live win probability
 */
export const processPlayerAnalytics = (body, wasRoundFreezetime) => {
	if (!body.allplayers) return

	const isFreezetime = body.round?.phase === 'freezetime'
	const isLive = body.round?.phase === 'live' || body.map?.phase === 'live' || body.bomb?.state === 'planted'
	const roundNumber = body.map?.round !== undefined 
		? (body.map.round + 1 - Number(body.phase_countdowns?.phase === 'over'))
		: null

	if (isFreezetime && !wasRoundFreezetime) {
		additionalState.moneyAtStartOfRound = {}
	}

	let ctPlayers = 0, tPlayers = 0
	let ctHp = 0, tHp = 0

	for (const [steam64Id, player] of Object.entries(body.allplayers)) {
		if (!player) continue

		// A. Observer Slot
		if (player.observer_slot !== null && player.observer_slot !== undefined) {
			additionalState.lastKnownPlayerObserverSlot[steam64Id] = player.observer_slot
		}

		// B. Money at start
		if (
			isFreezetime
			&& player.state
			&& additionalState.moneyAtStartOfRound[steam64Id] === undefined
		) {
			additionalState.moneyAtStartOfRound[steam64Id] = player.state.money ?? 0
		}

		// C. Round Damages
		if (roundNumber !== null && !Number.isNaN(roundNumber)) {
			if (!additionalState.roundDamages[steam64Id]) {
				additionalState.roundDamages[steam64Id] = {}
			}
			const roundDmg = player.state?.round_totaldmg ?? 0
			if (roundDmg !== 0 || !Object.hasOwn(additionalState.roundDamages[steam64Id], roundNumber)) {
				additionalState.roundDamages[steam64Id][roundNumber] = roundDmg
			}
		}

		// D. Win Prob Accumulators
		if (isLive && player.state && player.state.health > 0) {
			if (player.team === 'CT') {
				ctPlayers++
				ctHp += player.state.health
			} else if (player.team === 'T') {
				tPlayers++
				tHp += player.state.health
			}
		}
	}

	// Finalize Win Probability
	if (isLive && (ctPlayers + tPlayers > 0)) {
		const totalPlayers = ctPlayers + tPlayers
		const playerWeight = ctPlayers / totalPlayers
		const hpRatio = (ctHp + tHp) > 0 ? ctHp / (ctHp + tHp) : 0.5
		let prob = (playerWeight * 0.5) + (hpRatio * 0.5)

		if (body.bomb?.state === 'planted') {
			const countdown = body.bomb.countdown || 40
			const bombFactor = Math.pow(countdown / 40, 2)
			prob = prob * bombFactor
		}

		additionalState.currentRoundProb = prob
		const lastProb = additionalState.probHistory[additionalState.probHistory.length - 1]
		if (lastProb === undefined || Math.abs(prob - lastProb) > 0.01) {
			additionalState.probHistory.push(prob)
		}
	}
}

/**
 * Handles round over swing analysis and logging
 */
export const handleRoundEnd = (body) => {
	const winner = body.round?.win_team
	const roundNum = body.map?.round || 0
	const finalProb = winner === 'CT' ? 1.0 : 0.0

	let lowestProb = 0.5
	let highestProb = 0.5
	if (additionalState.probHistory.length > 0) {
		lowestProb = additionalState.probHistory[0]
		highestProb = additionalState.probHistory[0]
		for (let i = 1; i < additionalState.probHistory.length; i++) {
			const p = additionalState.probHistory[i]
			if (p < lowestProb) lowestProb = p
			if (p > highestProb) highestProb = p
		}
	}

	if (winner === 'CT') {
		additionalState.maxProbSwing = finalProb - lowestProb
	} else {
		additionalState.maxProbSwing = highestProb - finalProb
	}

	const mvpName = body.player?.name || 'Unknown'
	const clutchMetric = (additionalState.maxProbSwing * 100).toFixed(1) + '%'

	if (additionalState.maxProbSwing > 0.6) {
		logHighlight(roundNum, clutchMetric, mvpName)
	}

	logRound({
		round_num: roundNum,
		winner,
		mvp_player_name: mvpName,
		clutch_metric: clutchMetric,
		final_stats: body.allplayers || {}
	})
}

/**
 * Broadcasts MVP card to connected WebSockets
 */
export const broadcastMvp = (websocket) => {
	let mvpId = null
	let maxScore = -1

	for (const [id, damages] of Object.entries(additionalState.roundDamages)) {
		const roundNums = Object.keys(damages).map(Number).filter(n => !Number.isNaN(n))
		if (!roundNums.length) continue
		const roundNum = Math.max(...roundNums)
		const dmg = damages[roundNum] || 0
		if (dmg > maxScore) {
			maxScore = dmg
			mvpId = id
		}
	}

	if (mvpId && gsiState.allplayers?.[mvpId]) {
		const player = gsiState.allplayers[mvpId]
		websocket.broadcastToWebsockets('MVP_DISPLAY', {
			name: player.name,
			title: additionalState.maxProbSwing > 0.4 ? 'Clutch King' : 'Top Performer',
			swingPct: (additionalState.maxProbSwing * 100).toFixed(0),
			kills: player.match_stats?.kills || 0
		})
	}
}

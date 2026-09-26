import { gsiState, options } from '/hud/core/state.js'

const getWinningSide = () => {
	switch (gsiState.round?.win_team) {
		case 'T': return 'T'
		case 'CT': return 'CT'
		default: return undefined
	}
}

export const parseRound = () => {
	const maxrounds = Number(options?.['cvars.mp_maxrounds'] || 24)
	const overtimeMaxrounds = Number(options?.['cvars.mp_overtime_maxrounds'] || 6)
	const phase = gsiState.phase_countdowns?.phase || gsiState.round?.phase
	const phaseEndsInSec = getPhaseEndsInSec(phase)
	const roundNumber = (gsiState.map?.round || 0) + 1 - Number(phase === 'over')
	const isOvertime = roundNumber > maxrounds

	const roundsInOvertimes = isOvertime ? roundNumber - maxrounds : 0
	const overtimeNumber = isOvertime ? Math.floor((roundsInOvertimes - 1) / Math.max(1, overtimeMaxrounds)) + 1 : 0
	const matchPointAtScore = isOvertime ? (maxrounds / 2) + (overtimeMaxrounds / 2) + (overtimeNumber - 1) * (overtimeMaxrounds / 2) : Math.floor(maxrounds / 2)

	return {
		isOvertime,
		matchPointAtScore,
		overtimeNumber,
		roundNumber,

		isFreezetime: gsiState.round?.phase === 'freezetime',
		phase,
		phaseEndsInSec,
		roundNumberInCurrentOvertime: isOvertime ? roundNumber - maxrounds - (overtimeNumber - 1) * overtimeMaxrounds - Number(phase === 'over') : 0,
		winningSide: getWinningSide(),
	}
}

const getPhaseEndsInSec = (phase) => {
	const liveCountdown = Number(gsiState.phase_countdowns?.phase_ends_in)
	if (Number.isFinite(liveCountdown)) return liveCountdown

	switch (phase) {
		case 'freezetime':
			return Number(options?.['cvars.mp_freezetime'] || 20)
		case 'live':
			return Number(options?.['cvars.mp_roundtime'] || 1.92) * 60
		case 'timeout_ct':
		case 'timeout_t':
			return Number(options?.['cvars.mp_team_timeout_time'] || 30)
		case 'bomb':
			return Number(options?.['cvars.mp_c4timer'] || 40)
		default:
			return 0
	}
}

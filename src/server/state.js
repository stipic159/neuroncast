import { readFileSync } from 'fs'
import { builtinRootDirectory } from './helpers/paths.js'
import { getDevAdditionalState, getDevGsiState } from './dev-gsi-state.js'
import { isUiDevMode } from './dev-mode.js'

const getInitialState = () => {
	if (isUiDevMode) return getDevGsiState()

	try {
		const state = readFileSync(`${builtinRootDirectory}/src/server/example-state.json`, 'utf-8')
		return JSON.parse(state)
	} catch {
		return {}
	}
}

export const gsiState = getInitialState()

export const additionalState = {
	gsiActive: isUiDevMode,
	lastKnownBombPlantedCountdown: {},
	lastKnownMapName: null,
	lastKnownPlayerObserverSlot: {},
	moneyAtStartOfRound: {},
	roundDamages: {},
	// Clutch & MVP Engine
	currentRoundProb: 0.5,
	probHistory: [],
	maxProbSwing: 0,
	roundKillStats: {},
	mvpDisplay: null,
	...(isUiDevMode ? getDevAdditionalState() : {}),
}

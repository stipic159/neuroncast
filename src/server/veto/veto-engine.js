/**
 * Deterministic State Machine Engine for Map Veto sessions.
 * Supports BO1, BO3, BO5 formats, imported FACEIT vetos, manual stepping, undo, and timer control.
 */

import { generateVetoSchedule } from './schedules.js'
import { CS2_ACTIVE_MAP_POOL, normalizeMapId } from '../integrations/faceit/faceit-parser.js'

export class VetoEngine {
	constructor(options = {}) {
		this.options = {
			defaultTimerDuration: 30,
			knifeRoundDecider: true,
			...options,
		}

		this.state = this._createInitialState()
		this.timerInterval = null
		this.onStateChangeCallbacks = new Set()
	}

	_createInitialState() {
		return {
			matchId: null,
			format: 'bo3',
			phase: 'NOT_STARTED', // 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
			source: 'manual', // 'manual' | 'faceit_auto'
			knifeRoundDecider: this.options.knifeRoundDecider !== false,
			activeMapPool: [...CS2_ACTIVE_MAP_POOL],
			mapsStatus: {},
			currentStepIndex: 0,
			totalSteps: 0,
			currentActorTeam: null,
			currentActionType: null,
			targetMapId: null,
			schedule: [],
			actionHistory: [],
			timer: {
				enabled: true,
				durationSeconds: this.options.defaultTimerDuration,
				secondsLeft: this.options.defaultTimerDuration,
				isRunning: false,
			},
		}
	}

	onStateChange(cb) {
		this.onStateChangeCallbacks.add(cb)
		return () => this.onStateChangeCallbacks.delete(cb)
	}

	_emitChange() {
		const snapshot = this.getState()
		for (const cb of this.onStateChangeCallbacks) {
			try { cb(snapshot) } catch (err) { console.error('[VetoEngine Callback Error]', err) }
		}
	}

	getState() {
		return JSON.parse(JSON.stringify(this.state))
	}

	/**
	 * Initializes a brand new veto session.
	 */
	initSession(config = {}) {
		this.stopTimer()

		const format = ['bo1', 'bo3', 'bo5'].includes(config.format) ? config.format : 'bo3'
		const knifeRoundDecider = config.knifeRoundDecider !== undefined ? !!config.knifeRoundDecider : this.options.knifeRoundDecider
		const firstTeam = config.firstTeam === 'team2' ? 'team2' : 'team1'
		const mapPool = Array.isArray(config.mapPool) && config.mapPool.length >= 7
			? config.mapPool.map(normalizeMapId)
			: [...CS2_ACTIVE_MAP_POOL]

		const schedule = generateVetoSchedule(format, {
			knifeRoundDecider,
			firstTeam,
			mapPool,
		})

		const mapsStatus = {}
		mapPool.forEach(mapId => {
			mapsStatus[mapId] = {
				mapId,
				status: 'AVAILABLE',
			}
		})

		const initialStep = schedule[0] || null

		this.state = {
			matchId: config.matchId || `veto_${Date.now()}`,
			format,
			phase: 'IN_PROGRESS',
			source: 'manual',
			knifeRoundDecider,
			activeMapPool: mapPool,
			mapsStatus,
			currentStepIndex: 0,
			totalSteps: schedule.length,
			currentActorTeam: initialStep?.team || null,
			currentActionType: initialStep?.action || null,
			targetMapId: null,
			schedule,
			actionHistory: [],
			timer: {
				enabled: config.timerEnabled !== false,
				durationSeconds: Number(config.timerDuration) || this.options.defaultTimerDuration,
				secondsLeft: Number(config.timerDuration) || this.options.defaultTimerDuration,
				isRunning: config.autoStartTimer === true,
			},
		}

		if (this.state.timer.isRunning) {
			this.startTimer()
		}

		this._emitChange()
		return this.getState()
	}

	/**
	 * Imports pre-completed veto data (e.g. from FACEIT voting.map).
	 */
	importVeto(vetoData, matchConfig = {}) {
		this.stopTimer()

		const format = matchConfig.format || 'bo3'
		const pool = vetoData.activeMapPool || matchConfig.activeMapPool || CS2_ACTIVE_MAP_POOL
		const mapsStatus = {}

		pool.forEach(mapId => {
			mapsStatus[mapId] = {
				mapId,
				status: 'AVAILABLE',
			}
		})

		if (vetoData.mapsStatus) {
			Object.assign(mapsStatus, vetoData.mapsStatus)
		}

		this.state = {
			matchId: matchConfig.id || `faceit_${Date.now()}`,
			format,
			phase: 'COMPLETED',
			source: 'faceit_auto',
			knifeRoundDecider: true,
			activeMapPool: pool,
			mapsStatus,
			currentStepIndex: vetoData.actionHistory?.length || 0,
			totalSteps: vetoData.actionHistory?.length || 0,
			currentActorTeam: null,
			currentActionType: null,
			targetMapId: null,
			schedule: [],
			actionHistory: vetoData.actionHistory || [],
			timer: {
				enabled: false,
				durationSeconds: 30,
				secondsLeft: 0,
				isRunning: false,
			},
		}

		this._emitChange()
		return this.getState()
	}

	/**
	 * Executes a user action from Mobile Remote or operator.
	 *
	 * @param {Object} action
	 * @param {'BAN'|'PICK'|'SIDE_PICK'} action.type
	 * @param {string} [action.mapId]
	 * @param {'CT'|'TERRORIST'} [action.pickedSide]
	 * @param {'team1'|'team2'} [action.team]
	 */
	executeAction(action = {}) {
		if (this.state.phase !== 'IN_PROGRESS') {
			throw new Error(`Cannot execute action: Veto session is in ${this.state.phase} phase`)
		}

		const currentStep = this.state.schedule[this.state.currentStepIndex]
		if (!currentStep) {
			throw new Error('No current step available in veto schedule')
		}

		// Validation: Action type match
		if (action.type && action.type !== currentStep.action) {
			throw new Error(`Invalid action type: Expected ${currentStep.action}, received ${action.type}`)
		}

		// Action: BAN or PICK
		if (currentStep.action === 'BAN' || currentStep.action === 'PICK') {
			const mapId = normalizeMapId(action.mapId)
			const mapEntry = this.state.mapsStatus[mapId]

			if (!mapEntry) {
				throw new Error(`Map "${mapId}" is not in the active map pool`)
			}
			if (mapEntry.status !== 'AVAILABLE') {
				throw new Error(`Map "${mapId}" is already ${mapEntry.status}`)
			}

			const team = currentStep.team
			const orderIndex = this.state.actionHistory.length + 1

			mapEntry.status = currentStep.action === 'BAN' ? 'BANNED' : 'PICKED'
			mapEntry.actionTeam = team
			mapEntry.orderIndex = orderIndex

			this.state.actionHistory.push({
				stepIndex: this.state.currentStepIndex,
				type: currentStep.action,
				team,
				mapId,
				orderIndex,
				timestamp: Date.now(),
			})
		}

		// Action: SIDE_PICK
		else if (currentStep.action === 'SIDE_PICK') {
			const pickedSide = (action.pickedSide || '').toUpperCase()
			if (pickedSide !== 'CT' && pickedSide !== 'TERRORIST') {
				throw new Error(`Invalid side: Expected "CT" or "TERRORIST", received "${pickedSide}"`)
			}

			// Identify target map
			const targetStepDef = currentStep.targetMapStep !== undefined ? this.state.schedule[currentStep.targetMapStep] : null
			const priorPickAction = targetStepDef
				? this.state.actionHistory.find(h => h.stepIndex === targetStepDef.stepIndex)
				: [...this.state.actionHistory].reverse().find(h => h.type === 'PICK' || h.type === 'DECIDER')

			if (!priorPickAction) {
				throw new Error('Cannot find target map for side selection')
			}

			const targetMapId = priorPickAction.mapId
			const mapEntry = this.state.mapsStatus[targetMapId]
			if (mapEntry) {
				mapEntry.pickedSide = pickedSide
				mapEntry.sidePickingTeam = currentStep.team
			}

			this.state.actionHistory.push({
				stepIndex: this.state.currentStepIndex,
				type: 'SIDE_PICK',
				team: currentStep.team,
				mapId: targetMapId,
				pickedSide,
				timestamp: Date.now(),
			})
		}

		// Advance state to next step
		this._advanceStep()
		this._resetStepTimer()
		this._emitChange()

		return this.getState()
	}

	_advanceStep() {
		this.state.currentStepIndex++

		// Check if we hit a DECIDER auto-step
		const nextStep = this.state.schedule[this.state.currentStepIndex]
		if (nextStep && nextStep.action === 'DECIDER') {
			// Find the single remaining AVAILABLE map
			const remainingMapIds = Object.keys(this.state.mapsStatus).filter(
				id => this.state.mapsStatus[id].status === 'AVAILABLE'
			)

			if (remainingMapIds.length === 1) {
				const deciderMapId = remainingMapIds[0]
				const orderIndex = this.state.actionHistory.length + 1
				this.state.mapsStatus[deciderMapId].status = 'DECIDER'
				this.state.mapsStatus[deciderMapId].orderIndex = orderIndex

				this.state.actionHistory.push({
					stepIndex: this.state.currentStepIndex,
					type: 'DECIDER',
					team: nextStep.team,
					mapId: deciderMapId,
					orderIndex,
					timestamp: Date.now(),
				})

				// Advance past the DECIDER step to whatever is next (or end)
				this.state.currentStepIndex++
			}
		}

		// Check completion
		if (this.state.currentStepIndex >= this.state.schedule.length) {
			this.state.phase = 'COMPLETED'
			this.state.currentActorTeam = null
			this.state.currentActionType = null
			this.state.targetMapId = null
			this.stopTimer()
			return
		}

		const activeStep = this.state.schedule[this.state.currentStepIndex]
		this.state.currentActorTeam = activeStep.team
		this.state.currentActionType = activeStep.action

		if (activeStep.action === 'SIDE_PICK') {
			const targetStepDef = activeStep.targetMapStep !== undefined ? this.state.schedule[activeStep.targetMapStep] : null
			const prior = targetStepDef
				? this.state.actionHistory.find(h => h.stepIndex === targetStepDef.stepIndex)
				: [...this.state.actionHistory].reverse().find(h => h.type === 'PICK' || h.type === 'DECIDER')
			this.state.targetMapId = prior?.mapId || null
		} else {
			this.state.targetMapId = null
		}
	}

	/**
	 * Undoes the last action taken in the veto session.
	 */
	undoLastAction() {
		if (this.state.actionHistory.length === 0) {
			return this.getState()
		}

		// Pop last action
		const lastAction = this.state.actionHistory.pop()

		// If the action before was an auto DECIDER, pop that too
		let deciderPopped = null
		if (lastAction.type !== 'DECIDER' && this.state.actionHistory.length > 0) {
			const prev = this.state.actionHistory[this.state.actionHistory.length - 1]
			if (prev.type === 'DECIDER') {
				deciderPopped = this.state.actionHistory.pop()
			}
		}

		// Revert mapsStatus
		const revertAction = (act) => {
			if (!act) return
			const entry = this.state.mapsStatus[act.mapId]
			if (!entry) return

			if (act.type === 'BAN' || act.type === 'PICK' || act.type === 'DECIDER') {
				entry.status = 'AVAILABLE'
				delete entry.actionTeam
				delete entry.orderIndex
				delete entry.pickedSide
				delete entry.sidePickingTeam
			} else if (act.type === 'SIDE_PICK') {
				delete entry.pickedSide
				delete entry.sidePickingTeam
			}
		}

		revertAction(lastAction)
		if (deciderPopped) revertAction(deciderPopped)

		// Rewind currentStepIndex to the step of the earliest undone action
		const targetStepIndex = deciderPopped ? deciderPopped.stepIndex : lastAction.stepIndex
		this.state.currentStepIndex = targetStepIndex
		this.state.phase = 'IN_PROGRESS'

		const activeStep = this.state.schedule[this.state.currentStepIndex]
		this.state.currentActorTeam = activeStep?.team || null
		this.state.currentActionType = activeStep?.action || null

		if (activeStep?.action === 'SIDE_PICK') {
			const targetStepDef = activeStep.targetMapStep !== undefined ? this.state.schedule[activeStep.targetMapStep] : null
			const prior = targetStepDef
				? this.state.actionHistory.find(h => h.stepIndex === targetStepDef.stepIndex)
				: [...this.state.actionHistory].reverse().find(h => h.type === 'PICK' || h.type === 'DECIDER')
			this.state.targetMapId = prior?.mapId || null
		} else {
			this.state.targetMapId = null
		}

		this._resetStepTimer()
		this._emitChange()
		return this.getState()
	}

	/**
	 * Resets the veto session back to initial unstarted state.
	 */
	reset() {
		this.stopTimer()
		this.state = this._createInitialState()
		this._emitChange()
		return this.getState()
	}

	// ================= Timer Controls =================

	startTimer() {
		if (this.timerInterval) return
		this.state.timer.isRunning = true

		this.timerInterval = setInterval(() => {
			if (this.state.timer.secondsLeft > 0) {
				this.state.timer.secondsLeft--
				// Emit timer tick every 5 seconds or when reaching critical countdown (<= 10)
				if (this.state.timer.secondsLeft <= 10 || this.state.timer.secondsLeft % 5 === 0) {
					this._emitChange()
				}
			} else {
				this.stopTimer()
				this._emitChange()
			}
		}, 1000)

		if (this.timerInterval.unref) {
			this.timerInterval.unref()
		}
	}

	pauseTimer() {
		this.stopTimer()
		this.state.timer.isRunning = false
		this._emitChange()
	}

	stopTimer() {
		if (this.timerInterval) {
			clearInterval(this.timerInterval)
			this.timerInterval = null
		}
		this.state.timer.isRunning = false
	}

	addTimerSeconds(sec = 30) {
		this.state.timer.secondsLeft += Number(sec) || 30
		this._emitChange()
	}

	_resetStepTimer() {
		this.state.timer.secondsLeft = this.state.timer.durationSeconds
	}
}

export const vetoEngine = new VetoEngine()

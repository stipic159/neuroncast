import test from 'node:test'
import assert from 'node:assert/strict'
import { VetoEngine } from '../../src/server/veto/veto-engine.js'
import { generateVetoSchedule } from '../../src/server/veto/schedules.js'

test('Veto Schedule: BO1 generation with knife round vs side pick', () => {
	const bo1Knife = generateVetoSchedule('bo1', { knifeRoundDecider: true })
	// 6 bans + 1 decider = 7 steps
	assert.equal(bo1Knife.length, 7)
	assert.equal(bo1Knife[0].action, 'BAN')
	assert.equal(bo1Knife[0].team, 'team1')
	assert.equal(bo1Knife[5].action, 'BAN')
	assert.equal(bo1Knife[5].team, 'team2')
	assert.equal(bo1Knife[6].action, 'DECIDER')

	const bo1ManualSide = generateVetoSchedule('bo1', { knifeRoundDecider: false })
	// 6 bans + 1 decider + 1 side pick = 8 steps
	assert.equal(bo1ManualSide.length, 8)
	assert.equal(bo1ManualSide[7].action, 'SIDE_PICK')
	assert.equal(bo1ManualSide[7].team, 'team1', 'Team 1 should pick side because Team 2 banned the last map')
})

test('Veto Schedule: BO3 generation', () => {
	const bo3 = generateVetoSchedule('bo3', { knifeRoundDecider: true })
	// Step 0: T1 Ban, Step 1: T2 Ban
	// Step 2: T1 Pick M1, Step 3: T2 Side M1
	// Step 4: T2 Pick M2, Step 5: T1 Side M2
	// Step 6: T1 Ban, Step 7: T2 Ban
	// Step 8: Decider
	assert.equal(bo3.length, 9)
	assert.equal(bo3[2].action, 'PICK')
	assert.equal(bo3[2].team, 'team1')
	assert.equal(bo3[3].action, 'SIDE_PICK')
	assert.equal(bo3[3].team, 'team2')
	assert.equal(bo3[8].action, 'DECIDER')
})

test('Veto Engine: Full BO3 lifecycle execution & completion', () => {
	const engine = new VetoEngine()
	engine.initSession({
		format: 'bo3',
		knifeRoundDecider: true,
		timerDuration: 30,
	})

	const s0 = engine.getState()
	assert.equal(s0.phase, 'IN_PROGRESS')
	assert.equal(s0.currentActorTeam, 'team1')
	assert.equal(s0.currentActionType, 'BAN')

	// 1. Team 1 bans vertigo
	engine.executeAction({ type: 'BAN', mapId: 'de_vertigo' })
	assert.equal(engine.getState().mapsStatus['de_vertigo'].status, 'BANNED')
	assert.equal(engine.getState().currentActorTeam, 'team2')
	assert.equal(engine.getState().currentActionType, 'BAN')

	// 2. Team 2 bans anubis
	engine.executeAction({ type: 'BAN', mapId: 'de_anubis' })
	assert.equal(engine.getState().mapsStatus['de_anubis'].status, 'BANNED')

	// 3. Team 1 picks mirage
	engine.executeAction({ type: 'PICK', mapId: 'de_mirage' })
	assert.equal(engine.getState().mapsStatus['de_mirage'].status, 'PICKED')
	assert.equal(engine.getState().currentActorTeam, 'team2')
	assert.equal(engine.getState().currentActionType, 'SIDE_PICK')
	assert.equal(engine.getState().targetMapId, 'de_mirage')

	// 4. Team 2 picks CT on mirage
	engine.executeAction({ type: 'SIDE_PICK', pickedSide: 'CT' })
	assert.equal(engine.getState().mapsStatus['de_mirage'].pickedSide, 'CT')
	assert.equal(engine.getState().mapsStatus['de_mirage'].sidePickingTeam, 'team2')

	// 5. Team 2 picks inferno
	engine.executeAction({ type: 'PICK', mapId: 'de_inferno' })
	assert.equal(engine.getState().mapsStatus['de_inferno'].status, 'PICKED')

	// 6. Team 1 picks T on inferno
	engine.executeAction({ type: 'SIDE_PICK', pickedSide: 'TERRORIST' })
	assert.equal(engine.getState().mapsStatus['de_inferno'].pickedSide, 'TERRORIST')

	// 7. Team 1 bans ancient
	engine.executeAction({ type: 'BAN', mapId: 'de_ancient' })

	// 8. Team 2 bans dust2 -> triggers auto DECIDER on remaining nuke and completes!
	engine.executeAction({ type: 'BAN', mapId: 'de_dust2' })

	const finalState = engine.getState()
	assert.equal(finalState.phase, 'COMPLETED')
	assert.equal(finalState.mapsStatus['de_nuke'].status, 'DECIDER')
	assert.equal(finalState.actionHistory.length, 9)
})

test('Veto Engine: Undo functionality reverts map state and rewinds step', () => {
	const engine = new VetoEngine()
	engine.initSession({ format: 'bo3', knifeRoundDecider: true })

	engine.executeAction({ type: 'BAN', mapId: 'de_mirage' })
	assert.equal(engine.getState().mapsStatus['de_mirage'].status, 'BANNED')
	assert.equal(engine.getState().currentStepIndex, 1)

	// Undo action
	engine.undoLastAction()
	const stateAfterUndo = engine.getState()
	assert.equal(stateAfterUndo.mapsStatus['de_mirage'].status, 'AVAILABLE')
	assert.equal(stateAfterUndo.currentStepIndex, 0)
	assert.equal(stateAfterUndo.actionHistory.length, 0)
})

test('Veto Engine: Rejection of invalid actions', () => {
	const engine = new VetoEngine()
	engine.initSession({ format: 'bo3' })

	// Cannot pick during BAN step
	assert.throws(() => {
		engine.executeAction({ type: 'PICK', mapId: 'de_mirage' })
	}, /Invalid action type/)

	// Ban mirage
	engine.executeAction({ type: 'BAN', mapId: 'de_mirage' })

	// Cannot ban mirage again
	assert.throws(() => {
		engine.executeAction({ type: 'BAN', mapId: 'de_mirage' })
	}, /already BANNED/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { HighlightDetector } from '../../src/server/director/highlight-detector.js'
import { AutoReplayService } from '../../src/server/director/auto-replay-service.js'

test('HighlightDetector: 1vX Clutch Detection with dynamic state capture', () => {
	const detector = new HighlightDetector()

	// 1. Initial live round setup: 5 CT vs 5 T
	const frame1 = {
		map: { round: 14, phase: 'live', team_ct: { name: 'G2' }, team_t: { name: 'NaVi' } },
		round: { phase: 'live' },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 100, round_kills: 0 }, name: 'm0NESY' },
			'76561198000000002': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'NiKo' },
			'76561198000000003': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'huNter-' },
			'76561198000000004': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'nexa' },
			'76561198000000005': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'HooXi' },
			'76561198000000006': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'b1t' },
			'76561198000000007': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'iM' },
			'76561198000000008': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'jL' },
			'76561198000000009': { team: 'T', state: { health: 0, round_kills: 0 }, name: 'w0nderful' },
			'76561198000000010': { team: 'T', state: { health: 0, round_kills: 0 }, name: 'Aleksib' },
		},
	}

	// Process mid-round snapshot (1 CT alive vs 3 T alive)
	const midResult = detector.processFrame(frame1)
	assert.equal(midResult, null, 'No highlight emitted mid-round')

	// 2. Round ends with CT victory (m0NESY won 1v3)
	const frameOverWon = {
		map: { round: 14, phase: 'live', team_ct: { name: 'G2' }, team_t: { name: 'NaVi' } },
		round: { phase: 'over', win_team: 'CT' },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 45, round_kills: 3 }, name: 'm0NESY' },
			'76561198000000006': { team: 'T', state: { health: 0, round_kills: 0 }, name: 'b1t' },
			'76561198000000007': { team: 'T', state: { health: 0, round_kills: 0 }, name: 'iM' },
			'76561198000000008': { team: 'T', state: { health: 0, round_kills: 0 }, name: 'jL' },
		},
	}

	const wonResult = detector.processFrame(frameOverWon)
	assert.ok(wonResult, 'Highlight must be emitted for 1v3 clutch win')
	assert.equal(wonResult.type, 'CLUTCH_1V3')
	assert.equal(wonResult.playerName, 'm0NESY')
	assert.equal(wonResult.team, 'G2')
	assert.equal(wonResult.vsCount, 3)
	assert.equal(wonResult.round, 14)
	assert.match(wonResult.id, /^rep_\d+_r14$/)
})

test('HighlightDetector: Failed clutch does NOT emit highlight', () => {
	const detector = new HighlightDetector()

	const frame1 = {
		map: { round: 5, phase: 'live', team_ct: { name: 'FaZe' }, team_t: { name: 'Spirit' } },
		round: { phase: 'live' },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 100, round_kills: 0 }, name: 'broky' },
			'76561198000000002': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'rain' },
			'76561198000000006': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'donk' },
			'76561198000000007': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'sh1ro' },
		},
	}

	detector.processFrame(frame1) // 1 CT vs 2 T snapshot captured

	// Round ends with T winning (broky died, lost the clutch)
	const frameOverLost = {
		map: { round: 5, phase: 'live', team_ct: { name: 'FaZe' }, team_t: { name: 'Spirit' } },
		round: { phase: 'over', win_team: 'T' },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 0, round_kills: 0 }, name: 'broky' },
			'76561198000000006': { team: 'T', state: { health: 80, round_kills: 1 }, name: 'donk' },
			'76561198000000007': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'sh1ro' },
		},
	}

	const lostResult = detector.processFrame(frameOverLost)
	assert.equal(lostResult, null, 'Failed clutch must NOT emit highlight')
})

test('HighlightDetector: 5K ACE Detection', () => {
	const detector = new HighlightDetector()

	const frameOver = {
		map: { round: 8, phase: 'live', team_ct: { name: 'Vitality' }, team_t: { name: 'MOUZ' } },
		round: { phase: 'over', win_team: 'CT' },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 90, round_kills: 5 }, name: 'ZywOo' },
			'76561198000000002': { team: 'CT', state: { health: 100, round_kills: 0 }, name: 'apEX' },
			'76561198000000003': { team: 'CT', state: { health: 100, round_kills: 0 }, name: 'Spinx' },
		},
	}

	const aceResult = detector.processFrame(frameOver)
	assert.ok(aceResult, 'ACE highlight must be emitted')
	assert.equal(aceResult.type, 'ACE_5K')
	assert.equal(aceResult.playerName, 'ZywOo')
	assert.equal(aceResult.kills, 5)
	assert.equal(aceResult.headline, 'ZywOo 5K ACE')
})

test('HighlightDetector: 4K Quad Kill Detection', () => {
	const detector = new HighlightDetector()

	const frameOver = {
		map: { round: 11, phase: 'live', team_ct: { name: 'Astralis' }, team_t: { name: 'Heroic' } },
		round: { phase: 'over', win_team: 'T' },
		allplayers: {
			'76561198000000001': { team: 'T', state: { health: 40, round_kills: 4 }, name: 'sjuush' },
			'76561198000000002': { team: 'T', state: { health: 100, round_kills: 0 }, name: 'TeSeS' },
		},
	}

	const quadResult = detector.processFrame(frameOver)
	assert.ok(quadResult, '4K highlight must be emitted')
	assert.equal(quadResult.type, 'QUAD_4K')
	assert.equal(quadResult.playerName, 'sjuush')
	assert.equal(quadResult.kills, 4)
	assert.equal(quadResult.headline, 'sjuush 4K Quad Kill')
})

test('HighlightDetector: Pressure Defuse Detection (>= 2 T alive at defuse)', () => {
	const detector = new HighlightDetector()

	const frameDefused = {
		map: { round: 3, phase: 'live', team_ct: { name: 'Liquid' }, team_t: { name: 'Complexity' } },
		round: { phase: 'live', bomb: 'defused' },
		previously: { round: { bomb: 'planted' } },
		allplayers: {
			'76561198000000001': { team: 'CT', state: { health: 100, defusekit: true }, name: 'Twistzz' },
			'76561198000000006': { team: 'T', state: { health: 100 }, name: 'Grim' },
			'76561198000000007': { team: 'T', state: { health: 100 }, name: 'hallzerk' },
		},
	}

	const defuseResult = detector.processFrame(frameDefused)
	assert.ok(defuseResult, 'Pressure defuse must be detected when >=2 opponents alive')
	assert.equal(defuseResult.type, 'PRESSURE_DEFUSE')
	assert.equal(defuseResult.playerName, 'Twistzz')
	assert.equal(defuseResult.vsCount, 2)
})

test('AutoReplayService: queue limit and trigger replay', async () => {
	const mockWs = {
		broadcast: (msg) => {
			assert.ok(msg.event === 'REPLAY_SAVED' || msg.event === 'HIGHLIGHT_DETECTED' || msg.event === 'highlight:new' || msg.event === 'highlight:cleared')
		},
	}

	const mockObs = {
		connected: true,
		saveReplayBuffer: async () => true,
	}

	const service = new AutoReplayService({ ws: mockWs, obsManager: mockObs })

	// Push 60 highlights
	for (let i = 1; i <= 60; i++) {
		service.pushHighlight({
			id: `rep_${Date.now()}_r${i}`,
			round: i,
			type: 'CLUTCH_1V2',
			playerName: `Player_${i}`,
			team: 'CT',
			headline: `Player_${i} 1v2 Clutch`,
			timestamp: Date.now() / 1000,
		})
	}

	const queue = service.getHighlights()
	assert.equal(queue.length, 50, 'Highlights queue must cap at 50 items max')

	// Trigger manual replay
	const triggered = await service.triggerReplay()
	assert.ok(triggered.id)
	assert.equal(triggered.savedInObs, true)

	// Clear queue
	service.clearHighlights()
	assert.equal(service.getHighlights().length, 0)
})

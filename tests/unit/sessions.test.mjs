import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
	createSession,
	getActiveSession,
	setActiveSession,
	endActiveSession,
	getSessionPath,
	readSession,
	appendTimelineEvent
} from '../../src/server/sessions/session-store.js'
import { processGsiFrame, resetTimelineState } from '../../src/server/sessions/timeline-recorder.js'
import { rebuildSessionStats } from '../../src/server/sessions/stats-aggregator.js'
import { exportSessionToJson, exportSessionToCsv } from '../../src/server/sessions/session-export.js'

test('Session lifecycle, security path traversal and stats calculation', async (t) => {
	// 1. Path traversal security test
	assert.equal(getSessionPath('../../../etc'), null, 'Directory traversal via relative dots must return null')
	assert.equal(getSessionPath('..\\..\\windows'), null, 'Windows traversal must return null')
	assert.equal(getSessionPath('/root/secret'), null, 'Absolute path injection must return null')

	// 2. Session creation and in-memory active cache
	const testSession = createSession({
		id: 'test_auto_unit_1',
		teams: {
			home: { name: 'NaVi' },
			away: { name: 'FaZe' }
		}
	})
	assert.ok(testSession, 'Session should be created')
	assert.equal(testSession.id, 'test_auto_unit_1')
	
	const active = getActiveSession()
	assert.ok(active, 'Active session must be retrieved from memory')
	assert.equal(active.id, 'test_auto_unit_1')

	const sPath = getSessionPath(testSession.id)
	assert.ok(sPath, 'Session path must be found')

	// 3. Process GSI frames (MR12 with Halftime and multikill)
	// Frame 1: Map init (de_mirage, round 1, NaVi starts CT)
	processGsiFrame({
		map: {
			name: 'de_mirage',
			round: 1,
			team_ct: { name: 'NaVi', score: 0 },
			team_t: { name: 'FaZe', score: 0 }
		},
		round: { phase: 'live' },
		allplayers: {
			'76561198000000001': {
				name: 's1mple',
				team: 'CT',
				match_stats: { kills: 0, deaths: 0 }
			},
			'76561198000000002': {
				name: 'karrigan',
				team: 'T',
				match_stats: { kills: 0, deaths: 0 }
			}
		}
	})

	// Frame 2: Double kill by s1mple
	processGsiFrame({
		map: {
			name: 'de_mirage',
			round: 1,
			team_ct: { name: 'NaVi', score: 0 },
			team_t: { name: 'FaZe', score: 0 }
		},
		round: { phase: 'live' },
		allplayers: {
			'76561198000000001': {
				name: 's1mple',
				team: 'CT',
				match_stats: { kills: 2, deaths: 0 }
			},
			'76561198000000002': {
				name: 'karrigan',
				team: 'T',
				match_stats: { kills: 0, deaths: 1 }
			}
		}
	})

	// Frame 3: Delta frame without map object (must NOT zero out scores)
	processGsiFrame({
		round: { phase: 'live' },
		allplayers: {
			'76561198000000001': {
				name: 's1mple',
				team: 'CT',
				match_stats: { kills: 2, deaths: 0 }
			}
		}
	})

	// Frame 4: Round 1 Over, NaVi won CT side
	processGsiFrame({
		map: {
			name: 'de_mirage',
			round: 1,
			team_ct: { name: 'NaVi', score: 1 },
			team_t: { name: 'FaZe', score: 0 }
		},
		round: { phase: 'over', win_team: 'CT' }
	})

	// Wait 60ms for stream buffer to flush to disk
	await new Promise(r => setTimeout(r, 60))

	// Rebuild stats
	const stats = rebuildSessionStats(testSession.id)
	assert.ok(stats, 'Stats should be rebuilt')
	assert.equal(stats.matchTotals.kills, 2, 'Total kills should be 2')
	assert.equal(stats.players['76561198000000001'].kills, 2, 's1mple kills should be 2')
	assert.equal(stats.players['76561198000000001'].team, 'home', 's1mple should be mapped to home team')

	// 4. Test CSV & JSON export
	const jsonExport = exportSessionToJson(testSession.id)
	assert.ok(jsonExport.generatedAt, 'JSON export has generatedAt')
	assert.equal(jsonExport.stats.matchTotals.kills, 2)

	const csvExport = exportSessionToCsv(testSession.id)
	assert.ok(csvExport.includes('s1mple'), 'CSV includes player s1mple')
	assert.ok(csvExport.includes('--- PLAYER STATISTICS ---'), 'CSV includes player section')

	// 5. Formula injection defense check
	appendTimelineEvent(testSession.id, {
		type: 'player/kill',
		at: new Date().toISOString(),
		actor: { steamid: 'bad_actor', name: ' =cmd|calc', team: 'away' },
		target: null,
		team: 'away',
		data: { count: 1 }
	})
	await new Promise(r => setTimeout(r, 60))

	const protectedStats = rebuildSessionStats(testSession.id)
	const protectedCsv = exportSessionToCsv(testSession.id)
	assert.ok(!protectedCsv.includes(',=cmd'), 'Formula leading equal sign must be escaped with single quote')

	// 6. Ending active session
	const ended = endActiveSession()
	assert.ok(ended, 'Active session should be ended')
	assert.equal(getActiveSession(), null, 'No session should be active after ending')

	// Cleanup test session folder
	try {
		fs.rmSync(sPath, { recursive: true, force: true })
	} catch (_) {}
})

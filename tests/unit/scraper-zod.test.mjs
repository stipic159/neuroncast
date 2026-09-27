import test from 'node:test'
import assert from 'node:assert/strict'
import { MatchupSchema, StandingsTableSchema, TeamGamesSchema } from '../../src/server/fallbacks/schemas.js'
import { getMatchFallback, getTableFallback, getTeamGamesFallback } from '../../src/server/fallbacks/payload-fallbacks.js'

test('Zod schemas validate structured fallback payloads cleanly', () => {
	const matchFallback = getMatchFallback('test-match-123')
	const matchRes = MatchupSchema.safeParse(matchFallback)
	assert.equal(matchRes.success, true, 'MatchupSchema must accept getMatchFallback')
	assert.equal(matchRes.data.id, 'test-match-123')

	const tableFallback = getTableFallback()
	const tableRes = StandingsTableSchema.safeParse(tableFallback)
	assert.equal(tableRes.success, true, 'StandingsTableSchema must accept getTableFallback')
	assert.equal(Array.isArray(tableRes.data.rows), true)

	const teamGamesFallback = getTeamGamesFallback('test-match-123')
	const gamesRes = TeamGamesSchema.safeParse(teamGamesFallback)
	assert.equal(gamesRes.success, true, 'TeamGamesSchema must accept getTeamGamesFallback')
})

test('MatchupSchema sanitizes missing fields and fills required defaults', () => {
	const partialMatch = {
		id: 9999,
		home: { name: 'FaZe' },
		away: { name: 'NaVi' }
	}
	const res = MatchupSchema.safeParse(partialMatch)
	assert.equal(res.success, true)
	assert.equal(res.data.bestOf, 3)
	assert.equal(res.data.series.home, 0)
	assert.equal(res.data.home.name, 'FaZe')
	assert.equal(res.data.away.name, 'NaVi')
	assert.deepEqual(res.data.maps, [])
})

test('StandingsTableSchema safely parses partial row numbers as strings or ints', () => {
	const partialTable = {
		division: '1. Divisjon',
		rows: [
			{ placement: 1, team: 'Apeks', played: 5, wins: 4, draws: 0, losses: 1, diff: '+12', penalty: 0, points: 12 }
		]
	}
	const res = StandingsTableSchema.safeParse(partialTable)
	assert.equal(res.success, true)
	assert.equal(res.data.rows[0].team, 'Apeks')
	assert.equal(res.data.rows[0].points, 12)
})

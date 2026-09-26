import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMatchId, normalizeFastcupPayload } from '../../../src/server/integrations/fastcup/fetcher.js'

test('extractMatchId parses numeric ID from various URL formats', () => {
	assert.equal(extractMatchId('1048294'), '1048294')
	assert.equal(extractMatchId('https://cs.fastcup.net/match/1048294'), '1048294')
	assert.equal(extractMatchId('fastcup.net/match/1048294?tab=veto'), '1048294')
	assert.equal(extractMatchId('cs.fastcup.net/matches/998877'), '998877')
	assert.equal(extractMatchId('invalid'), null)
	assert.equal(extractMatchId(''), null)
})

test('normalizeFastcupPayload constructs canonical FastcupMatchPayload object', async () => {
	const rawMock = {
		id: 1048294,
		best_of: 3,
		status: 'live',
		team1: {
			id: '101',
			name: 'NAVI Mix',
			tag: 'NAVI',
			players: [
				{ id: 111, steam_id64: '76561198000000001', nickname: 's1mple', is_captain: true },
				{ id: 112, steam_id64: '76561198000000002', nickname: 'b1t' },
			]
		},
		team2: {
			id: '102',
			name: 'FaZe Mix',
			tag: 'FAZE',
			players: [
				{ id: 221, steam_id64: '76561198000000003', nickname: 'karrigan', is_captain: true },
				{ id: 222, steam_id64: '76561198000000004', nickname: 'ropz' },
			]
		},
		veto: [
			{ team_id: '101', action: 'ban', map_name: 'de_inferno' },
			{ team_id: '102', action: 'ban', map_name: 'de_vertigo' },
			{ team_id: '101', action: 'pick', map_name: 'de_mirage' },
			{ team_id: '102', action: 'pick', map_name: 'de_nuke' },
		]
	}

	const normalized = await normalizeFastcupPayload(rawMock, '1048294')

	assert.equal(normalized.matchId, '1048294')
	assert.equal(normalized.provider, 'fastcup')
	assert.equal(normalized.format, 'BO3')
	assert.equal(normalized.status, 'live')
	assert.equal(normalized.teams.team1.name, 'NAVI Mix')
	assert.equal(normalized.teams.team1.players[0].nickname, 's1mple')
	assert.equal(normalized.teams.team1.players[0].steamId64, '76561198000000001')
	assert.equal(normalized.teams.team2.players[0].nickname, 'karrigan')
	assert.equal(normalized.veto.steps.length, 4)
	assert.equal(normalized.veto.steps[0].mapName, 'de_inferno')
})

test('normalizeFastcupPayload handles PUG/mix teams with default team names', async () => {
	const rawMock = {
		id: 555,
		best_of: 1,
		status: 'veto',
		team1: {
			id: 't1',
			players: [
				{ id: 1, steam_id: 'STEAM_0:0:12345', nickname: 'CaptainJack' },
			]
		},
		team2: {
			id: 't2',
			players: [
				{ id: 2, steam_id: 'STEAM_0:1:67890', nickname: 'SniperHero' },
			]
		}
	}

	const normalized = await normalizeFastcupPayload(rawMock, '555')

	assert.equal(normalized.format, 'BO1')
	assert.equal(normalized.teams.team1.name, 'Team CaptainJack')
	assert.equal(normalized.teams.team2.name, 'Team SniperHero')
	assert.equal(normalized.teams.team1.players[0].steamId64, '76561197960290418')
})

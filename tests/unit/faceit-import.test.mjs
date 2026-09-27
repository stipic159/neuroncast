import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {
	extractMatchId,
	normalizeMapId,
	parseFaceitMatch,
	parseFaceitVeto,
} from '../../src/server/integrations/faceit/faceit-parser.js'
import { cacheMatchAssets } from '../../src/server/integrations/faceit/faceit-service.js'

test('FACEIT Parser: Match ID Extraction', () => {
	const url1 = 'https://www.faceit.com/en/cs2/room/1-a1b2c3d4-e5f6-7890-abcd-1234567890ab'
	assert.equal(extractMatchId(url1), '1-a1b2c3d4-e5f6-7890-abcd-1234567890ab')

	const url2 = 'https://faceit.com/ru/csgo/room/b2c3d4e5-f6a7-8901-bcde-234567890abc/scoreboard'
	assert.equal(extractMatchId(url2), 'b2c3d4e5-f6a7-8901-bcde-234567890abc')

	const rawId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'
	assert.equal(extractMatchId(rawId), '1-f47ac10b-58cc-4372-a567-0e02b2c3d479')

	assert.equal(extractMatchId(''), null)
	assert.equal(extractMatchId('not-a-link'), null)
})

test('FACEIT Parser: Map Normalization', () => {
	assert.equal(normalizeMapId('Mirage'), 'de_mirage')
	assert.equal(normalizeMapId('Dust II'), 'de_dust2')
	assert.equal(normalizeMapId('dust2'), 'de_dust2')
	assert.equal(normalizeMapId('de_inferno'), 'de_inferno')
	assert.equal(normalizeMapId('Nuke'), 'de_nuke')
	assert.equal(normalizeMapId('Ancient'), 'de_ancient')
	assert.equal(normalizeMapId('Anubis'), 'de_anubis')
	assert.equal(normalizeMapId('Vertigo'), 'de_vertigo')
})

test('FACEIT Parser: Full Match & Veto Normalization', () => {
	const mockFaceitPayload = {
		match_id: '1-a1b2c3d4-e5f6-7890-abcd-1234567890ab',
		competition_name: 'ESEA Season 51 Open Playoffs',
		best_of: 3,
		teams: {
			faction1: {
				faction_id: 'navi_guid',
				name: 'Natus Vincere',
				tag: 'NAVI',
				avatar: 'https://cdn.faceit.com/teams/navi.png',
				roster: [
					{
						player_id: 'p1',
						nickname: 's1mple',
						game_player_id: '76561198034202243',
						avatar: 'https://cdn.faceit.com/avatars/s1mple.jpg',
						elo: 3500,
						country: 'ua',
					},
					{
						player_id: 'p2',
						nickname: 'b1t',
						game_player_id: '76561198357774780',
						avatar: 'https://cdn.faceit.com/avatars/b1t.jpg',
						elo: 3200,
						country: 'ua',
					},
				],
			},
			faction2: {
				faction_id: 'faze_guid',
				name: 'FaZe Clan',
				tag: 'FAZE',
				avatar: 'https://cdn.faceit.com/teams/faze.png',
				roster: [
					{
						player_id: 'p3',
						nickname: 'karrigan',
						game_player_id: '76561197989430253',
						avatar: '',
						elo: 2900,
						country: 'dk',
					},
				],
			},
		},
		voting: {
			map: {
				entities: [
					{ class_name: 'de_mirage', name: 'Mirage' },
					{ class_name: 'de_inferno', name: 'Inferno' },
					{ class_name: 'de_nuke', name: 'Nuke' },
					{ class_name: 'de_ancient', name: 'Ancient' },
					{ class_name: 'de_anubis', name: 'Anubis' },
					{ class_name: 'de_dust2', name: 'Dust2' },
					{ class_name: 'de_vertigo', name: 'Vertigo' },
				],
				pick: ['de_vertigo', 'de_anubis', 'de_mirage', 'de_inferno', 'de_ancient', 'de_dust2', 'de_nuke'],
			},
		},
	}

	const { matchConfig, vetoData } = parseFaceitMatch(mockFaceitPayload)

	assert.equal(matchConfig.id, '1-a1b2c3d4-e5f6-7890-abcd-1234567890ab')
	assert.equal(matchConfig.format, 'bo3')
	assert.equal(matchConfig.team1.name, 'Natus Vincere')
	assert.equal(matchConfig.team1.tag, 'NAVI')
	assert.equal(matchConfig.team1.avgElo, 3350)
	assert.equal(matchConfig.team1.players.length, 2)
	assert.equal(matchConfig.team1.players[0].nickname, 's1mple')
	assert.equal(matchConfig.team1.players[0].steamId64, '76561198034202243')

	assert.equal(matchConfig.team2.name, 'FaZe Clan')
	assert.equal(matchConfig.team2.players[0].nickname, 'karrigan')
	assert.equal(matchConfig.team2.players[0].avatarUrlLocal, '/assets/placeholders/default_avatar.svg')

	assert.ok(vetoData)
	assert.equal(vetoData.isPredefined, true)
	assert.equal(vetoData.actionHistory.length, 7)
	assert.equal(vetoData.mapsStatus['de_mirage'].mapId, 'de_mirage')
})

test('FACEIT Service: Batch caching of match assets', async (t) => {
	const testImage = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	)

	const server = http.createServer((req, res) => {
		res.writeHead(200, { 'Content-Type': 'image/png' })
		res.end(testImage)
	})

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	const port = server.address().port

	t.after(() => server.close())

	const sampleConfig = {
		id: 'test_match_123',
		team1: {
			id: 't1',
			logoUrlOriginal: `http://127.0.0.1:${port}/t1_logo.png`,
			logoUrlLocal: '',
			players: [
				{ nickname: 'PlayerA', steamId64: '76561198000000010', avatarUrlOriginal: `http://127.0.0.1:${port}/p1_avatar.png`, avatarUrlLocal: '' },
			],
		},
		team2: {
			id: 't2',
			logoUrlOriginal: '',
			logoUrlLocal: '/assets/placeholders/default_team.svg',
			players: [],
		},
	}

	const cachedConfig = await cacheMatchAssets(sampleConfig)

	assert.equal(cachedConfig.isOfflineReady, true)
	assert.match(cachedConfig.team1.logoUrlLocal, /^\/assets\/cache\/teams\/team1_t1_[a-f0-9]+\.png$/)
	assert.match(cachedConfig.team1.players[0].avatarUrlLocal, /^\/assets\/cache\/avatars\/76561198000000010_[a-f0-9]+\.png$/)
})

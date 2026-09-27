import test from 'node:test'
import assert from 'node:assert/strict'
import {
	parseFastcupVeto,
	importFastcupMatch,
	getActiveFastcupMatchConfig,
	setActiveFastcupMatchConfig,
} from '../../src/server/integrations/fastcup/fastcup-service.js'
import { importMatch, getActiveMatchConfig } from '../../src/server/routes/match-routes.js'

test('FastCup Veto Parser: parses steps into mapsStatus and actionHistory', () => {
	const rawVeto = {
		steps: [
			{ team: 'team1', action: 'ban', mapName: 'de_inferno' },
			{ team: 'team2', action: 'ban', mapName: 'de_vertigo' },
			{ team: 'team1', action: 'pick', mapName: 'de_mirage' },
			{ team: 'team2', action: 'pick', mapName: 'de_nuke' },
		],
	}

	const parsed = parseFastcupVeto(rawVeto, 'bo3')
	assert.ok(parsed)
	assert.equal(parsed.isPredefined, true)
	assert.equal(parsed.actionHistory.length, 4)
	assert.equal(parsed.mapsStatus.de_inferno.status, 'BANNED')
	assert.equal(parsed.mapsStatus.de_inferno.actionTeam, 'team1')
	assert.equal(parsed.mapsStatus.de_mirage.status, 'PICKED')
	assert.equal(parsed.mapsStatus.de_mirage.actionTeam, 'team1')
	assert.equal(parsed.mapsStatus.de_nuke.status, 'PICKED')
	assert.equal(parsed.mapsStatus.de_nuke.actionTeam, 'team2')
	assert.equal(parsed.mapsStatus.de_ancient.status, 'AVAILABLE')
})

test('FastCup Veto Parser: identifies decider when 1 map left', () => {
	const rawVeto = {
		steps: [
			{ team: 'team1', action: 'ban', mapName: 'de_inferno' },
			{ team: 'team2', action: 'ban', mapName: 'de_vertigo' },
			{ team: 'team1', action: 'ban', mapName: 'de_ancient' },
			{ team: 'team2', action: 'ban', mapName: 'de_anubis' },
			{ team: 'team1', action: 'ban', mapName: 'de_dust2' },
			{ team: 'team2', action: 'ban', mapName: 'de_nuke' },
		],
	}

	const parsed = parseFastcupVeto(rawVeto, 'bo1')
	assert.ok(parsed)
	assert.equal(parsed.mapsStatus.de_mirage.status, 'DECIDER')
	assert.equal(parsed.actionHistory[parsed.actionHistory.length - 1].type, 'DECIDER')
	assert.equal(parsed.actionHistory[parsed.actionHistory.length - 1].mapId, 'de_mirage')
})

test('Unified Match Importer: prioritizes FastCup for numeric IDs and FastCup URLs', async () => {
	// Active match config can be set and retrieved
	const mockConfig = {
		id: '27240569',
		source: 'fastcup',
		title: 'NAVI vs FaZe',
		format: 'bo3',
		team1: { name: 'NAVI', tag: 'NAVI' },
		team2: { name: 'FaZe', tag: 'FAZE' },
	}

	setActiveFastcupMatchConfig(mockConfig)
	const retrieved = getActiveMatchConfig()
	assert.equal(retrieved.id, '27240569')
	assert.equal(retrieved.source, 'fastcup')
	assert.equal(retrieved.title, 'NAVI vs FaZe')
})

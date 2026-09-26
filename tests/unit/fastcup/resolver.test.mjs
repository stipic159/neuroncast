import test from 'node:test'
import assert from 'node:assert/strict'
import { assignFastcupSides } from '../../../src/themes/raw/helpers/team-identity-resolver.js'

test('assignFastcupSides correctly assigns CT/T sides based on SteamID majority voting quorum', () => {
	const mockMatch = {
		teams: {
			team1: {
				name: 'Navi Mix',
				tag: 'NAVI',
				logoUrl: '/api/fastcup/assets/navi.png',
				players: [
					{ steamId64: '76561198000000001', nickname: 's1mple' },
					{ steamId64: '76561198000000002', nickname: 'b1t' },
					{ steamId64: '76561198000000003', nickname: 'electroNic' },
					{ steamId64: '76561198000000004', nickname: 'Perfecto' },
					{ steamId64: '76561198000000005', nickname: 'Boombl4' },
				]
			},
			team2: {
				name: 'FaZe Mix',
				tag: 'FAZE',
				logoUrl: '/api/fastcup/assets/faze.png',
				players: [
					{ steamId64: '76561198000000010', nickname: 'karrigan' },
					{ steamId64: '76561198000000011', nickname: 'ropz' },
					{ steamId64: '76561198000000012', nickname: 'rain' },
					{ steamId64: '76561198000000013', nickname: 'broky' },
					{ steamId64: '76561198000000014', nickname: 'twistzz' },
				]
			}
		}
	}

	// 4 Navi players are on CT, 5 FaZe players are on T
	const gsiAllPlayersFirstHalf = [
		{ steam64Id: '76561198000000001', team: 'CT' },
		{ steam64Id: '76561198000000002', team: 'CT' },
		{ steam64Id: '76561198000000003', team: 'CT' },
		{ steam64Id: '76561198000000004', team: 'CT' },

		{ steam64Id: '76561198000000010', team: 'T' },
		{ steam64Id: '76561198000000011', team: 'T' },
		{ steam64Id: '76561198000000012', team: 'T' },
		{ steam64Id: '76561198000000013', team: 'T' },
		{ steam64Id: '76561198000000014', team: 'T' },
	]

	const firstHalfResult = assignFastcupSides({ match: mockMatch, gsiAllPlayers: gsiAllPlayersFirstHalf })

	assert.equal(firstHalfResult.source, 'fastcup-quorum')
	assert.equal(firstHalfResult.ct.name, 'Navi Mix')
	assert.equal(firstHalfResult.t.name, 'FaZe Mix')

	// Halftime swap: 4 Navi players move to T side, FaZe players move to CT
	const gsiAllPlayersSecondHalf = [
		{ steam64Id: '76561198000000001', team: 'T' },
		{ steam64Id: '76561198000000002', team: 'T' },
		{ steam64Id: '76561198000000003', team: 'T' },
		{ steam64Id: '76561198000000004', team: 'T' },

		{ steam64Id: '76561198000000010', team: 'CT' },
		{ steam64Id: '76561198000000011', team: 'CT' },
		{ steam64Id: '76561198000000012', team: 'CT' },
	]

	const secondHalfResult = assignFastcupSides({ match: mockMatch, gsiAllPlayers: gsiAllPlayersSecondHalf })

	assert.equal(secondHalfResult.source, 'fastcup-quorum')
	assert.equal(secondHalfResult.ct.name, 'FaZe Mix')
	assert.equal(secondHalfResult.t.name, 'Navi Mix')
})

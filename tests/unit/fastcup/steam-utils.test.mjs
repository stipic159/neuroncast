import test from 'node:test'
import assert from 'node:assert/strict'
import { toSteamID64, isValidSteamID64 } from '../../../src/server/integrations/fastcup/steam-utils.js'

test('isValidSteamID64 correctly identifies 17-digit SteamID64 format', () => {
	assert.equal(isValidSteamID64('76561197960265728'), true)
	assert.equal(isValidSteamID64('76561198000000000'), true)
	assert.equal(isValidSteamID64('12345'), false)
	assert.equal(isValidSteamID64('STEAM_0:0:12345'), false)
	assert.equal(isValidSteamID64(null), false)
})

test('toSteamID64 handles direct SteamID64 strings and numbers', () => {
	assert.equal(toSteamID64('76561198012345678'), '76561198012345678')
	assert.equal(toSteamID64(76561198012345678n), '76561198012345678')
})

test('toSteamID64 converts Steam2 format correctly without precision loss', () => {
	// STEAM_0:0:12345 -> 76561197960265728 + 12345 * 2 + 0 = 76561197960290418
	assert.equal(toSteamID64('STEAM_0:0:12345'), '76561197960290418')
	assert.equal(toSteamID64('STEAM_1:1:67890'), '76561197960401509')
})

test('toSteamID64 converts Steam3 format correctly', () => {
	// [U:1:24690] -> 76561197960265728 + 24690 = 76561197960290418
	assert.equal(toSteamID64('[U:1:24690]'), '76561197960290418')
	assert.equal(toSteamID64('U:1:24690'), '76561197960290418')
})

test('toSteamID64 converts pure account ID and FastCup profile URLs', () => {
	assert.equal(toSteamID64('24690'), '76561197960290418')
	assert.equal(toSteamID64('https://cs.fastcup.net/member/24690'), '76561197960290418')
	assert.equal(toSteamID64('fastcup.net/member/76561198012345678'), '76561198012345678')
})

test('toSteamID64 handles invalid inputs gracefully', () => {
	assert.equal(toSteamID64(null), null)
	assert.equal(toSteamID64(''), null)
	assert.equal(toSteamID64('invalid_string'), null)
})

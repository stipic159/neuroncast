// Which scraped team is on which side - the 2026-09-17 live bug (6614Gamers
// shown as CT while playing T) pinned down. Run: node --test tests/unit/
import test from 'node:test'
import assert from 'node:assert/strict'
import { assignKlSides, sideInRound, teamNamesMatch, normalizeMapName } from '../../src/themes/raw/helpers/team-identity-resolver.js'

const match = {
	home: { name: '6614Gamers', logo: 'h.png' },
	away: { name: 'Kratt Kjerr Klæmmelag', logo: 'a.png' },
	maps: [
		{ name: 'Ancient', homeStartSide: 'T', awayStartSide: 'CT' },
		{ name: 'Dust II', homeStartSide: 'CT', awayStartSide: 'T' },
		{ name: 'Anubis', homeStartSide: null, awayStartSide: null },
	],
}

test('game-feed team names decide the side, whatever home/away is', () => {
	const a = assignKlSides({ match, ct: { name: 'Kratt Kjerr Klæmmelag' }, t: { name: '6614gamers' } })
	assert.equal(a.source, 'gsi-name'); assert.equal(a.t.name, '6614Gamers'); assert.equal(a.ct.name, 'Kratt Kjerr Klæmmelag')
	const b = assignKlSides({ match, ct: { name: '6614Gamers' }, t: { name: 'KKK' } })
	assert.equal(b.source, 'gsi-name'); assert.equal(b.ct.name, '6614Gamers')
	// one recognisable name is enough
	const c = assignKlSides({ match, ct: { name: 'team_6614Gamers' }, t: { name: 'Terrorists' } })
	assert.equal(c.source, 'gsi-name'); assert.equal(c.ct.name, '6614Gamers')
})

test('generic feed names fall back to the starting side + round number', () => {
	// Ancient: home starts T. Round 1 (0-0): home is T
	const r1 = assignKlSides({ match, ct: { name: 'CT', score: 0 }, t: { name: 'TERRORISTS', score: 0 }, mapName: 'de_ancient' })
	assert.equal(r1.source, 'starting-side'); assert.equal(r1.t.name, '6614Gamers')
	// round 13 (12 rounds played): sides swapped -> home is CT
	const r13 = assignKlSides({ match, ct: { name: 'CT', score: 7 }, t: { name: 'T', score: 5 }, mapName: 'de_ancient' })
	assert.equal(r13.ct.name, '6614Gamers')
	// Dust II: home starts CT; round 3
	const d = assignKlSides({ match, ct: { name: 'CT', score: 1 }, t: { name: 'T', score: 1 }, mapName: 'de_dust2' })
	assert.equal(d.ct.name, '6614Gamers')
	// a map without sides falls through to the positional guess
	const an = assignKlSides({ match, ct: { name: 'CT', score: 0 }, t: { name: 'T', score: 0 }, mapName: 'de_anubis' })
	assert.equal(an.source, 'home-away'); assert.equal(an.t.name, '6614Gamers')
})

test('the operator swap switch is applied on top of whatever was found', () => {
	const a = assignKlSides({ match, options: { 'preferences.topBar.swapScrapedTeams': true }, ct: { name: 'Kratt Kjerr Klæmmelag' }, t: { name: '6614Gamers' } })
	assert.equal(a.source, 'gsi-name+swapped'); assert.equal(a.ct.name, '6614Gamers')
})

test('sideInRound: MR12 halves and 3-round overtime halves', () => {
	assert.equal(sideInRound('T', 1), 'T'); assert.equal(sideInRound('T', 12), 'T')
	assert.equal(sideInRound('T', 13), 'CT'); assert.equal(sideInRound('T', 24), 'CT')
	assert.equal(sideInRound('T', 25), 'T'); assert.equal(sideInRound('T', 27), 'T')
	assert.equal(sideInRound('T', 28), 'CT'); assert.equal(sideInRound('T', 30), 'CT')
	assert.equal(sideInRound('T', 31), 'T'); assert.equal(sideInRound('CT', 45), 'CT')
	assert.equal(sideInRound(null, 5), null)
})

test('name and map normalisation', () => {
	assert.equal(teamNamesMatch('6614Gamers', '6614gamers'), true)
	assert.equal(teamNamesMatch('rdal e-sport', 'rdal e‑sport'), true)
	assert.equal(teamNamesMatch('Dicknitas', 'rdal e-sport'), false)
	assert.equal(teamNamesMatch('CT', 'Counter-Terrorists'), false, 'short strings never substring-match')
	assert.equal(normalizeMapName('de_dust2'), normalizeMapName('Dust II'))
	assert.equal(normalizeMapName('de_ancient'), normalizeMapName('Ancient'))
	assert.equal(normalizeMapName('de_anubis'), 'anubis')
})

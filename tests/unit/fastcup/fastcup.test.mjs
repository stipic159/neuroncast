import test from 'node:test'
import assert from 'node:assert/strict'
import { 
	getValueByPath, 
	setValueByPath, 
	mergePayloadWithOverrides, 
	getAdaptiveTtlMs 
} from '../../../src/server/fastcup.js'

test('getValueByPath and setValueByPath operate correctly on nested objects', () => {
	const obj = { teams: { team1: { name: 'Alpha' } } }
	
	assert.equal(getValueByPath(obj, 'teams.team1.name'), 'Alpha')
	assert.equal(getValueByPath(obj, 'teams.team1.nonexistent'), undefined)

	setValueByPath(obj, 'teams.team1.name', 'Custom Team')
	assert.equal(getValueByPath(obj, 'teams.team1.name'), 'Custom Team')

	setValueByPath(obj, 'teams.team2.name', 'Bravo')
	assert.equal(getValueByPath(obj, 'teams.team2.name'), 'Bravo')
})

test('getAdaptiveTtlMs returns appropriate TTL for each match status', () => {
	assert.equal(getAdaptiveTtlMs('veto'), 10000)
	assert.equal(getAdaptiveTtlMs('in_progress'), 10000)
	assert.equal(getAdaptiveTtlMs('live'), 60000)
	assert.equal(getAdaptiveTtlMs('finished'), 600000)
	assert.equal(getAdaptiveTtlMs('upcoming'), 30000)
})

test('mergePayloadWithOverrides protects locked user fields from being overwritten', () => {
	const freshDataFromNetwork = {
		matchId: '100',
		teams: {
			team1: { name: 'Network Name 1', tag: 'NET1' },
			team2: { name: 'Network Name 2', tag: 'NET2' },
		}
	}

	const existingDataWithOverrides = {
		matchId: '100',
		teams: {
			team1: { name: 'Operator Overridden Name', tag: 'NET1' },
			team2: { name: 'Network Name 2', tag: 'NET2' },
		},
		overrides: {
			lockedFields: ['teams.team1.name'],
			customData: {
				'teams.team1.name': 'Operator Overridden Name'
			}
		}
	}

	const merged = mergePayloadWithOverrides(freshDataFromNetwork, existingDataWithOverrides)

	// team1.name should NOT be overwritten by Network Name 1
	assert.equal(merged.teams.team1.name, 'Operator Overridden Name')
	// team2.name SHOULD take fresh Network Name 2
	assert.equal(merged.teams.team2.name, 'Network Name 2')
	// lockedFields array is preserved
	assert.deepEqual(merged.overrides.lockedFields, ['teams.team1.name'])
})

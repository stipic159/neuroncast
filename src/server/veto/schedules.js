/**
 * Map veto schedule definitions for competitive CS2 formats (Valve Major / Tournament rules).
 * Supports BO1, BO3, BO5 with knifeRoundDecider flag.
 */

import { CS2_ACTIVE_MAP_POOL } from '../integrations/faceit/faceit-parser.js'

/**
 * Generates an ordered schedule of veto steps based on format and rule options.
 *
 * @param {'bo1'|'bo3'|'bo5'} format
 * @param {Object} options
 * @param {boolean} [options.knifeRoundDecider=true] - If true, side on decider is chosen via in-game knife round (skips SIDE_PICK)
 * @param {'team1'|'team2'} [options.firstTeam='team1'] - Team that executes the first ban/pick
 * @param {string[]} [options.mapPool] - Active map pool (defaults to CS2 Active Duty: 7 maps)
 * @returns {Array<{ stepIndex: number, team: 'team1'|'team2', action: 'BAN'|'PICK'|'SIDE_PICK'|'DECIDER', description: string, targetMapStep?: number }>}
 */
export function generateVetoSchedule(format = 'bo3', options = {}) {
	const knifeRoundDecider = options.knifeRoundDecider !== false
	const teamA = options.firstTeam === 'team2' ? 'team2' : 'team1'
	const teamB = teamA === 'team1' ? 'team2' : 'team1'
	const pool = Array.isArray(options.mapPool) && options.mapPool.length >= 7 ? options.mapPool : CS2_ACTIVE_MAP_POOL

	const steps = []
	let stepIndex = 0

	const addStep = (team, action, description, targetMapStep = undefined) => {
		steps.push({
			stepIndex: stepIndex++,
			team,
			action,
			description,
			targetMapStep,
		})
	}

	if (format === 'bo1') {
		// 7 maps -> 6 bans -> 1 decider
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans a map`)
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans a map`)
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans the final map`)
		
		// Decider is automatically the remaining 1 map
		addStep(teamA, 'DECIDER', 'Decider map determined')

		// Side pick rule: team that didn't make the last ban chooses side (Team A), unless knife round
		if (!knifeRoundDecider) {
			addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Decider`, stepIndex - 2)
		}
	} else if (format === 'bo3') {
		// 7 maps -> 2 bans -> 2 picks (with side picks) -> 2 bans -> 1 decider
		// Step 0: Team A bans
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		// Step 1: Team B bans
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans a map`)

		// Step 2: Team A picks Map 1
		const map1PickStep = stepIndex
		addStep(teamA, 'PICK', `${teamA.toUpperCase()} picks Map 1`)
		// Step 3: Team B picks starting side on Map 1
		addStep(teamB, 'SIDE_PICK', `${teamB.toUpperCase()} picks starting side on Map 1`, map1PickStep)

		// Step 4: Team B picks Map 2
		const map2PickStep = stepIndex
		addStep(teamB, 'PICK', `${teamB.toUpperCase()} picks Map 2`)
		// Step 5: Team A picks starting side on Map 2
		addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Map 2`, map2PickStep)

		// Step 6: Team A bans
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		// Step 7: Team B bans the final map
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans the final map`)

		// Step 8: Decider map determined
		addStep(teamA, 'DECIDER', 'Decider map determined')

		// Step 9: Side pick on Decider (Team A didn't make the last ban, so Team A chooses side if no knife round)
		if (!knifeRoundDecider) {
			addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Decider`, stepIndex - 2)
		}
	} else if (format === 'bo5') {
		// 7 maps -> 2 bans -> 4 picks -> 1 decider
		addStep(teamA, 'BAN', `${teamA.toUpperCase()} bans a map`)
		addStep(teamB, 'BAN', `${teamB.toUpperCase()} bans a map`)

		// Map 1 Pick & Side Pick
		const m1Step = stepIndex
		addStep(teamA, 'PICK', `${teamA.toUpperCase()} picks Map 1`)
		addStep(teamB, 'SIDE_PICK', `${teamB.toUpperCase()} picks starting side on Map 1`, m1Step)

		// Map 2 Pick & Side Pick
		const m2Step = stepIndex
		addStep(teamB, 'PICK', `${teamB.toUpperCase()} picks Map 2`)
		addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Map 2`, m2Step)

		// Map 3 Pick & Side Pick
		const m3Step = stepIndex
		addStep(teamA, 'PICK', `${teamA.toUpperCase()} picks Map 3`)
		addStep(teamB, 'SIDE_PICK', `${teamB.toUpperCase()} picks starting side on Map 3`, m3Step)

		// Map 4 Pick & Side Pick
		const m4Step = stepIndex
		addStep(teamB, 'PICK', `${teamB.toUpperCase()} picks Map 4`)
		addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Map 4`, m4Step)

		// Decider (Map 5)
		addStep(teamA, 'DECIDER', 'Decider map determined')
		if (!knifeRoundDecider) {
			addStep(teamA, 'SIDE_PICK', `${teamA.toUpperCase()} picks starting side on Decider`, stepIndex - 2)
		}
	}

	return steps
}

/**
 * Structured fallback generators for NeuronCast's Komplettligaen / GG Arena integration.
 * Ensures HUD templates and Config SPA editors never receive unhandled null/undefined fields.
 */

/**
 * Returns a fully structured fallback matchup.
 * @param {string} matchId - The requested match ID
 */
export function getMatchFallback(matchId = 'fallback-match') {
	return {
		id: matchId || 'fallback-match',
		component: 'Matchup',
		competition: 'Tournament Broadcast',
		divisionId: 'fallback-division',
		division: 'First Division',
		round: 'Round TBD',
		title: 'Home Team vs Away Team',
		bestOf: 3,
		startsAt: new Date().toISOString(),
		vetoOpensAt: null,
		status: 'scheduled',
		spectateInfo: '',
		spectateUrl: '',
		home: {
			id: 'fallback-home',
			signupId: 'fallback-home-signup',
			name: 'Home Team',
			logo: '/hud/img/logos/t.png',
			score: 0,
			stats: []
		},
		away: {
			id: 'fallback-away',
			signupId: 'fallback-away-signup',
			name: 'Away Team',
			logo: '/hud/img/logos/ct.png',
			score: 0,
			stats: []
		},
		series: { home: 0, away: 0 },
		matchWinner: null,
		currentMap: null,
		maps: [
			{ number: 1, name: 'TBD Map 1', image: '', status: 'scheduled', homeScore: null, awayScore: null, finished: false, winner: null, pickedBy: '' },
			{ number: 2, name: 'TBD Map 2', image: '', status: 'scheduled', homeScore: null, awayScore: null, finished: false, winner: null, pickedBy: '' },
			{ number: 3, name: 'TBD Map 3', image: '', status: 'scheduled', homeScore: null, awayScore: null, finished: false, winner: null, pickedBy: '' }
		],
		rawKeys: []
	};
}

/**
 * Returns a fully structured fallback standings table.
 */
export function getTableFallback() {
	return {
		rows: []
	};
}

/**
 * Returns a fully structured fallback team fixtures schedule.
 */
export function getTeamGamesFallback() {
	return {
		teams: []
	};
}

import fs from 'fs'
import path from 'path'
import { getSessionPath, updateSessionSummary } from './session-store.js'

/**
 * Calculates which side (CT or T) the starting team is on in a given round
 * supporting MR12 (12 rounds per half) and Overtime (3 rounds per half).
 */
function getSideInRound(startSide, roundNumber) {
	if (!startSide || !roundNumber || roundNumber <= 0) return startSide || 'CT'
	if (roundNumber <= 12) return startSide
	if (roundNumber <= 24) return startSide === 'CT' ? 'T' : 'CT'
	// Overtime: 3 rounds per OT half (rounds 25-27, 28-30, etc.)
	const otRound = roundNumber - 24
	const otHalf = Math.floor((otRound - 1) / 3)
	const isSwapped = (otHalf % 2) !== 0
	return isSwapped ? (startSide === 'CT' ? 'T' : 'CT') : startSide
}

/**
 * Helper to match team names case-insensitively while ignoring generic team names.
 */
function matchTeamName(targetName, candidateName) {
	if (!targetName || !candidateName) return false
	const target = targetName.trim().toLowerCase()
	const candidate = candidateName.trim().toLowerCase()
	if (['counter-terrorists', 'terrorists', 'ct', 't'].includes(target)) return false
	if (['counter-terrorists', 'terrorists', 'ct', 't'].includes(candidate)) return false
	return target === candidate || target.includes(candidate) || candidate.includes(target)
}

/**
 * Rebuilds stats.json for a given session by replaying timeline.jsonl and snapshots.jsonl
 */
export function rebuildSessionStats(sessionId) {
	const sPath = getSessionPath(sessionId)
	if (!sPath) return null

	const timelinePath = path.join(sPath, 'timeline.jsonl')
	const snapshotsPath = path.join(sPath, 'snapshots.jsonl')
	const metadataPath = path.join(sPath, 'metadata.json')
	
	// Read metadata
	let metadata = {}
	try {
		if (fs.existsSync(metadataPath)) {
			metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
		}
	} catch (err) {
		console.warn(`[StatsAggregator] Failed to read metadata for session ${sessionId}:`, err)
	}

	const homeTeamName = metadata.teams?.home?.name || 'Counter-Terrorists'
	const awayTeamName = metadata.teams?.away?.name || 'Terrorists'

	// Define statistics structure
	const stats = {
		generatedAt: new Date().toISOString(),
		matchTotals: {
			roundsObserved: 0,
			mapsObserved: 0,
			kills: 0,
			deaths: 0,
			firstKills: 0,
			firstDeaths: 0,
			bombPlants: 0,
			bombDefuses: 0,
			durationSeconds: 0
		},
		teams: {
			home: {
				name: homeTeamName,
				roundsWon: 0,
				kills: 0,
				deaths: 0,
				bombPlants: 0,
				bombDefuses: 0
			},
			away: {
				name: awayTeamName,
				roundsWon: 0,
				kills: 0,
				deaths: 0,
				bombPlants: 0,
				bombDefuses: 0
			}
		},
		players: {},
		maps: {}
	}

	// Read timeline events
	let timelineEvents = []
	if (fs.existsSync(timelinePath)) {
		try {
			const content = fs.readFileSync(timelinePath, 'utf8')
			timelineEvents = content
				.split('\n')
				.filter(Boolean)
				.map((line, idx) => {
					try {
						return JSON.parse(line)
					} catch (err) {
						console.warn(`[StatsAggregator] Skipping malformed timeline event at line ${idx + 1} inside session ${sessionId}:`, err.message)
						return null
					}
				})
				.filter(Boolean)
		} catch (err) {
			console.warn(`[StatsAggregator] Error reading timeline.jsonl for ${sessionId}:`, err.message)
		}
	}

	// Read snapshots
	let snapshots = []
	if (fs.existsSync(snapshotsPath)) {
		try {
			const content = fs.readFileSync(snapshotsPath, 'utf8')
			snapshots = content
				.split('\n')
				.filter(Boolean)
				.map((line, idx) => {
					try {
						return JSON.parse(line)
					} catch (err) {
						console.warn(`[StatsAggregator] Skipping malformed snapshot at line ${idx + 1} inside session ${sessionId}:`, err.message)
						return null
					}
				})
				.filter(Boolean)
		} catch (err) {
			console.warn(`[StatsAggregator] Error reading snapshots.jsonl for ${sessionId}:`, err.message)
		}
	}

	// 1. Process Timeline Events
	let lastLiveStartedAt = null
	let roundHasKill = false
	let roundHasDeath = false
	const mapsObservedSet = new Set()

	for (const event of timelineEvents) {
		const mapName = event.map || null
		const roundNumber = event.round ?? 0
		
		if (mapName) {
			mapsObservedSet.add(mapName)
			if (!stats.maps[mapName]) {
				stats.maps[mapName] = {
					roundsPlayed: 0,
					homeScore: 0,
					awayScore: 0
				}
			}
		}

		switch (event.type) {
			case 'round/freezetime_started':
				roundHasKill = false
				roundHasDeath = false
				break

			case 'round/live_started':
				lastLiveStartedAt = new Date(event.at).getTime()
				roundHasKill = false
				roundHasDeath = false
				break

			case 'round/over':
				if (lastLiveStartedAt) {
					const endTime = new Date(event.at).getTime()
					stats.matchTotals.durationSeconds += Math.max(0, (endTime - lastLiveStartedAt) / 1000)
					lastLiveStartedAt = null
				}
				
				stats.matchTotals.roundsObserved = Math.max(stats.matchTotals.roundsObserved, roundNumber)
				if (mapName && stats.maps[mapName]) {
					stats.maps[mapName].roundsPlayed = Math.max(stats.maps[mapName].roundsPlayed, roundNumber)
				}
				break

			case 'bomb/planted':
				stats.matchTotals.bombPlants++
				if (event.actor?.steamid) {
					if (!stats.players[event.actor.steamid]) {
						stats.players[event.actor.steamid] = createPlayerStatObj(event.actor.name, event.actor.team)
					}
					stats.players[event.actor.steamid].bombPlants++
				}
				break

			case 'bomb/defused':
				stats.matchTotals.bombDefuses++
				if (event.actor?.steamid) {
					if (!stats.players[event.actor.steamid]) {
						stats.players[event.actor.steamid] = createPlayerStatObj(event.actor.name, event.actor.team)
					}
					stats.players[event.actor.steamid].bombDefuses++
				}
				break

			case 'player/kill':
				const killCount = Number(event.data?.count) || 1
				stats.matchTotals.kills += killCount
				
				const killer = event.actor
				if (killer && killer.steamid) {
					if (!stats.players[killer.steamid]) {
						stats.players[killer.steamid] = createPlayerStatObj(killer.name, killer.team)
					}
					
					stats.players[killer.steamid].kills += killCount
					
					// First Kill in round
					if (!roundHasKill) {
						stats.players[killer.steamid].firstKills++
						stats.matchTotals.firstKills++
						roundHasKill = true
					}
				}
				break

			case 'player/death':
				const deathCount = Number(event.data?.count) || 1
				stats.matchTotals.deaths += deathCount
				
				const victim = event.target
				if (victim && victim.steamid) {
					if (!stats.players[victim.steamid]) {
						stats.players[victim.steamid] = createPlayerStatObj(victim.name, victim.team)
					}
					
					stats.players[victim.steamid].deaths += deathCount
					
					// First Death in round
					if (!roundHasDeath) {
						stats.players[victim.steamid].firstDeaths++
						stats.matchTotals.firstDeaths++
						roundHasDeath = true
					}
				}
				break
		}
	}

	stats.matchTotals.mapsObserved = mapsObservedSet.size

	// 2. Consolidate Assists, MVPs and Scores from Snapshots
	const latestPlayerSnapshots = {}
	let latestScores = { ct: 0, t: 0 }
	let homeStartingSide = 'CT' // Default assumption if names are generic
	let resolvedHomeSide = 'CT'

	for (const snap of snapshots) {
		if (snap.score) {
			latestScores = snap.score
		}
		
		const currentRound = snap.round ?? 0
		
		// Attempt to resolve home side based on matching team names
		if (snap.teams) {
			if (matchTeamName(homeTeamName, snap.teams.ct?.name) || matchTeamName(awayTeamName, snap.teams.t?.name)) {
				resolvedHomeSide = 'CT'
			} else if (matchTeamName(homeTeamName, snap.teams.t?.name) || matchTeamName(awayTeamName, snap.teams.ct?.name)) {
				resolvedHomeSide = 'T'
			} else {
				// Default to MR12 halftime progression
				resolvedHomeSide = getSideInRound(homeStartingSide, currentRound)
			}
		}

		if (snap.players && Array.isArray(snap.players)) {
			for (const p of snap.players) {
				if (!p.steamid) continue
				
				let resolvedTeam = 'home'
				if (p.team) {
					const upperSide = String(p.team).toUpperCase()
					resolvedTeam = (upperSide === resolvedHomeSide) ? 'home' : 'away'
				}

				latestPlayerSnapshots[p.steamid] = {
					name: p.name,
					team: resolvedTeam,
					assists: p.assists ?? 0,
					mvps: p.mvps ?? 0
				}
			}
		}
		
		// Map scores updates
		const mapName = snap.map
		if (mapName && stats.maps[mapName] && snap.score) {
			stats.maps[mapName].homeScore = resolvedHomeSide === 'CT' ? snap.score.ct : snap.score.t
			stats.maps[mapName].awayScore = resolvedHomeSide === 'CT' ? snap.score.t : snap.score.ct
		}
	}

	// Update overall team scores
	stats.teams.home.roundsWon = resolvedHomeSide === 'CT' ? latestScores.ct : latestScores.t
	stats.teams.away.roundsWon = resolvedHomeSide === 'CT' ? latestScores.t : latestScores.ct

	// 3. Integrate snapshots back into stats players structure
	for (const [steamid, snapData] of Object.entries(latestPlayerSnapshots)) {
		if (!stats.players[steamid]) {
			stats.players[steamid] = createPlayerStatObj(snapData.name, snapData.team)
		}
		
		stats.players[steamid].name = snapData.name || stats.players[steamid].name
		stats.players[steamid].team = snapData.team || stats.players[steamid].team
		
		stats.players[steamid].assists = snapData.assists
		stats.players[steamid].assistsSource = 'snapshot'
		
		stats.players[steamid].mvps = snapData.mvps
		stats.players[steamid].mvpsSource = 'snapshot'
	}

	// 4. Finalize K/D, missing fallbacks and team cumulative stats
	for (const [, p] of Object.entries(stats.players)) {
		p.kdRatio = +(p.kills / Math.max(1, p.deaths)).toFixed(2)
		
		if (p.assists === null) {
			p.assists = 0
			p.assistsSource = 'unavailable'
		}
		if (p.mvps === null) {
			p.mvps = 0
			p.mvpsSource = 'unavailable'
		}
		
		// Accumulate team totals
		const tKey = p.team === 'away' ? 'away' : 'home'
		if (stats.teams[tKey]) {
			stats.teams[tKey].kills += p.kills
			stats.teams[tKey].deaths += p.deaths
			stats.teams[tKey].bombPlants += p.bombPlants || 0
			stats.teams[tKey].bombDefuses += p.bombDefuses || 0
		}
	}

	// Write stats.json synchronously
	const statsPath = path.join(sPath, 'stats.json')
	try {
		fs.writeFileSync(statsPath, JSON.stringify(stats, null, '\t'), 'utf8')
	} catch (err) {
		console.warn(`[StatsAggregator] Failed to write stats.json for ${sessionId}:`, err.message)
	}
	
	// Update events count in summary.json
	updateSessionSummary(sessionId, { eventsRecorded: timelineEvents.length })
	
	console.info(`[StatsAggregator] Rebuilt statistics successfully for session "${sessionId}".`)
	return stats
}

/**
 * Creates a standard player statistic template
 */
function createPlayerStatObj(name, team = 'home') {
	const resolvedTeam = (team === 'away' || String(team).toLowerCase() === 'away') ? 'away' : 'home'
	return {
		name: name || 'Player',
		team: resolvedTeam,
		kills: 0,
		killsConfidence: 'derived',
		deaths: 0,
		deathsConfidence: 'derived',
		assists: null,
		assistsSource: null,
		mvps: null,
		mvpsSource: null,
		kdRatio: 0,
		firstKills: 0,
		firstDeaths: 0,
		bombPlants: 0,
		bombDefuses: 0
	}
}

/**
 * Triggers statistics updates incrementally inside session-store.js hooks
 */
export function updateSessionStatsIncremental(sessionId) {
	try {
		rebuildSessionStats(sessionId)
	} catch (err) {
		console.warn(`[StatsAggregator] Warning: Failed to incrementally update stats for ${sessionId}:`, err.message)
	}
}

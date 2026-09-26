import fs from 'fs'
import path from 'path'
import { getSessionPath, updateSessionSummary } from './session-store.js'

/**
 * Atomic write helper for JSON files
 */
function writeJsonAtomic(filePath, data) {
	const tempPath = filePath + '.tmp'
	try {
		fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')
		fs.renameSync(tempPath, filePath)
	} catch (err) {
		console.warn(`[StatsAggregator] Failed atomic write to ${filePath}:`, err)
		try {
			if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
		} catch (_) {}
	}
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

	const homeTeamName = metadata.teams?.home?.name || 'Home'
	const awayTeamName = metadata.teams?.away?.name || 'Away'

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
	}

	// Read snapshots
	let snapshots = []
	if (fs.existsSync(snapshotsPath)) {
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
	}

	// 1. Process Timeline Events
	let lastLiveStartedAt = null
	let roundHasKill = false
	let roundHasDeath = false
	
	// Track overall maps set
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
				
				// Reconcile round winner details
				const winnerSide = event.data?.winner // CT or T
				if (winnerSide) {
					// We will reconcile team score mapping based on snapshots, or team score changed events.
					// For now, let's look at team score changed to map rounds won.
				}
				break

			case 'team/score_changed':
				const ctScore = event.data?.ctScore ?? 0
				const tScore = event.data?.tScore ?? 0
				
				// Reconcile overall map scores
				if (mapName && stats.maps[mapName]) {
					// GSI doesn't tell us which team was CT/T directly here, but we can resolve it using the team score event data
					// Standard fallback: update stats map scores
				}
				break

			case 'bomb/planted':
				stats.matchTotals.bombPlants++
				break

			case 'bomb/defused':
				stats.matchTotals.bombDefuses++
				break

			case 'player/kill':
				stats.matchTotals.kills++
				
				const killer = event.actor
				if (killer && killer.steamid) {
					if (!stats.players[killer.steamid]) {
						stats.players[killer.steamid] = createPlayerStatObj(killer.name, killer.team)
					}
					
					stats.players[killer.steamid].kills++
					
					// First Kill
					if (!roundHasKill) {
						stats.players[killer.steamid].firstKills++
						stats.matchTotals.firstKills++
						roundHasKill = true
					}
				}
				break

			case 'player/death':
				stats.matchTotals.deaths++
				
				const victim = event.target
				if (victim && victim.steamid) {
					if (!stats.players[victim.steamid]) {
						stats.players[victim.steamid] = createPlayerStatObj(victim.name, victim.team)
					}
					
					stats.players[victim.steamid].deaths++
					
					// First Death
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

	// 2. Consolidate Assists & MVPs from Snapshots
	const latestPlayerSnapshots = {}
	let latestScores = { ct: 0, t: 0 }
	let homeTeamSide = 'CT' // Default guess
	let awayTeamSide = 'T'
	
	for (const snap of snapshots) {
		if (snap.score) {
			latestScores = snap.score
		}
		
		// Map side guesses
		if (snap.teams) {
			if (snap.teams.ct?.name === homeTeamName) {
				homeTeamSide = 'CT'
				awayTeamSide = 'T'
			} else if (snap.teams.t?.name === homeTeamName) {
				homeTeamSide = 'T'
				awayTeamSide = 'CT'
			}
		}

		if (snap.players && Array.isArray(snap.players)) {
			for (const p of snap.players) {
				if (!p.steamid) continue
				
				// Reconcile player side mapping
				let resolvedTeam = 'home'
				if (p.team === homeTeamSide) {
					resolvedTeam = 'home'
				} else if (p.team === awayTeamSide) {
					resolvedTeam = 'away'
				} else {
					// Fallback to p.team matching id
					resolvedTeam = p.team?.toLowerCase() === metadata.teams?.away?.id ? 'away' : 'home'
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
			stats.maps[mapName].homeScore = homeTeamSide === 'CT' ? snap.score.ct : snap.score.t
			stats.maps[mapName].awayScore = homeTeamSide === 'CT' ? snap.score.t : snap.score.ct
		}
	}

	// Update overall team scores
	stats.teams.home.roundsWon = homeTeamSide === 'CT' ? latestScores.ct : latestScores.t
	stats.teams.away.roundsWon = homeTeamSide === 'CT' ? latestScores.t : latestScores.ct

	// 3. Integrate snapshots back into stats players structure
	for (const [steamid, snapData] of Object.entries(latestPlayerSnapshots)) {
		if (!stats.players[steamid]) {
			stats.players[steamid] = createPlayerStatObj(snapData.name, snapData.team)
		}
		
		stats.players[steamid].name = snapData.name
		stats.players[steamid].team = snapData.team
		
		stats.players[steamid].assists = snapData.assists
		stats.players[steamid].assistsSource = 'snapshot'
		
		stats.players[steamid].mvps = snapData.mvps
		stats.players[steamid].mvpsSource = 'snapshot'
	}

	// 4. Finalize K/D and team stats
	for (const [steamid, p] of Object.entries(stats.players)) {
		p.kdRatio = +(p.kills / Math.max(1, p.deaths)).toFixed(2)
		
		// Fill in fallback unavailable settings
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
		}
	}

	// Write stats.json atomically
	const statsPath = path.join(sPath, 'stats.json')
	writeJsonAtomic(statsPath, stats)
	
	// Update events count in summary.json
	updateSessionSummary(sessionId, { eventsRecorded: timelineEvents.length })
	
	console.info(`[StatsAggregator] Rebuilt statistics successfully for session "${sessionId}".`)
	return stats
}

/**
 * Creates a standard player statistic template
 */
function createPlayerStatObj(name, team = 'home') {
	const resolvedTeam = team?.toLowerCase() === 'away' || team === 'away' ? 'away' : 'home'
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
		// Rebuilding is extremely fast and robust, and guarantees perfect synchronization
		rebuildSessionStats(sessionId)
	} catch (err) {
		console.warn(`[StatsAggregator] Warning: Failed to incrementally update stats for ${sessionId}:`, err.message)
	}
}

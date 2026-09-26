import fs from 'fs'
import path from 'path'
import { gsiState } from '../state.js'
import {
	getActiveSession,
	appendTimelineEvent,
	appendSnapshot,
	updateSessionSummary,
	getSessionPath
} from './session-store.js'

// Lightweight previous-state cache
const lastState = {
	isInitialized: false,
	gsiActive: false,
	mapName: null,
	mapPhase: null,
	roundPhase: null,
	roundNumber: -1,
	bombState: null,
	teamScores: {
		CT: 0,
		T: 0
	},
	playerKills: {},  // steamid -> cumulative kills
	playerDeaths: {}  // steamid -> cumulative deaths
}

/**
 * Atomic write helper to write JSON files cleanly
 */
function writeJsonAtomic(filePath, data) {
	const tempPath = filePath + '.tmp'
	try {
		fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')
		fs.renameSync(tempPath, filePath)
	} catch (err) {
		console.warn(`[TimelineRecorder] Failed atomic write to ${filePath}:`, err)
		try {
			if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
		} catch (_) {}
	}
}

/**
 * Builds a standard event envelope
 */
function createEventEnvelope(type, actor, target, team, data = {}) {
	const mapObj = gsiState.map || {}
	const roundObj = gsiState.round || {}
	const phaseObj = gsiState.phase_countdowns || {}
	
	return {
		id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
		type,
		at: new Date().toISOString(),
		gsiClock: phaseObj.countdown ?? null,
		map: mapObj.name || null,
		round: mapObj.round ?? 0,
		phase: phaseObj.phase || roundObj.phase || null,
		actor,
		target,
		team,
		data
	}
}

/**
 * Builds a standard snapshot envelope
 */
function createSnapshotEnvelope(reason, body) {
	const mapObj = body.map || {}
	const roundObj = body.round || {}
	const bombObj = body.bomb || {}
	
	const players = []
	if (body.allplayers) {
		for (const [steamid, p] of Object.entries(body.allplayers)) {
			if (!p) continue
			players.push({
				steamid,
				name: p.name,
				team: p.team,
				health: p.state?.health ?? 0,
				money: p.state?.money ?? 0,
				kills: p.match_stats?.kills ?? 0,
				deaths: p.match_stats?.deaths ?? 0,
				assists: p.match_stats?.assists ?? 0,
				mvps: p.match_stats?.mvps ?? 0
			})
		}
	}
	
	return {
		at: new Date().toISOString(),
		reason,
		map: mapObj.name || null,
		round: mapObj.round ?? 0,
		teams: {
			ct: {
				name: mapObj.team_ct?.name || 'Counter-Terrorists',
				score: mapObj.team_ct?.score ?? 0
			},
			t: {
				name: mapObj.team_t?.name || 'Terrorists',
				score: mapObj.team_t?.score ?? 0
			}
		},
		players,
		score: {
			ct: mapObj.team_ct?.score ?? 0,
			t: mapObj.team_t?.score ?? 0
		},
		bomb: bombObj.state || null,
		phase: mapObj.phase || roundObj.phase || null
	}
}

/**
 * Explicitly records session start event
 */
export function recordSessionStart(sessionId, metadata) {
	try {
		const event = createEventEnvelope('match/session_started', null, null, null, { metadata })
		appendTimelineEvent(sessionId, event)
	} catch (err) {
		console.warn('[TimelineRecorder] Failed to record session start event:', err)
	}
}

/**
 * Explicitly records session end event
 */
export function recordSessionEnd(sessionId) {
	try {
		const event = createEventEnvelope('match/session_ended', null, null, null, {})
		appendTimelineEvent(sessionId, event)
		
		const snapshot = createSnapshotEnvelope('session_end', gsiState)
		appendSnapshot(sessionId, snapshot)
	} catch (err) {
		console.warn('[TimelineRecorder] Failed to record session end event:', err)
	}
}

/**
 * Heartbeat stale checker hook
 */
export function recordGsiStale() {
	try {
		const active = getActiveSession()
		if (!active) return
		
		if (lastState.gsiActive) {
			const event = createEventEnvelope('gsi/stale', null, null, null, {})
			appendTimelineEvent(active.id, event)
			lastState.gsiActive = false
		}
	} catch (err) {
		console.warn('[TimelineRecorder] Failed to record GSI stale event:', err)
	}
}

/**
 * Ingestion entry point called on each GSI tick in gsi.js
 */
export function processGsiFrame(body = {}) {
	try {
		const active = getActiveSession()
		if (!active) return // No active session, no-op safely!
		
		// 1. Initialize previous-state cache on the very first frame to prevent massive noise
		if (!lastState.isInitialized) {
			lastState.mapName = body.map?.name || null
			lastState.mapPhase = body.map?.phase || null
			lastState.roundPhase = body.round?.phase || null
			lastState.roundNumber = body.map?.round ?? -1
			lastState.bombState = body.bomb?.state || null
			lastState.teamScores.CT = body.map?.team_ct?.score || 0
			lastState.teamScores.T = body.map?.team_t?.score || 0
			
			if (body.allplayers) {
				for (const [steamid, p] of Object.entries(body.allplayers)) {
					if (!p) continue
					lastState.playerKills[steamid] = p.match_stats?.kills ?? 0
					lastState.playerDeaths[steamid] = p.match_stats?.deaths ?? 0
				}
			}
			
			lastState.gsiActive = true
			lastState.isInitialized = true
			
			// Record initial map if present
			if (lastState.mapName) {
				const event = createEventEnvelope('map/map_changed', null, null, null, {
					map: lastState.mapName,
					previousMap: null
				})
				appendTimelineEvent(active.id, event)
				
				// Write initial map file
				const mapsPath = path.join(getSessionPath(active.id), 'maps.json')
				if (fs.existsSync(mapsPath)) {
					try {
						const mapsList = JSON.parse(fs.readFileSync(mapsPath, 'utf8') || '[]')
						if (!mapsList.includes(lastState.mapName)) {
							mapsList.push(lastState.mapName)
							writeJsonAtomic(mapsPath, mapsList)
							updateSessionSummary(active.id, { mapsObserved: mapsList.length })
						}
					} catch (_) {}
				}
			}
			return
		}
		
		// 2. Stale/Resumed transition
		if (!lastState.gsiActive) {
			const event = createEventEnvelope('gsi/resumed', null, null, null, {})
			appendTimelineEvent(active.id, event)
			lastState.gsiActive = true
		}
		
		// 3. Map changed transition
		const currentMapName = body.map?.name || null
		const mapChanged = currentMapName !== lastState.mapName
		if (mapChanged && currentMapName !== null) {
			const event = createEventEnvelope('map/map_changed', null, null, null, {
				map: currentMapName,
				previousMap: lastState.mapName
			})
			appendTimelineEvent(active.id, event)
			
			// Create a snapshot for map change
			const snapshot = createSnapshotEnvelope('map_change', body)
			appendSnapshot(active.id, snapshot)
			
			// Clear player stats tracking to prevent cross-map bleed
			lastState.playerKills = {}
			lastState.playerDeaths = {}
			
			// Add map name to maps.json list
			const sPath = getSessionPath(active.id)
			if (sPath) {
				const mapsPath = path.join(sPath, 'maps.json')
				try {
					const mapsList = JSON.parse(fs.readFileSync(mapsPath, 'utf8') || '[]')
					if (!mapsList.includes(currentMapName)) {
						mapsList.push(currentMapName)
						writeJsonAtomic(mapsPath, mapsList)
						updateSessionSummary(active.id, { mapsObserved: mapsList.length })
					}
				} catch (_) {}
			}
			
			lastState.mapName = currentMapName
		}
		
		// 4. Round Freezetime transition
		const currentRoundPhase = body.round?.phase || null
		if (currentRoundPhase === 'freezetime' && lastState.roundPhase !== 'freezetime') {
			const event = createEventEnvelope('round/freezetime_started', null, null, null, {
				round: body.map?.round ?? 0
			})
			appendTimelineEvent(active.id, event)
			lastState.roundPhase = 'freezetime'
		}
		
		// 5. Round Live transition
		if (currentRoundPhase === 'live' && lastState.roundPhase !== 'live') {
			const event = createEventEnvelope('round/live_started', null, null, null, {
				round: body.map?.round ?? 0
			})
			appendTimelineEvent(active.id, event)
			lastState.roundPhase = 'live'
		}
		
		// 6. Round Over transition
		if (currentRoundPhase === 'over' && lastState.roundPhase !== 'over') {
			const roundNum = body.map?.round ?? 0
			const winner = body.round?.win_team || null
			const event = createEventEnvelope('round/over', null, null, null, {
				round: roundNum,
				winner,
				score: {
					ct: body.map?.team_ct?.score ?? 0,
					t: body.map?.team_t?.score ?? 0
				}
			})
			appendTimelineEvent(active.id, event)
			
			// Append round over snapshot
			const snapshot = createSnapshotEnvelope('round_over', body)
			appendSnapshot(active.id, snapshot)
			
			// Update rounds count in summary
			updateSessionSummary(active.id, { roundsObserved: roundNum })
			
			lastState.roundPhase = 'over'
		}
		
		// 7. Bomb state transitions
		const currentBombState = body.bomb?.state || null
		if (currentBombState !== lastState.bombState) {
			if (currentBombState === 'planted') {
				const event = createEventEnvelope('bomb/planted', null, null, null, {
					site: body.bomb?.site || null
				})
				appendTimelineEvent(active.id, event)
			} else if (currentBombState === 'defused') {
				const event = createEventEnvelope('bomb/defused', null, null, null, {})
				appendTimelineEvent(active.id, event)
			} else if (currentBombState === 'exploded') {
				const event = createEventEnvelope('bomb/exploded', null, null, null, {})
				appendTimelineEvent(active.id, event)
			}
			lastState.bombState = currentBombState
		}
		
		// 8. Team score transitions
		const ctScore = body.map?.team_ct?.score ?? 0
		const tScore = body.map?.team_t?.score ?? 0
		if (ctScore !== lastState.teamScores.CT || tScore !== lastState.teamScores.T) {
			const event = createEventEnvelope('team/score_changed', null, null, null, {
				ctScore,
				tScore,
				previousScores: { ...lastState.teamScores }
			})
			appendTimelineEvent(active.id, event)
			lastState.teamScores.CT = ctScore
			lastState.teamScores.T = tScore
		}
		
		// 9. Player kills and deaths telemetry (highly conservative)
		if (body.allplayers) {
			for (const [steamid, p] of Object.entries(body.allplayers)) {
				if (!p) continue
				
				const curKills = p.match_stats?.kills ?? 0
				const curDeaths = p.match_stats?.deaths ?? 0
				
				if (lastState.playerKills[steamid] === undefined) {
					// Conservative: initialize silently to current count, never trigger joining/spurious events
					lastState.playerKills[steamid] = curKills
					lastState.playerDeaths[steamid] = curDeaths
				} else {
					const prevKills = lastState.playerKills[steamid]
					const prevDeaths = lastState.playerDeaths[steamid]
					
					if (curKills > prevKills) {
						const event = createEventEnvelope(
							'player/kill',
							{ steamid, name: p.name, team: p.team },
							null,
							p.team || null,
							{
								confidence: 'derived',
								currentKills: curKills,
								count: curKills - prevKills
							}
						)
						appendTimelineEvent(active.id, event)
						lastState.playerKills[steamid] = curKills
					}
					
					if (curDeaths > prevDeaths) {
						const event = createEventEnvelope(
							'player/death',
							null,
							{ steamid, name: p.name, team: p.team },
							p.team || null,
							{
								confidence: 'derived',
								currentDeaths: curDeaths,
								count: curDeaths - prevDeaths
							}
						)
						appendTimelineEvent(active.id, event)
						lastState.playerDeaths[steamid] = curDeaths
					}
				}
			}
		}
		
	} catch (err) {
		console.warn('[TimelineRecorder] Error processing GSI frame safely:', err)
	}
}

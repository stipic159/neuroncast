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

// Previous-state cache bound to the active session
const lastState = {
	sessionId: null,
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
	playerKills: {},   // steamid -> cumulative kills
	playerDeaths: {},  // steamid -> cumulative deaths
	knownMaps: new Set()
}

/**
 * Resets the in-memory timeline state for a session.
 */
export function resetTimelineState(sessionId = null) {
	lastState.sessionId = sessionId
	lastState.isInitialized = false
	lastState.gsiActive = false
	lastState.mapName = null
	lastState.mapPhase = null
	lastState.roundPhase = null
	lastState.roundNumber = -1
	lastState.bombState = null
	lastState.teamScores = { CT: 0, T: 0 }
	lastState.playerKills = {}
	lastState.playerDeaths = {}
	lastState.knownMaps.clear()
}

/**
 * Builds a standard event envelope.
 * Uses gsiState for fallback contextual data (clock, round, map, phase).
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
 * Builds a standard snapshot envelope.
 * Falls back to accumulated gsiState for any omitted delta properties in body.
 */
function createSnapshotEnvelope(reason, body = {}) {
	const mapObj = body.map || gsiState.map || {}
	const roundObj = body.round || gsiState.round || {}
	const bombObj = body.bomb || gsiState.bomb || {}
	const allplayersObj = body.allplayers || gsiState.allplayers || {}
	
	const players = []
	for (const [steamid, p] of Object.entries(allplayersObj)) {
		if (!p) continue
		players.push({
			steamid,
			name: p.name || 'Unknown',
			team: p.team || null,
			health: p.state?.health ?? 0,
			money: p.state?.money ?? 0,
			kills: p.match_stats?.kills ?? 0,
			deaths: p.match_stats?.deaths ?? 0,
			assists: p.match_stats?.assists ?? 0,
			mvps: p.match_stats?.mvps ?? 0
		})
	}
	
	const ctScore = mapObj.team_ct?.score ?? 0
	const tScore = mapObj.team_t?.score ?? 0

	return {
		at: new Date().toISOString(),
		reason,
		map: mapObj.name || null,
		round: mapObj.round ?? 0,
		teams: {
			ct: {
				name: mapObj.team_ct?.name || 'Counter-Terrorists',
				score: ctScore
			},
			t: {
				name: mapObj.team_t?.name || 'Terrorists',
				score: tScore
			}
		},
		players,
		score: {
			ct: ctScore,
			t: tScore
		},
		bomb: bombObj.state || null,
		phase: mapObj.phase || roundObj.phase || null
	}
}

/**
 * Synchronously registers a map name into maps.json and updates session summary.
 */
function registerObservedMap(sessionId, mapName) {
	if (!sessionId || !mapName) return
	if (lastState.knownMaps.has(mapName)) return
	lastState.knownMaps.add(mapName)

	const sPath = getSessionPath(sessionId)
	if (!sPath) return

	try {
		const mapsPath = path.join(sPath, 'maps.json')
		let list = []
		if (fs.existsSync(mapsPath)) {
			try {
				list = JSON.parse(fs.readFileSync(mapsPath, 'utf8'))
			} catch (_) {}
		}
		if (!Array.isArray(list)) list = []
		if (!list.includes(mapName)) {
			list.push(mapName)
			fs.writeFileSync(mapsPath, JSON.stringify(list, null, '\t'), 'utf8')
			updateSessionSummary(sessionId, { mapsObserved: list.length })
		}
	} catch (err) {
		console.warn(`[TimelineRecorder] Failed to persist map "${mapName}" for session "${sessionId}":`, err.message)
	}
}

/**
 * Explicitly records session start event and resets recorder state.
 */
export function recordSessionStart(sessionId, metadata) {
	try {
		resetTimelineState(sessionId)
		const event = createEventEnvelope('match/session_started', null, null, null, { metadata })
		appendTimelineEvent(sessionId, event)
	} catch (err) {
		console.warn('[TimelineRecorder] Failed to record session start event:', err)
	}
}

/**
 * Explicitly records session end event and creates final snapshot.
 */
export function recordSessionEnd(sessionId) {
	try {
		const event = createEventEnvelope('match/session_ended', null, null, null, {})
		appendTimelineEvent(sessionId, event)
		
		const snapshot = createSnapshotEnvelope('session_end', gsiState)
		appendSnapshot(sessionId, snapshot)
		resetTimelineState(null)
	} catch (err) {
		console.warn('[TimelineRecorder] Failed to record session end event:', err)
	}
}

/**
 * Heartbeat stale checker hook.
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
		if (!active) return // No active session, no-op safely

		// Detect session switch or fresh start
		if (lastState.sessionId !== active.id) {
			resetTimelineState(active.id)
		}
		
		// 1. Initialize previous-state cache on the very first frame to prevent noise
		if (!lastState.isInitialized) {
			const mapObj = body.map || gsiState.map || {}
			const roundObj = body.round || gsiState.round || {}
			const bombObj = body.bomb || gsiState.bomb || {}
			const allplayersObj = body.allplayers || gsiState.allplayers || {}

			lastState.mapName = mapObj.name || null
			lastState.mapPhase = mapObj.phase || null
			lastState.roundPhase = roundObj.phase || null
			lastState.roundNumber = mapObj.round ?? -1
			lastState.bombState = bombObj.state || null
			lastState.teamScores.CT = mapObj.team_ct?.score ?? 0
			lastState.teamScores.T = mapObj.team_t?.score ?? 0
			
			for (const [steamid, p] of Object.entries(allplayersObj)) {
				if (!p || !steamid || steamid === '0') continue
				lastState.playerKills[steamid] = p.match_stats?.kills ?? 0
				lastState.playerDeaths[steamid] = p.match_stats?.deaths ?? 0
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
				registerObservedMap(active.id, lastState.mapName)
			}
			return
		}
		
		// 2. Stale/Resumed transition
		if (!lastState.gsiActive) {
			const event = createEventEnvelope('gsi/resumed', null, null, null, {})
			appendTimelineEvent(active.id, event)
			lastState.gsiActive = true
		}
		
		// 3. Map changed transition (only when map data is explicitly present)
		if (body.map && body.map.name !== undefined) {
			const currentMapName = body.map.name || null
			const mapChanged = currentMapName !== lastState.mapName
			if (mapChanged && currentMapName !== null) {
				const event = createEventEnvelope('map/map_changed', null, null, null, {
					map: currentMapName,
					previousMap: lastState.mapName
				})
				appendTimelineEvent(active.id, event)
				
				// Snapshot on map change
				const snapshot = createSnapshotEnvelope('map_change', body)
				appendSnapshot(active.id, snapshot)
				
				// Clear player stats tracking to prevent cross-map bleed
				lastState.playerKills = {}
				lastState.playerDeaths = {}
				lastState.teamScores = { CT: 0, T: 0 }
				lastState.bombState = null
				
				registerObservedMap(active.id, currentMapName)
				lastState.mapName = currentMapName
			}
		}
		
		// 4. Round Freezetime transition
		const currentRoundPhase = body.round?.phase
		if (currentRoundPhase) {
			const roundNum = body.map?.round ?? gsiState.map?.round ?? 0

			if (currentRoundPhase === 'freezetime' && lastState.roundPhase !== 'freezetime') {
				const event = createEventEnvelope('round/freezetime_started', null, null, null, {
					round: roundNum
				})
				appendTimelineEvent(active.id, event)
				lastState.roundPhase = 'freezetime'
				lastState.bombState = null // Reset bomb state for the new round
			}
			
			// 5. Round Live transition
			if (currentRoundPhase === 'live' && lastState.roundPhase !== 'live') {
				const event = createEventEnvelope('round/live_started', null, null, null, {
					round: roundNum
				})
				appendTimelineEvent(active.id, event)
				lastState.roundPhase = 'live'
			}
			
			// 6. Round Over transition
			if (currentRoundPhase === 'over' && lastState.roundPhase !== 'over') {
				const winner = body.round?.win_team || null
				const event = createEventEnvelope('round/over', null, null, null, {
					round: roundNum,
					winner,
					score: {
						ct: body.map?.team_ct?.score ?? gsiState.map?.team_ct?.score ?? 0,
						t: body.map?.team_t?.score ?? gsiState.map?.team_t?.score ?? 0
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
		}
		
		// 7. Bomb state transitions (only when bomb object is present in frame)
		if (body.bomb && body.bomb.state !== undefined) {
			const currentBombState = body.bomb.state || null
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
		}
		
		// 8. Team score transitions (guard against delta ticks without map object)
		if (body.map?.team_ct?.score !== undefined && body.map?.team_t?.score !== undefined) {
			const ctScore = Number(body.map.team_ct.score)
			const tScore = Number(body.map.team_t.score)
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
		}
		
		// 9. Player kills and deaths telemetry
		if (body.allplayers) {
			for (const [steamid, p] of Object.entries(body.allplayers)) {
				if (!p || !steamid || steamid === '0') continue
				
				const curKills = p.match_stats?.kills ?? 0
				const curDeaths = p.match_stats?.deaths ?? 0
				
				if (lastState.playerKills[steamid] === undefined) {
					// Conservative initialization: silently register baseline without spurious events
					lastState.playerKills[steamid] = curKills
					lastState.playerDeaths[steamid] = curDeaths
				} else {
					const prevKills = lastState.playerKills[steamid]
					const prevDeaths = lastState.playerDeaths[steamid]
					
					// Detect game/round restart or warmup reset: re-baseline without firing negative/corrupt events
					if (curKills < prevKills) {
						lastState.playerKills[steamid] = curKills
					} else if (curKills > prevKills) {
						const killDelta = curKills - prevKills
						const event = createEventEnvelope(
							'player/kill',
							{ steamid, name: p.name, team: p.team },
							null,
							p.team || null,
							{
								confidence: 'derived',
								currentKills: curKills,
								count: killDelta
							}
						)
						appendTimelineEvent(active.id, event)
						lastState.playerKills[steamid] = curKills
					}
					
					if (curDeaths < prevDeaths) {
						lastState.playerDeaths[steamid] = curDeaths
					} else if (curDeaths > prevDeaths) {
						const deathDelta = curDeaths - prevDeaths
						const event = createEventEnvelope(
							'player/death',
							null,
							{ steamid, name: p.name, team: p.team },
							p.team || null,
							{
								confidence: 'derived',
								currentDeaths: curDeaths,
								count: deathDelta
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

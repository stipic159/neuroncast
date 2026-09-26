import fs from 'fs'
import path from 'path'
import { userspaceDirectory } from '../helpers/paths.js'
import { gsiState } from '../state.js'

// We store our sessions in a subfolder "sessions" under userspaceDirectory
const SESSIONS_DIR = path.resolve(userspaceDirectory, 'sessions')

// Keep activeSessionId in memory
let activeSessionId = null
let hasScannedActive = false

/**
 * Ensures the sessions directory exists
 */
function ensureSessionsDir() {
	try {
		if (!fs.existsSync(SESSIONS_DIR)) {
			fs.mkdirSync(SESSIONS_DIR, { recursive: true })
		}
	} catch (err) {
		console.warn('[SessionStore] Failed to create sessions root directory:', err)
	}
}

/**
 * Sanitizes team names for session folder slug format
 */
function sanitizeSlugPart(str) {
	if (!str) return 'unknown'
	return str
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, '-') // Replace non-alphanumeric/underscore/hyphen with hyphen
		.replace(/-+/g, '-')          // Collapse consecutive hyphens
		.replace(/^-+|-+$/g, '')     // Trim leading/trailing hyphens
}

/**
 * Atomic write helper for JSON files
 */
function writeJsonAtomic(filePath, data) {
	const tempPath = filePath + '.tmp'
	try {
		fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')
		fs.renameSync(tempPath, filePath)
	} catch (err) {
		console.warn(`[SessionStore] Failed atomic write to ${filePath}:`, err)
		try {
			if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
		} catch (_) {}
		throw err
	}
}

// ── Summary write coalescing ──
// Every recorded timeline event used to read + atomically rewrite summary.json
// synchronously on the request thread, which is costly under high-rate GSI
// ingestion. Instead we keep the active session's summary in memory and flush it
// on a short debounce. Counters stay accurate (accumulated in memory); on-disk
// summary.json is at most SUMMARY_FLUSH_MS stale, which is fine for progress
// telemetry. Pending writes are flushed on session end and process exit so
// nothing is lost.
const SUMMARY_FLUSH_MS = 1500
const summaryCache = new Map()       // sessionId -> summary object (authoritative while cached)
const summaryDirs = new Map()        // sessionId -> session directory path
const summaryFlushTimers = new Map() // sessionId -> debounce timer

function loadSummaryCached(sessionId, sPath) {
	if (summaryCache.has(sessionId)) return summaryCache.get(sessionId)

	let summary = {}
	try {
		const summaryPath = path.join(sPath, 'summary.json')
		if (fs.existsSync(summaryPath)) {
			summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
		}
	} catch (err) {
		console.warn(`[SessionStore] Failed to load summary for ${sessionId}, starting fresh:`, err.message)
	}

	summaryCache.set(sessionId, summary)
	summaryDirs.set(sessionId, sPath)
	return summary
}

function scheduleSummaryFlush(sessionId) {
	if (summaryFlushTimers.has(sessionId)) return
	const timer = setTimeout(() => flushSummary(sessionId), SUMMARY_FLUSH_MS)
	if (timer.unref) timer.unref()
	summaryFlushTimers.set(sessionId, timer)
}

function flushSummary(sessionId) {
	const timer = summaryFlushTimers.get(sessionId)
	if (timer) {
		clearTimeout(timer)
		summaryFlushTimers.delete(sessionId)
	}

	const summary = summaryCache.get(sessionId)
	const sPath = summaryDirs.get(sessionId)
	if (!summary || !sPath) return

	try {
		writeJsonAtomic(path.join(sPath, 'summary.json'), summary)
	} catch (err) {
		console.warn(`[SessionStore] Failed to flush summary for ${sessionId}:`, err.message)
	}
}

function flushAllSummaries() {
	for (const sessionId of summaryCache.keys()) {
		flushSummary(sessionId)
	}
}

// Flush any pending summary writes on process exit (sync writes are safe here).
process.on('exit', flushAllSummaries)

// ── Non-blocking asynchronous event batch queue ──
const writeStreams = new Map() // filePath -> fs.WriteStream

function getOrCreateStream(filePath) {
	if (writeStreams.has(filePath)) return writeStreams.get(filePath)
	const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
	stream.on('error', (err) => console.warn(`[SessionStore] Stream write error on ${filePath}:`, err.message))
	writeStreams.set(filePath, stream)
	return stream
}

function flushAllStreams() {
	for (const [filePath, stream] of writeStreams.entries()) {
		try {
			stream.end()
		} catch (_) {}
	}
	writeStreams.clear()
}

process.on('exit', flushAllStreams)


/**
 * Finds a session path on disk by ID or Slug.
 * Returns null if not found.
 */
export function getSessionPath(sessionId) {
	if (!sessionId) return null
	ensureSessionsDir()
	
	try {
		// First check if it exists directly as a directory (if slug was passed)
		const directPath = path.join(SESSIONS_DIR, sessionId)
		if (fs.existsSync(directPath) && fs.existsSync(path.join(directPath, 'metadata.json'))) {
			return directPath
		}
		
		// Otherwise scan all directories to find matching metadata.id
		const dirs = fs.readdirSync(SESSIONS_DIR)
		for (const dirName of dirs) {
			const dirPath = path.join(SESSIONS_DIR, dirName)
			const metaPath = path.join(dirPath, 'metadata.json')
			if (fs.existsSync(metaPath)) {
				try {
					const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
					if (meta.id === sessionId || meta.slug === sessionId) {
						return dirPath
					}
				} catch (_) {}
			}
		}
	} catch (err) {
		console.warn(`[SessionStore] Error finding session path for ${sessionId}:`, err)
	}
	
	return null
}

/**
 * Creates a new session and sets it as active
 */
export function createSession(metadata = {}) {
	ensureSessionsDir()
	
	try {
		const shortId = Math.random().toString(36).substring(2, 8)
		const id = metadata.id || shortId
		const dateStr = new Date().toISOString().slice(0, 10)
		
		const teamA = sanitizeSlugPart(metadata.teams?.home?.name)
		const teamB = sanitizeSlugPart(metadata.teams?.away?.name)
		const slug = `${dateStr}_${teamA}_vs_${teamB}_${id}`
		
		const sessionDir = path.join(SESSIONS_DIR, slug)
		fs.mkdirSync(sessionDir, { recursive: true })
		
		const finalMetadata = {
			id,
			slug,
			createdAt: metadata.createdAt || new Date().toISOString(),
			endedAt: null,
			status: 'active',
			source: metadata.source || 'operator',
			teams: {
				home: {
					name: metadata.teams?.home?.name || 'Counter-Terrorists',
					id: metadata.teams?.home?.id || 'ct',
					logo: metadata.teams?.home?.logo || ''
				},
				away: {
					name: metadata.teams?.away?.name || 'Terrorists',
					id: metadata.teams?.away?.id || 't',
					logo: metadata.teams?.away?.logo || ''
				}
			},
			match: {
				format: metadata.match?.format || 'BO1',
				eventName: metadata.match?.eventName || 'NeuronCast Match',
				externalMatchId: metadata.match?.externalMatchId || null,
				mapPool: metadata.match?.mapPool || []
			}
		}
		
		const finalSummary = {
			roundsObserved: 0,
			mapsObserved: 0,
			firstGsiAt: null,
			lastGsiAt: null,
			eventsRecorded: 0,
			warnings: []
		}
		
		writeJsonAtomic(path.join(sessionDir, 'metadata.json'), finalMetadata)
		writeJsonAtomic(path.join(sessionDir, 'summary.json'), finalSummary)
		writeJsonAtomic(path.join(sessionDir, 'maps.json'), [])
		
		// Create empty jsonl files
		fs.writeFileSync(path.join(sessionDir, 'timeline.jsonl'), '', 'utf8')
		fs.writeFileSync(path.join(sessionDir, 'snapshots.jsonl'), '', 'utf8')
		
		activeSessionId = id
		console.info(`[SessionStore] Session "${slug}" created successfully.`)
		
		// Write session_started timeline event directly
		const startEvent = {
			id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			type: 'match/session_started',
			at: finalMetadata.createdAt,
			gsiClock: null,
			map: null,
			round: 0,
			phase: null,
			actor: null,
			target: null,
			team: null,
			data: { metadata: finalMetadata }
		}
		appendTimelineEvent(id, startEvent)
		
		return finalMetadata
	} catch (err) {
		console.warn('[SessionStore] Failed to create session:', err)
		return null
	}
}

/**
 * Returns active session metadata.
 * If activeSessionId is not in memory, scans disk for any session marked "active".
 * Picks the most recently created active session.
 */
export function getActiveSession() {
	ensureSessionsDir()
	
	try {
		// If we have it in memory, read it
		if (activeSessionId) {
			const sPath = getSessionPath(activeSessionId)
			if (sPath) {
				const meta = JSON.parse(fs.readFileSync(path.join(sPath, 'metadata.json'), 'utf8'))
				if (meta.status === 'active') {
					return meta
				}
			}
		}
		
		// If we have already scanned once and found nothing active, don't hit the disk again
		if (hasScannedActive) {
			return null
		}
		
		hasScannedActive = true
		
		// Scan directory for active sessions
		if (!fs.existsSync(SESSIONS_DIR)) return null
		const dirs = fs.readdirSync(SESSIONS_DIR)
		const activeSessions = []
		
		for (const dirName of dirs) {
			const dirPath = path.join(SESSIONS_DIR, dirName)
			const metaPath = path.join(dirPath, 'metadata.json')
			if (fs.existsSync(metaPath)) {
				try {
					const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
					if (meta.status === 'active') {
						activeSessions.push(meta)
					}
				} catch (_) {}
			}
		}
		
		if (activeSessions.length > 0) {
			// Sort by createdAt descending
			activeSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
			activeSessionId = activeSessions[0].id
			return activeSessions[0]
		}
	} catch (err) {
		console.warn('[SessionStore] Failed to get active session:', err)
	}
	
	return null
}

/**
 * Explicitly sets a session as active
 */
export function setActiveSession(sessionId) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) {
			return null
		}
		
		const metaPath = path.join(sPath, 'metadata.json')
		const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
		
		// If it was ended, we can mark it as active again
		if (meta.status !== 'active') {
			meta.status = 'active'
			meta.endedAt = null
			writeJsonAtomic(metaPath, meta)
		}
		
		activeSessionId = meta.id
		console.info(`[SessionStore] Session "${meta.slug}" is now active.`)
		return meta
	} catch (err) {
		console.warn(`[SessionStore] Failed to set active session to ${sessionId}:`, err)
		return null
	}
}

/**
 * Ends the active session
 */
export function endActiveSession() {
	try {
		const active = getActiveSession()
		if (!active) {
			return null
		}
		
		const sPath = getSessionPath(active.id)
		if (!sPath) return null
		
		const metaPath = path.join(sPath, 'metadata.json')
		const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
		
		meta.status = 'ended'
		meta.endedAt = new Date().toISOString()
		
		writeJsonAtomic(metaPath, meta)
		activeSessionId = null
		
		console.info(`[SessionStore] Session "${meta.slug}" ended.`)
		
		// Write session_ended timeline event directly
		const endEvent = {
			id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			type: 'match/session_ended',
			at: meta.endedAt,
			gsiClock: null,
			map: null,
			round: 0,
			phase: null,
			actor: null,
			target: null,
			team: null,
			data: {}
		}
		appendTimelineEvent(meta.id, endEvent)

		// Persist any pending summary counters before the session goes inactive.
		flushSummary(meta.id)

		// Write end snapshot
		try {
			const mapObj = gsiState.map || {}
			const roundObj = gsiState.round || {}
			const bombObj = gsiState.bomb || {}
			
			const players = []
			if (gsiState.allplayers) {
				for (const [steamid, p] of Object.entries(gsiState.allplayers)) {
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
			
			const endSnapshot = {
				at: meta.endedAt,
				reason: 'session_end',
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
			appendSnapshot(meta.id, endSnapshot)
		} catch (snapErr) {
			console.warn('[SessionStore] Warning: Failed to record end snapshot:', snapErr.message)
		}
		
		return meta
	} catch (err) {
		console.warn('[SessionStore] Failed to end active session:', err)
		return null
	}
}

/**
 * Lists all sessions on disk with their metadata and summaries
 */
export function listSessions() {
	ensureSessionsDir()
	const results = []
	
	try {
		if (!fs.existsSync(SESSIONS_DIR)) return []
		const dirs = fs.readdirSync(SESSIONS_DIR)
		
		for (const dirName of dirs) {
			const dirPath = path.join(SESSIONS_DIR, dirName)
			const metaPath = path.join(dirPath, 'metadata.json')
			const summaryPath = path.join(dirPath, 'summary.json')
			
			if (fs.existsSync(metaPath)) {
				try {
					const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
					let summary = null
					if (fs.existsSync(summaryPath)) {
						summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
					}
					results.push({ metadata, summary })
				} catch (err) {
					console.warn(`[SessionStore] Warning: Failed to parse session inside ${dirName}:`, err.message)
				}
			}
		}
		
		// Sort by createdAt descending
		results.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt))
	} catch (err) {
		console.warn('[SessionStore] Failed to list sessions:', err)
	}
	
	return results
}

/**
 * Reads metadata and summary for a single session
 */
export function readSession(sessionId) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) return null
		
		const metadata = JSON.parse(fs.readFileSync(path.join(sPath, 'metadata.json'), 'utf8'))
		// Prefer the in-memory summary when present so reads reflect not-yet-flushed
		// counters (keyed by both id and slug to cover either lookup form).
		const summary = summaryCache.get(sessionId)
			?? summaryCache.get(metadata.id)
			?? JSON.parse(fs.readFileSync(path.join(sPath, 'summary.json'), 'utf8'))

		return { metadata, summary }
	} catch (err) {
		console.warn(`[SessionStore] Failed to read session ${sessionId}:`, err)
		return null
	}
}

/**
 * Appends a timeline event to timeline.jsonl and updates the summary file
 */
export function appendTimelineEvent(sessionId, event) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) return false
		
		const timelinePath = path.join(sPath, 'timeline.jsonl')
		const stream = getOrCreateStream(timelinePath)
		stream.write(JSON.stringify(event) + '\n')

		// Update summary statistics in memory; the write is debounced.
		const summary = loadSummaryCached(sessionId, sPath)
		summary.eventsRecorded = (summary.eventsRecorded || 0) + 1

		const nowStr = new Date().toISOString()
		if (!summary.firstGsiAt) {
			summary.firstGsiAt = nowStr
		}
		summary.lastGsiAt = nowStr

		scheduleSummaryFlush(sessionId)

		return true
	} catch (err) {
		console.warn(`[SessionStore] Failed to append timeline event to session ${sessionId}:`, err)
		return false
	}
}

/**
 * Appends a snapshot to snapshots.jsonl
 */
export function appendSnapshot(sessionId, snapshot) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) return false
		
		const snapshotsPath = path.join(sPath, 'snapshots.jsonl')
		const stream = getOrCreateStream(snapshotsPath)
		stream.write(JSON.stringify(snapshot) + '\n')
		return true
	} catch (err) {
		console.warn(`[SessionStore] Failed to append snapshot to session ${sessionId}:`, err)
		return false
	}
}

/**
 * Shallow merges updates into summary.json
 */
export function updateSessionSummary(sessionId, patch = {}) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) return false

		const summary = loadSummaryCached(sessionId, sPath)
		Object.assign(summary, patch)
		scheduleSummaryFlush(sessionId)
		return true
	} catch (err) {
		console.warn(`[SessionStore] Failed to update session summary for ${sessionId}:`, err)
	}
	return false
}

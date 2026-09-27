import fs from 'fs'
import path from 'path'
import { userspaceDirectory } from '../helpers/paths.js'
import { gsiState } from '../state.js'
import { resetTimelineState } from './timeline-recorder.js'

// We store our sessions in a subfolder "sessions" under userspaceDirectory
const SESSIONS_DIR = path.resolve(userspaceDirectory, 'sessions')

// In-memory cache of the currently active session metadata to avoid blocking disk I/O on GSI ticks
let activeSessionMeta = null
let hasScannedActive = false

// In-memory cache for fast O(1) session path lookups (id or slug -> directory path) with LRU bounds
const MAX_PATH_CACHE = 500
const sessionPathCache = new Map()

function setPathCache(key, value) {
	if (!key || !value) return
	if (sessionPathCache.size >= MAX_PATH_CACHE) {
		const firstKey = sessionPathCache.keys().next().value
		sessionPathCache.delete(firstKey)
	}
	sessionPathCache.set(key, value)
}

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
	return String(str)
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, '-') // Replace non-alphanumeric/underscore/hyphen with hyphen
		.replace(/-+/g, '-')          // Collapse consecutive hyphens
		.replace(/^-+|-+$/g, '')     // Trim leading/trailing hyphens
}

// ── Summary write coalescing ──
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
		fs.writeFileSync(path.join(sPath, 'summary.json'), JSON.stringify(summary, null, '\t'), 'utf8')
	} catch (err) {
		console.warn(`[SessionStore] Failed to flush summary for ${sessionId}:`, err.message)
	}
}

/**
 * Synchronous summary flush on process exit to avoid dropped async writes and clear pending timers.
 */
function flushAllSummariesSync() {
	for (const [, timer] of summaryFlushTimers.entries()) {
		try {
			clearTimeout(timer)
		} catch (_) {}
	}
	summaryFlushTimers.clear()

	for (const [sessionId, summary] of summaryCache.entries()) {
		const sPath = summaryDirs.get(sessionId)
		if (!summary || !sPath) continue
		try {
			const targetPath = path.join(sPath, 'summary.json')
			fs.writeFileSync(targetPath, JSON.stringify(summary, null, '\t'), 'utf8')
		} catch (err) {
			console.warn(`[SessionStore] Exit sync flush failed for ${sessionId}:`, err.message)
		}
	}
	summaryCache.clear()
	summaryDirs.clear()
}

// ── Non-blocking asynchronous event batch queue ──
const writeStreams = new Map() // filePath -> fs.WriteStream

function getOrCreateStream(filePath) {
	if (writeStreams.has(filePath)) return writeStreams.get(filePath)
	const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
	stream.on('error', (err) => console.warn(`[SessionStore] Stream write error on ${filePath}:`, err.message))
	writeStreams.set(filePath, stream)
	return stream
}

export function closeStreamsForSession(sessionPath) {
	if (!sessionPath) return
	const normalizedSession = path.resolve(sessionPath)
	const dirBoundary = normalizedSession.endsWith(path.sep) ? normalizedSession : (normalizedSession + path.sep)

	for (const [filePath, stream] of writeStreams.entries()) {
		const normalizedFile = path.resolve(filePath)
		if (normalizedFile.startsWith(dirBoundary) || normalizedFile === normalizedSession) {
			try {
				stream.end()
			} catch (_) {}
			writeStreams.delete(filePath)
		}
	}
}

function flushAllStreams() {
	for (const [, stream] of writeStreams.entries()) {
		try {
			stream.end()
		} catch (_) {}
	}
	writeStreams.clear()
}

process.on('exit', () => {
	flushAllSummariesSync()
	flushAllStreams()
})

/**
 * Finds a session path on disk by ID or Slug.
 * Protects against directory traversal. Returns null if not found.
 */
export function getSessionPath(sessionId) {
	if (!sessionId || typeof sessionId !== 'string') return null
	// Prevent path traversal
	if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
		return null
	}
	
	// Fast memory cache check
	if (sessionPathCache.has(sessionId)) {
		const cachedPath = sessionPathCache.get(sessionId)
		if (fs.existsSync(cachedPath)) {
			return cachedPath
		}
		sessionPathCache.delete(sessionId)
	}

	ensureSessionsDir()
	
	try {
		// First check if it exists directly as a directory (slug match)
		const directPath = path.resolve(SESSIONS_DIR, sessionId)
		if (directPath.startsWith(SESSIONS_DIR + path.sep)) {
			if (fs.existsSync(directPath) && fs.existsSync(path.join(directPath, 'metadata.json'))) {
				setPathCache(sessionId, directPath)
				return directPath
			}
		}
		
		// Otherwise scan all directories to find matching metadata.id or slug
		if (!fs.existsSync(SESSIONS_DIR)) return null
		const dirs = fs.readdirSync(SESSIONS_DIR)
		for (const dirName of dirs) {
			const dirPath = path.join(SESSIONS_DIR, dirName)
			const metaPath = path.join(dirPath, 'metadata.json')
			if (fs.existsSync(metaPath)) {
				try {
					const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
					if (meta.id) setPathCache(meta.id, dirPath)
					if (meta.slug) setPathCache(meta.slug, dirPath)
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
 * Creates a new session and sets it as active.
 * Closes previous active session if one was running.
 */
export function createSession(metadata = {}) {
	ensureSessionsDir()
	
	try {
		// End any existing active session cleanly first
		const currentActive = getActiveSession()
		if (currentActive) {
			endActiveSession()
		}

		const rawId = metadata.id ? sanitizeSlugPart(metadata.id) : null
		const shortId = Math.random().toString(36).substring(2, 8)
		const id = rawId || shortId
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
		
		// Synchronously write core files so they are available immediately
		fs.writeFileSync(path.join(sessionDir, 'metadata.json'), JSON.stringify(finalMetadata, null, '\t'), 'utf8')
		fs.writeFileSync(path.join(sessionDir, 'summary.json'), JSON.stringify(finalSummary, null, '\t'), 'utf8')
		fs.writeFileSync(path.join(sessionDir, 'maps.json'), '[]', 'utf8')
		fs.writeFileSync(path.join(sessionDir, 'timeline.jsonl'), '', 'utf8')
		fs.writeFileSync(path.join(sessionDir, 'snapshots.jsonl'), '', 'utf8')
		
		// Cache paths and active state immediately
		setPathCache(id, sessionDir)
		setPathCache(slug, sessionDir)
		activeSessionMeta = finalMetadata
		hasScannedActive = false
		resetTimelineState(id)
		
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
 * Uses fast in-memory cache to prevent blocking disk I/O on GSI ingestion loops.
 */
export function getActiveSession() {
	if (activeSessionMeta && activeSessionMeta.status === 'active') {
		return activeSessionMeta
	}
	
	if (hasScannedActive) {
		return null
	}
	
	ensureSessionsDir()
	
	try {
		hasScannedActive = true
		if (!fs.existsSync(SESSIONS_DIR)) return null
		const dirs = fs.readdirSync(SESSIONS_DIR)
		const activeSessions = []
		
		for (const dirName of dirs) {
			const dirPath = path.join(SESSIONS_DIR, dirName)
			const metaPath = path.join(dirPath, 'metadata.json')
			if (fs.existsSync(metaPath)) {
				try {
					const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
					if (meta.id) setPathCache(meta.id, dirPath)
					if (meta.slug) setPathCache(meta.slug, dirPath)
					if (meta.status === 'active') {
						activeSessions.push(meta)
					}
				} catch (_) {}
			}
		}
		
		if (activeSessions.length > 0) {
			activeSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
			activeSessionMeta = activeSessions[0]
			return activeSessionMeta
		}
	} catch (err) {
		console.warn('[SessionStore] Failed to get active session:', err)
	}
	
	return null
}

/**
 * Explicitly sets a session as active.
 * Closes previous active session if different.
 */
export function setActiveSession(sessionId) {
	try {
		const sPath = getSessionPath(sessionId)
		if (!sPath) {
			return null
		}
		
		const metaPath = path.join(sPath, 'metadata.json')
		const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
		
		// If another session was active, end it first
		if (activeSessionMeta && activeSessionMeta.id !== meta.id) {
			endActiveSession()
		}

		if (meta.status !== 'active') {
			meta.status = 'active'
			meta.endedAt = null
			fs.writeFileSync(metaPath, JSON.stringify(meta, null, '\t'), 'utf8')
		}
		
		activeSessionMeta = meta
		hasScannedActive = false
		setPathCache(meta.id, sPath)
		setPathCache(meta.slug, sPath)
		resetTimelineState(meta.id)
		console.info(`[SessionStore] Session "${meta.slug}" is now active.`)
		return meta
	} catch (err) {
		console.warn(`[SessionStore] Failed to set active session to ${sessionId}:`, err)
		return null
	}
}

/**
 * Ends the active session, flushes summary, writes final snapshot, and closes open streams.
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
		
		fs.writeFileSync(metaPath, JSON.stringify(meta, null, '\t'), 'utf8')
		activeSessionMeta = null
		hasScannedActive = false
		
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

		// Persist pending summary counters and clear cached maps for this session
		flushSummary(meta.id)
		summaryCache.delete(meta.id)
		summaryDirs.delete(meta.id)

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
		
		// Close file streams for this session
		closeStreamsForSession(sPath)
		resetTimelineState(null)
		
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
					if (metadata.id) setPathCache(metadata.id, dirPath)
					if (metadata.slug) setPathCache(metadata.slug, dirPath)
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
		const summary = summaryCache.get(sessionId)
			?? summaryCache.get(metadata.id)
			?? (fs.existsSync(path.join(sPath, 'summary.json'))
				? JSON.parse(fs.readFileSync(path.join(sPath, 'summary.json'), 'utf8'))
				: null)

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

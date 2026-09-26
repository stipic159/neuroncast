import fs from 'fs'
import path from 'path'
import {
	createSession,
	getActiveSession,
	setActiveSession,
	endActiveSession,
	listSessions,
	readSession,
	getSessionPath
} from './session-store.js'
import { rebuildSessionStats } from './stats-aggregator.js'
import { exportSessionToJson, exportSessionToCsv } from './session-export.js'

export function registerSessionRoutes(router) {
	// GET /api/sessions
	router.get('/api/sessions', (context) => {
		try {
			context.body = listSessions()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/active
	router.get('/api/sessions/active', (context) => {
		try {
			const active = getActiveSession()
			if (!active) {
				context.body = {
					active: false,
					session: null
				}
			} else {
				context.body = {
					active: true,
					session: active
				}
			}
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// POST /api/sessions
	router.post('/api/sessions', (context) => {
		try {
			const metadata = context.request.body || {}
			const newSession = createSession(metadata)
			if (!newSession) {
				context.status = 400
				context.body = { error: 'Failed to create session. Please check parameters.' }
				return
			}
			context.body = newSession
			context.status = 201
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// POST /api/sessions/active/:sessionId
	router.post('/api/sessions/active/:sessionId', (context) => {
		try {
			const sessionId = context.params.sessionId
			const session = setActiveSession(sessionId)
			if (!session) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			context.body = { success: true, session }
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// POST /api/sessions/end
	router.post('/api/sessions/end', (context) => {
		try {
			const ended = endActiveSession()
			if (!ended) {
				context.status = 400
				context.body = { error: 'No active session exists to end.' }
				return
			}
			context.body = ended
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId
	router.get('/api/sessions/:sessionId', (context) => {
		try {
			const sessionId = context.params.sessionId
			const sPath = getSessionPath(sessionId)
			if (!sPath) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			
			const data = readSession(sessionId)
			if (!data) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			
			// Lazy load/rebuild stats.json
			const statsPath = path.join(sPath, 'stats.json')
			let stats = null
			if (!fs.existsSync(statsPath)) {
				stats = rebuildSessionStats(sessionId)
			} else {
				try {
					stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'))
				} catch (err) {
					console.warn(`[SessionRoutes] Failed to read stats.json for ${sessionId}, rebuilding:`, err.message)
					stats = rebuildSessionStats(sessionId)
				}
			}
			
			context.body = {
				metadata: data.metadata,
				summary: data.summary,
				stats
			}
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId/export/json
	router.get('/api/sessions/:sessionId/export/json', (context) => {
		try {
			const sessionId = context.params.sessionId
			const data = exportSessionToJson(sessionId)
			if (!data) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found or failed to export.` }
				return
			}
			context.set('Content-Disposition', `attachment; filename="eon_session_${sessionId}.json"`)
			context.body = data
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId/export/csv
	router.get('/api/sessions/:sessionId/export/csv', (context) => {
		try {
			const sessionId = context.params.sessionId
			const data = exportSessionToCsv(sessionId)
			if (data === null) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found or failed to export.` }
				return
			}
			context.set('Content-Type', 'text/csv; charset=utf-8')
			context.set('Content-Disposition', `attachment; filename="eon_session_${sessionId}.csv"`)
			context.body = data
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId/timeline
	router.get('/api/sessions/:sessionId/timeline', (context) => {
		try {
			const sessionId = context.params.sessionId
			const sPath = getSessionPath(sessionId)
			if (!sPath) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			
			const timelinePath = path.join(sPath, 'timeline.jsonl')
			if (!fs.existsSync(timelinePath)) {
				context.status = 404
				context.body = { error: `Timeline for session "${sessionId}" does not exist.` }
				return
			}
			
			const content = fs.readFileSync(timelinePath, 'utf8')
			const events = content
				.split('\n')
				.filter(Boolean)
				.map(line => {
					try {
						return JSON.parse(line)
					} catch (_) {
						return null
					}
				})
				.filter(Boolean)
				
			context.body = events
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId/summary
	router.get('/api/sessions/:sessionId/summary', (context) => {
		try {
			const sessionId = context.params.sessionId
			const sPath = getSessionPath(sessionId)
			if (!sPath) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			
			const summaryPath = path.join(sPath, 'summary.json')
			if (!fs.existsSync(summaryPath)) {
				context.status = 404
				context.body = { error: `Summary for session "${sessionId}" does not exist.` }
				return
			}
			
			context.body = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	// GET /api/sessions/:sessionId/snapshots
	router.get('/api/sessions/:sessionId/snapshots', (context) => {
		try {
			const sessionId = context.params.sessionId
			const sPath = getSessionPath(sessionId)
			if (!sPath) {
				context.status = 404
				context.body = { error: `Session with ID/slug "${sessionId}" not found.` }
				return
			}
			
			const snapshotsPath = path.join(sPath, 'snapshots.jsonl')
			if (!fs.existsSync(snapshotsPath)) {
				context.status = 404
				context.body = { error: `Snapshots for session "${sessionId}" do not exist.` }
				return
			}
			
			const content = fs.readFileSync(snapshotsPath, 'utf8')
			const snapshots = content
				.split('\n')
				.filter(Boolean)
				.map(line => {
					try {
						return JSON.parse(line)
					} catch (_) {
						return null
					}
				})
				.filter(Boolean)
				
			context.body = snapshots
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})
}

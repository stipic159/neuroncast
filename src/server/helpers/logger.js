import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { builtinRootDirectory } from './paths.js'

const logsDir = join(builtinRootDirectory, 'logs')

try {
	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true })
	}
} catch (err) {
	console.warn('[Logger] Failed to create logs directory on startup:', err.message)
}

const matchHistoryPath = join(logsDir, 'match_history.json')

export const logRound = (data) => {
	try {
		if (!existsSync(logsDir)) {
			mkdirSync(logsDir, { recursive: true })
		}
		const entry = JSON.stringify({
			...(data || {}),
			timestamp: new Date().toISOString()
		}) + '\n'
		appendFileSync(matchHistoryPath, entry, 'utf8')
	} catch (err) {
		console.error('[Logger] Failed to log round:', err.message)
	}
}

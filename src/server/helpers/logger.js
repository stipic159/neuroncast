import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { builtinRootDirectory } from './paths.js'

const logsDir = join(builtinRootDirectory, 'logs')

if (!existsSync(logsDir)) {
	mkdirSync(logsDir, { recursive: true })
}

const matchHistoryPath = join(logsDir, 'match_history.json')

export const logRound = (data) => {
	try {
		const entry = JSON.stringify({
			...data,
			timestamp: new Date().toISOString()
		}) + '\n'
		appendFileSync(matchHistoryPath, entry)
	} catch (err) {
		console.error('Failed to log round:', err)
	}
}

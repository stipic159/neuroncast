import fs from 'fs'
import path from 'path'
import { getSessionPath } from './session-store.js'
import { rebuildSessionStats } from './stats-aggregator.js'

/**
 * Escapes a single field for CSV.
 * Prevents CSV Injection (leading =, +, -, @, \t, |, \r characters, even with leading spaces)
 * by prepending a single quote.
 * Replaces newlines with a single space.
 * Quotes fields containing commas, quotes, or whitespace, doubling any existing quotes.
 */
function escapeCsvField(val) {
	if (val === null || val === undefined) return ''
	let str = String(val)
	
	// Replace CR/LF with a space
	str = str.replace(/[\r\n]+/g, ' ')
	
	// Escape spreadsheet formula-leading values (handling leading whitespace/tabs)
	if (/^\s*[=\+\-@|\t]/.test(str)) {
		str = "'" + str.trimStart()
	}
	
	// Double-quote if contains quotes, commas, or spaces
	if (str.includes(',') || str.includes('"') || str.includes(' ') || str.includes("'")) {
		str = `"${str.replace(/"/g, '""')}"`
	}
	
	return str
}

/**
 * Lazily fetches or rebuilds statistics for the session
 */
function getOrRebuildStats(sessionId, sPath) {
	if (!sPath) return null
	const statsPath = path.join(sPath, 'stats.json')
	if (!fs.existsSync(statsPath)) {
		console.info(`[SessionExport] Lazy rebuilding stats for session "${sessionId}" because stats.json was missing.`)
		return rebuildSessionStats(sessionId)
	}
	
	try {
		return JSON.parse(fs.readFileSync(statsPath, 'utf8'))
	} catch (err) {
		console.warn(`[SessionExport] Corrupted stats.json detected for session "${sessionId}", rebuilding:`, err.message)
		return rebuildSessionStats(sessionId)
	}
}

/**
 * Unified JSON exporter including metadata, summary, stats, generatedAt timestamp, and confidence notes
 */
export function exportSessionToJson(sessionId) {
	const sPath = getSessionPath(sessionId)
	if (!sPath) return null
	
	try {
		const metaPath = path.join(sPath, 'metadata.json')
		const summaryPath = path.join(sPath, 'summary.json')
		
		const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
		const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {}
		const stats = getOrRebuildStats(sessionId, sPath) || {}
		
		return {
			generatedAt: new Date().toISOString(),
			confidenceNotes: {
				kills: 'derived: computed sequentially from GSI player/kill events',
				deaths: 'derived: computed sequentially from GSI player/death events',
				assists: 'snapshot: synchronized from cumulative GSI transition snapshots',
				mvps: 'snapshot: synchronized from cumulative GSI transition snapshots'
			},
			metadata,
			summary,
			stats
		}
	} catch (err) {
		console.error(`[SessionExport] Failed to export session ${sessionId} to JSON:`, err)
		return null
	}
}

/**
 * UTF-8 CSV exporter compiling sheet-safe match summaries and player stats
 */
export function exportSessionToCsv(sessionId) {
	const sPath = getSessionPath(sessionId)
	if (!sPath) return null
	
	try {
		const metaPath = path.join(sPath, 'metadata.json')
		const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
		const stats = getOrRebuildStats(sessionId, sPath) || {}
		
		const lines = []
		
		// 1. Write Match Header Block
		lines.push('--- MATCH METADATA ---')
		lines.push('Event,Format,Date,Home Team,Away Team,Home Score,Away Score,Rounds Played,Maps Played,Duration')
		
		const durationSec = stats.matchTotals?.durationSeconds || 0
		const durationMin = durationSec
			? `${Math.floor(durationSec / 60)}m ${Math.floor(durationSec % 60)}s`
			: '0s'
			
		const metaRow = [
			metadata.match?.eventName || 'NeuronCast Match',
			metadata.match?.format || 'BO1',
			metadata.createdAt ? new Date(metadata.createdAt).toLocaleDateString() : 'N/A',
			stats.teams?.home?.name || metadata.teams?.home?.name || 'Home',
			stats.teams?.away?.name || metadata.teams?.away?.name || 'Away',
			stats.teams?.home?.roundsWon ?? 0,
			stats.teams?.away?.roundsWon ?? 0,
			stats.matchTotals?.roundsObserved ?? 0,
			stats.matchTotals?.mapsObserved ?? 0,
			durationMin
		]
		lines.push(metaRow.map(escapeCsvField).join(','))
		lines.push('') // blank separator line
		
		// 2. Write Player Stats Header
		lines.push('--- PLAYER STATISTICS ---')
		const playerHeaders = [
			'Player Name',
			'SteamID',
			'Team',
			'Kills',
			'Deaths',
			'Assists',
			'K/D Ratio',
			'MVPs',
			'First Kills',
			'First Deaths',
			'Bomb Plants',
			'Bomb Defuses',
			'Kills Confidence',
			'Deaths Confidence',
			'Assists Source',
			'MVPs Source'
		]
		lines.push(playerHeaders.map(escapeCsvField).join(','))
		
		// 3. Write Player Rows
		const players = Object.entries(stats.players || {})
		// Sort by kills descending
		players.sort((a, b) => (b[1]?.kills || 0) - (a[1]?.kills || 0))
		
		for (const [steamid, p] of players) {
			if (!p) continue
			const teamName = p.team === 'away' 
				? (stats.teams?.away?.name || metadata.teams?.away?.name || 'Away')
				: (stats.teams?.home?.name || metadata.teams?.home?.name || 'Home')
				
			const playerRow = [
				p.name || 'Player',
				steamid,
				teamName,
				p.kills ?? 0,
				p.deaths ?? 0,
				p.assists ?? 0,
				p.kdRatio ?? 0,
				p.mvps ?? 0,
				p.firstKills ?? 0,
				p.firstDeaths ?? 0,
				p.bombPlants ?? 0,
				p.bombDefuses ?? 0,
				p.killsConfidence || 'derived',
				p.deathsConfidence || 'derived',
				p.assistsSource || 'unavailable',
				p.mvpsSource || 'unavailable'
			]
			lines.push(playerRow.map(escapeCsvField).join(','))
		}
		
		return lines.join('\n')
	} catch (err) {
		console.error(`[SessionExport] Failed to export session ${sessionId} to CSV:`, err)
		return null
	}
}

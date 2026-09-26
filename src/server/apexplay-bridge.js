/**
 * ApexPlay bridge — forwards live CS2 scores from EON's parsed GSI state to a remote ApexPlay
 * server (https://apexplay.example/api/webhooks/eon). EON runs on the observer machine and can
 * reach the public ApexPlay server; ApexPlay cannot reach EON, so the data flows outward here.
 *
 * Configuration (read fresh every ~5s; env first, then an optional JSON file):
 *   env:  APEXPLAY_BRIDGE_ENABLED=1
 *         APEXPLAY_BRIDGE_URL=https://your-apexplay-host
 *         APEXPLAY_BRIDGE_TOKEN=eon_xxx           (minted in ApexPlay: Control → EON live scores)
 *   file: ./apexplay-bridge.json  (or APEXPLAY_BRIDGE_CONFIG=/path)  { enabled, url, token }
 *
 * Mapping is by steamid: we send each side's steamids so ApexPlay can identify the match and
 * which of its teams is currently CT vs T (scores survive side swaps). Disabled/unconfigured =
 * complete no-op; never throws into EON's hot path.
 */
import fs from 'fs'
import path from 'path'

let cfgCache = null
let cfgLoadedAt = 0

function loadConfig() {
	if (cfgCache && Date.now() - cfgLoadedAt < 5000) return cfgCache
	cfgLoadedAt = Date.now()

	let cfg = {
		enabled: process.env.APEXPLAY_BRIDGE_ENABLED === '1' || process.env.APEXPLAY_BRIDGE_ENABLED === 'true',
		url: process.env.APEXPLAY_BRIDGE_URL || '',
		token: process.env.APEXPLAY_BRIDGE_TOKEN || '',
	}

	try {
		const p = process.env.APEXPLAY_BRIDGE_CONFIG || path.join(process.cwd(), 'apexplay-bridge.json')
		if (fs.existsSync(p)) {
			const file = JSON.parse(fs.readFileSync(p, 'utf-8'))
			cfg = {
				enabled: file.enabled ?? cfg.enabled,
				url: file.url || cfg.url,
				token: file.token || cfg.token,
			}
		}
	} catch {
		// ignore malformed config; treat as not-configured
	}

	cfgCache = cfg
	return cfg
}

function extractScore(gsiState) {
	const map = gsiState?.map
	if (!map || !map.team_ct || !map.team_t) return null

	const players = gsiState.allplayers || {}
	const ctIds = []
	const tIds = []
	for (const [steamid, player] of Object.entries(players)) {
		const team = String(player?.team || '').toUpperCase()
		if (team === 'CT') ctIds.push(steamid)
		else if (team === 'T') tIds.push(steamid)
	}
	if (ctIds.length === 0 && tIds.length === 0) return null

	return {
		map: { name: map.name || null, phase: map.phase || null },
		round: { phase: gsiState.round?.phase || null },
		ct: {
			score: Number(map.team_ct.score) || 0,
			series: Number(map.team_ct.matches_won_this_series) || 0,
			steamids: ctIds,
		},
		t: {
			score: Number(map.team_t.score) || 0,
			series: Number(map.team_t.matches_won_this_series) || 0,
			steamids: tIds,
		},
	}
}

let lastSig = null
let lastPushAt = 0
let inFlight = false

export function maybePushApexPlay(gsiState) {
	const cfg = loadConfig()
	if (!cfg.enabled || !cfg.url || !cfg.token || inFlight) return

	const payload = extractScore(gsiState)
	if (!payload) return

	const sig = JSON.stringify([
		payload.ct.score, payload.ct.series,
		payload.t.score, payload.t.series,
		payload.map.phase, payload.round.phase,
		payload.ct.steamids.slice().sort(),
		payload.t.steamids.slice().sort(),
	])

	const now = Date.now()
	const changed = sig !== lastSig
	if (!changed && now - lastPushAt < 5000) return // unchanged: heartbeat at most every 5s
	if (changed && now - lastPushAt < 300) return // changed: cap at ~3/s

	lastSig = sig
	lastPushAt = now
	inFlight = true

	const endpoint = cfg.url.replace(/\/+$/, '') + '/api/webhooks/eon'
	fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : undefined,
	})
		.catch(() => { /* transient network on observer machine; ignore */ })
		.finally(() => { inFlight = false })
}

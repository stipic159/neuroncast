import { access } from 'fs/promises'
import { join, basename } from 'path'

import { getSettings } from './settings.js'
import { gsiState } from './state.js'
import { getActiveSession } from './sessions/session-store.js'
import { getKomplettligaenBundle, getKomplettligaenConfig } from './komplettligaen.js'
import { getFastcupBundle, getFastcupConfig } from './fastcup.js'
import { builtinThemesDirectory, customThemesDirectory } from './helpers/paths.js'
import { assignKlSides, assignFastcupSides, isGenericGsiTeamName } from './team-identity-resolver.js'

const optionValue = (settings, key) => settings?.options?.[key]?.value ?? settings?.options?.[key]?.fallback ?? null

const sanitizeLogoName = (name) => {
	if (!name) return ''
	return basename(String(name).trim()).replace(/[\/\\]/g, '')
}

const fileExists = async (path) => {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

// Кэш для проверки логотипов на диске, чтобы не долбить файловую систему на каждом GSI-тике
const logoCache = new Map()
const LOGO_CACHE_TTL = 10_000 // 10 секунд
const MAX_LOGO_CACHE_SIZE = 200

const resolveFilesystemLogo = async (name, themeTree) => {
	const logoName = sanitizeLogoName(name)
	if (!logoName) return { path: null, exists: false }

	const hudPath = `team-logos/${logoName}.png`
	const tree = themeTree || []
	const cacheKey = `${logoName}:${tree.join(',')}`
	const now = Date.now()

	const cached = logoCache.get(cacheKey)
	if (cached && now - cached.timestamp < LOGO_CACHE_TTL) {
		return cached.result
	}

	let exists = false

	for (const theme of tree) {
		const customPath = join(customThemesDirectory, theme, hudPath)
		const builtinPath = join(builtinThemesDirectory, theme, hudPath)

		// Проверяем оба пути параллельно, а не последовательно
		const [hasCustom, hasBuiltin] = await Promise.all([
			fileExists(customPath),
			fileExists(builtinPath)
		])

		if (hasCustom || hasBuiltin) {
			exists = true
			break
		}
	}

	const result = { path: `/hud/${hudPath}`, exists }

	if (logoCache.size >= MAX_LOGO_CACHE_SIZE) {
		const oldestKey = logoCache.keys().next().value
		logoCache.delete(oldestKey)
	}
	logoCache.set(cacheKey, { result, timestamp: now })

	return result
}

const mapSessionSlots = (session) => ({
	left: session?.teams?.home ?? null,
	right: session?.teams?.away ?? null,
})

const makeSlot = async ({ side, sidebarSlot, overrideName, fcEntry, klEntry, sessionEntry, gsiEntry, themeTree }) => {
	const rawGsiName = !isGenericGsiTeamName(gsiEntry?.name) ? gsiEntry?.name : null
	const candidateNameForLogo = overrideName || fcEntry?.name || klEntry?.name || sessionEntry?.name || rawGsiName || side

	return {
		side,
		sidebarSlot,
		override: {
			name: overrideName || null,
			logo: null,
		},
		fastcup: {
			name: fcEntry?.name || null,
			logo: fcEntry?.logo || null,
			tag: fcEntry?.tag || null,
		},
		komplettligaen: {
			name: klEntry?.name || null,
			logo: klEntry?.logo || null,
		},
		session: {
			name: sessionEntry?.name || null,
			logo: sessionEntry?.logo || null,
		},
		gsi: {
			name: gsiEntry?.name || null,
			score: gsiEntry?.score ?? null,
		},
		filesystemLogo: await resolveFilesystemLogo(candidateNameForLogo, themeTree),
	}
}

export const buildTeamIdentityContext = async () => {
	// 1. Загружаем независимые конфиги и бандлы параллельно вместо водопада await
	const [{ settings, themeTree }, komplettligaenConfig, fastcupBundle] = await Promise.all([
		getSettings(),
		getKomplettligaenConfig(),
		getFastcupBundle(),
	])

	const options = {
		'teams.leftTeamName': optionValue(settings, 'teams.leftTeamName'),
		'teams.rightTeamName': optionValue(settings, 'teams.rightTeamName'),
		'preferences.topBar.swapScrapedTeams': optionValue(settings, 'preferences.topBar.swapScrapedTeams'),
	}

	const komplettligaenBundle = komplettligaenConfig?.matchId
		? await getKomplettligaenBundle(komplettligaenConfig.matchId)
		: null

	const map = gsiState.map
	const teamCt = map?.team_ct
	const teamT = map?.team_t

	const match = komplettligaenBundle?.match || null
	const klSides = assignKlSides({
		match,
		options,
		ct: { name: teamCt?.name, score: teamCt?.score },
		t: { name: teamT?.name, score: teamT?.score },
		mapName: map?.name || null,
	})

	const fcSides = assignFastcupSides({
		match: fastcupBundle?.match || null,
		gsiAllPlayers: gsiState.allplayers || {},
	})

	const session = getActiveSession()
	const sessionSlots = mapSessionSlots(session)

	const ctSidebarSlot = 'right'
	const tSidebarSlot = 'left'

	const [ctSlot, tSlot] = await Promise.all([
		makeSlot({
			side: 'CT',
			sidebarSlot: ctSidebarSlot,
			overrideName: ctSidebarSlot === 'left' ? options['teams.leftTeamName'] : options['teams.rightTeamName'],
			fcEntry: fcSides.ct,
			klEntry: klSides.ct,
			sessionEntry: ctSidebarSlot === 'left' ? sessionSlots.left : sessionSlots.right,
			gsiEntry: teamCt,
			themeTree,
		}),
		makeSlot({
			side: 'T',
			sidebarSlot: tSidebarSlot,
			overrideName: tSidebarSlot === 'left' ? options['teams.leftTeamName'] : options['teams.rightTeamName'],
			fcEntry: fcSides.t,
			klEntry: klSides.t,
			sessionEntry: tSidebarSlot === 'left' ? sessionSlots.left : sessionSlots.right,
			gsiEntry: teamT,
			themeTree,
		}),
	])

	return {
		options,
		themeTree,
		fastcup: {
			config: fastcupBundle?.config || null,
			match: fastcupBundle?.match || null,
			sideSource: fcSides.source,
		},
		komplettligaen: {
			config: komplettligaenConfig,
			source: komplettligaenBundle?.source || null,
			stale: !!komplettligaenBundle?.stale,
			match,
			sideSource: klSides.source,
		},
		session,
		slots: {
			ct: ctSlot,
			t: tSlot,
		},
	}
}

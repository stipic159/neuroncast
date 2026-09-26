import { access } from 'fs/promises'
import { join } from 'path'

import { getSettings } from './settings.js'
import { gsiState } from './state.js'
import { getActiveSession } from './sessions/session-store.js'
import { getKomplettligaenBundle, getKomplettligaenConfig } from './komplettligaen.js'
import { builtinThemesDirectory, customThemesDirectory } from './helpers/paths.js'
import { assignKlSides, isGenericGsiTeamName } from './team-identity-resolver.js'

const optionValue = (settings, key) => settings.options?.[key]?.value ?? settings.options?.[key]?.fallback ?? null

const sanitizeLogoName = (name) => String(name || '').trim()

const fileExists = async (path) => {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

const resolveFilesystemLogo = async (name, themeTree) => {
	const logoName = sanitizeLogoName(name)
	if (!logoName) return { path: null, exists: false }

	const hudPath = `team-logos/${logoName}.png`
	for (const theme of themeTree || []) {
		const customPath = join(customThemesDirectory, theme, hudPath)
		if (await fileExists(customPath)) return { path: `/hud/${hudPath}`, exists: true }

		const builtinPath = join(builtinThemesDirectory, theme, hudPath)
		if (await fileExists(builtinPath)) return { path: `/hud/${hudPath}`, exists: true }
	}

	return { path: `/hud/${hudPath}`, exists: false }
}

const mapSessionSlots = (session) => ({
	left: session?.teams?.home || null,
	right: session?.teams?.away || null,
})

const makeSlot = async ({ side, sidebarSlot, overrideName, klEntry, sessionEntry, gsiEntry, themeTree }) => {
	const candidateNameForLogo = overrideName || klEntry?.name || sessionEntry?.name || (!isGenericGsiTeamName(gsiEntry?.name) ? gsiEntry?.name : side)

	return {
		side,
		sidebarSlot,
		override: {
			name: overrideName || null,
			logo: null,
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
	const { settings, themeTree } = await getSettings()
	const options = {
		'teams.leftTeamName': optionValue(settings, 'teams.leftTeamName'),
		'teams.rightTeamName': optionValue(settings, 'teams.rightTeamName'),
		'preferences.topBar.swapScrapedTeams': optionValue(settings, 'preferences.topBar.swapScrapedTeams'),
	}

	const komplettligaenConfig = await getKomplettligaenConfig()
	const komplettligaenBundle = await getKomplettligaenBundle(komplettligaenConfig.matchId)
	const match = komplettligaenBundle?.match || null
	// scraped identity per SIDE (not per sidebar slot): matched against the
	// game feed's team names, else the match page's starting sides + round,
	// else the old positional guess - see assignKlSides
	const klSides = assignKlSides({
		match, options,
		ct: { name: gsiState.map?.team_ct?.name, score: gsiState.map?.team_ct?.score },
		t: { name: gsiState.map?.team_t?.name, score: gsiState.map?.team_t?.score },
		mapName: gsiState.map?.name || null,
	})
	const session = getActiveSession()
	const sessionSlots = mapSessionSlots(session)

	// Mirror raw parse-teams ordering: lower observer slots decide left/right.
	const gsiSlots = [
		{ side: 'T', key: 't', team: gsiState.map?.team_t || null, sort: 1 },
		{ side: 'CT', key: 'ct', team: gsiState.map?.team_ct || null, sort: 10 },
	].sort((a, b) => a.sort - b.sort)

	const sideToSlot = new Map([
		[gsiSlots[0]?.side, 'left'],
		[gsiSlots[1]?.side, 'right'],
	])

	const ctSidebarSlot = sideToSlot.get('CT') || 'right'
	const tSidebarSlot = sideToSlot.get('T') || 'left'

	return {
		options,
		themeTree,
		komplettligaen: {
			config: komplettligaenConfig,
			source: komplettligaenBundle?.source || null,
			stale: !!komplettligaenBundle?.stale,
			match,
			sideSource: klSides.source,
		},
		session,
		slots: {
			ct: await makeSlot({
				side: 'CT',
				sidebarSlot: ctSidebarSlot,
				overrideName: ctSidebarSlot === 'left' ? options['teams.leftTeamName'] : options['teams.rightTeamName'],
				klEntry: klSides.ct,
				sessionEntry: ctSidebarSlot === 'left' ? sessionSlots.left : sessionSlots.right,
				gsiEntry: gsiState.map?.team_ct,
				themeTree,
			}),
			t: await makeSlot({
				side: 'T',
				sidebarSlot: tSidebarSlot,
				overrideName: tSidebarSlot === 'left' ? options['teams.leftTeamName'] : options['teams.rightTeamName'],
				klEntry: klSides.t,
				sessionEntry: tSidebarSlot === 'left' ? sessionSlots.left : sessionSlots.right,
				gsiEntry: gsiState.map?.team_t,
				themeTree,
			}),
		},
	}
}

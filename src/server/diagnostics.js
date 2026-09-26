import { buildTeamIdentityContext } from './team-identity-context.js'
import { resolveTeamIdentities } from './team-identity-resolver.js'
import { additionalState, gsiState } from './state.js'
import { isUiDevMode } from './dev-mode.js'
import { getActivePackageStatus } from './helpers/event-package-helper.js'
import { getCacheMetadata } from './cache/scraper-cache.js'

export const registerDiagnosticsRoutes = (router, websocket = null) => {
	router.get('/api/diagnostics/team-identity', async (context) => {
		const identityContext = await buildTeamIdentityContext()
		const diagnostics = resolveTeamIdentities(identityContext)

		context.body = {
			...diagnostics,
			context: {
				themeTree: identityContext.themeTree,
				fastcup: {
					matchId: identityContext.fastcup?.config?.matchId || '',
					providerActive: !!identityContext.fastcup?.config?.providerActive,
					sideSource: identityContext.fastcup?.sideSource || null,
					team1: identityContext.fastcup?.match?.teams?.team1?.name || null,
					team2: identityContext.fastcup?.match?.teams?.team2?.name || null,
				},
				komplettligaen: {
					matchId: identityContext.komplettligaen.config?.matchId || '',
					source: identityContext.komplettligaen.source,
					stale: identityContext.komplettligaen.stale,
					home: identityContext.komplettligaen.match?.home || null,
					away: identityContext.komplettligaen.match?.away || null,
				},
				session: identityContext.session
					? {
						id: identityContext.session.id,
						status: identityContext.session.status,
						teams: identityContext.session.teams,
					}
					: null,
				slots: {
					CT: identityContext.slots.ct.sidebarSlot,
					T: identityContext.slots.t.sidebarSlot,
				},
			},
		}
	})

	router.get('/api/diagnostics/broadcast-readiness', async (context) => {
		const identityContext = await buildTeamIdentityContext()
		const identity = resolveTeamIdentities(identityContext)
		const cacheStatus = await getCacheMetadata('komplettligaen')
		const activePackage = getActivePackageStatus()

		const fastcupActive = !!identityContext.fastcup?.config?.providerActive
		const fastcupLoaded = !!identityContext.fastcup?.match

		const warningCount = identity.warnings.length
			+ Object.values(identity.teams).reduce((count, team) => count + (team.final.warnings?.length || 0), 0)
			+ (activePackage.warnings?.length || 0)
			+ (cacheStatus.stale ? 1 : 0)
			+ (!identityContext.komplettligaen.match && !fastcupLoaded ? 1 : 0)

		const connectedClients = websocket?.websocket?.clients?.size ?? 0
		const gsiConnected = isUiDevMode || !!additionalState.gsiActive || !!gsiState.map?.name

		const fcWarnings = []
		if (fastcupActive && !fastcupLoaded) {
			fcWarnings.push('FastCup sync enabled but no match payload is loaded.')
		}

		context.body = {
			generatedAt: new Date().toISOString(),
			ready: gsiConnected && (fastcupLoaded || !!identityContext.komplettligaen.match) && warningCount === 0,
			warningCount: warningCount + fcWarnings.length,
			gsi: {
				connected: gsiConnected,
				uiDevMode: isUiDevMode,
				mapName: gsiState.map?.name || null,
				phase: gsiState.phase_countdowns?.phase || gsiState.round?.phase || null,
			},
			fastcup: {
				active: fastcupActive,
				loaded: fastcupLoaded,
				matchId: identityContext.fastcup?.config?.matchId || '',
				format: identityContext.fastcup?.match?.format || null,
				sideSource: identityContext.fastcup?.sideSource || null,
			},
			komplettligaen: {
				loaded: !!identityContext.komplettligaen.match,
				matchId: identityContext.komplettligaen.config?.matchId || '',
				source: identityContext.komplettligaen.source,
				stale: !!identityContext.komplettligaen.stale,
				home: identityContext.komplettligaen.match?.home?.name || null,
				away: identityContext.komplettligaen.match?.away?.name || null,
			},
			teamIdentity: {
				healthy: identity.warnings.length === 0,
				warningCount: identity.warnings.length,
				ct: identity.teams.CT.final,
				t: identity.teams.T.final,
			},
			package: {
				active: !!activePackage.active,
				name: activePackage.state?.activePackageName || activePackage.package?.name || null,
				id: activePackage.state?.activePackageId || activePackage.package?.id || null,
				warningCount: activePackage.warnings?.length || 0,
			},
			hudClients: {
				connected: connectedClients,
			},
			cache: {
				exists: !!cacheStatus.exists,
				stale: !!cacheStatus.stale,
				ageMinutes: cacheStatus.ageMinutes || 0,
				source: cacheStatus.source || null,
			},
			warnings: [
				...identity.warnings,
				...Object.values(identity.teams).flatMap((team) => team.final.warnings || []),
				...(activePackage.warnings || []).map((warning) => warning.message || warning.code || String(warning)),
				...fcWarnings,
				...(cacheStatus.stale ? ['Komplettligaen cache is stale.'] : []),
				...(!identityContext.komplettligaen.match && !fastcupLoaded ? ['No GG Arena or FastCup match loaded.'] : []),
			],
		}
	})
}

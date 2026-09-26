import { mkdir } from 'fs/promises'

import { merge } from 'lodash-es'

import { builtinThemesDirectory, customThemesDirectory, userspaceBombsitesPath, userspaceDirectory, userspaceRadarsPath, userspaceSettingsPath } from './helpers/paths.js'
import { fileExists } from './helpers/file-exists.js'
import { readJson, readJsonIfExists, writeJson } from './helpers/json-file.js'
import { LEGACY_TO_CANONICAL, getDeprecatedAliases } from './helpers/canonical-map.js'
import { isUiDevMode } from './dev-mode.js'

const loggedLegacyKeys = new Set()
const warnedLegacyKeys = new Set()

export const normalizeSettingsOptions = (settings) => {
	if (!settings || !settings.options) return settings

	const normalizedOptions = {}

	// First, copy all non-legacy/canonical/unmigrated options
	for (const [key, data] of Object.entries(settings.options)) {
		const canonicalKey = LEGACY_TO_CANONICAL[key]
		if (!canonicalKey) {
			if (!normalizedOptions[key]) {
				normalizedOptions[key] = { ...data }
			} else {
				normalizedOptions[key] = merge({}, normalizedOptions[key], data)
			}
		}
	}

	// Then, map legacy options to their canonical equivalents, merging metadata and values
	const deprecatedMeta = getDeprecatedAliases()
	for (const [key, data] of Object.entries(settings.options)) {
		const canonicalKey = LEGACY_TO_CANONICAL[key]
		if (canonicalKey) {
			// Only warn when the canonical key has no user-provided value yet.
			// Suppresses noise from inherited legacy default definitions when userspace
			// already uses the canonical key — while still warning for genuinely
			// unresolved legacy keys (e.g. imported old configs).
			const canonicalAlreadyHasValue = normalizedOptions[canonicalKey]?.value !== undefined
			if (!warnedLegacyKeys.has(key) && !canonicalAlreadyHasValue) {
				warnedLegacyKeys.add(key)
				const meta = deprecatedMeta[key]
				if (meta) {
					console.warn(
						`\n[Deprecation Warning] Legacy configuration alias "${key}" is transitional/deprecated.` +
						` Please update to the canonical key "${canonicalKey}".` +
						`\n  - Lifecycle: introduced in ${meta.introducedIn || 'N/A'}, canonical since ${meta.canonicalSince || 'N/A'}` +
						`\n  - Sunset: phase "${meta.sunsetPhase || 'N/A'}", scheduled for removal in version "${meta.removeAfter || 'N/A'}"` +
						`\n  - To resolve: Save your configuration in the Config SPA to automatically migrate userspace keys to canonical equivalents.\n`
					)
				} else {
					console.warn(`[Deprecation Warning] Legacy configuration alias "${key}" is transitional/deprecated. Please update to "${canonicalKey}".`)
				}
			}

			if (!normalizedOptions[canonicalKey]) {
				normalizedOptions[canonicalKey] = {}
			}

			const canonicalExisting = normalizedOptions[canonicalKey]
			const mergedData = merge({}, data, canonicalExisting)

			if (canonicalExisting.value !== undefined) {
				mergedData.value = canonicalExisting.value
			} else if (data.value !== undefined) {
				mergedData.value = data.value
			}

			normalizedOptions[canonicalKey] = mergedData
		}
	}

	// Add lightweight dev telemetry logging
	if (isUiDevMode) {
		const detected = []
		for (const key of Object.keys(settings.options)) {
			if (LEGACY_TO_CANONICAL[key] && !loggedLegacyKeys.has(key)) {
				detected.push(key)
				loggedLegacyKeys.add(key)
			}
		}
		if (detected.length > 0) {
			console.log(`[Telemetry] Normalized in-memory legacy keys to canonical in dev mode: ${detected.join(', ')}`)
		}
	}

	settings.options = normalizedOptions
	return settings
}

export const initSettings = async () => {
	if (await fileExists(userspaceSettingsPath)) return

	await mkdir(userspaceDirectory, { recursive: true })

	await writeJson(userspaceSettingsPath, {
		parent: 'default',
	})
}

export const getSettings = async () => {
	const themeTree = ['userspace']

	const bombsiteObjects = [await readJsonIfExists(userspaceBombsitesPath)]
	const radarObjects = [await readJsonIfExists(userspaceRadarsPath)]
	const settingsObjects = [await readJson(userspaceSettingsPath)]

	while (settingsObjects[settingsObjects.length - 1].parent) {
		const parent = settingsObjects[settingsObjects.length - 1].parent
		themeTree.push(parent)

		let themeData
		if (await fileExists(`${customThemesDirectory}/${parent}/theme.json`)) {
			themeData = await readJson(`${customThemesDirectory}/${parent}/theme.json`)
		} else if (await fileExists(`${builtinThemesDirectory}/${parent}/theme.json`)) {
			themeData = await readJson(`${builtinThemesDirectory}/${parent}/theme.json`)
		} else {
			throw new Error(`Theme "${parent}" not found. Please change the "theme" value in cs-hud/userspace/theme.json.`)
		}

		if (themeData && typeof themeData === 'object') {
			if (!themeData.name && !themeData.parent) {
				console.warn(`Warning: Theme "${parent}" missing valid schema properties (name/parent).`)
			}
			settingsObjects.push(themeData)
		}

		if (await fileExists(`${customThemesDirectory}/${parent}/bombsites.json`)) {
			bombsiteObjects.push(
				await readJson(`${customThemesDirectory}/${parent}/bombsites.json`),
			)
		} else if (await fileExists(`${builtinThemesDirectory}/${parent}/bombsites.json`)) {
			bombsiteObjects.push(
				await readJson(`${builtinThemesDirectory}/${parent}/bombsites.json`),
			)
		}

		if (await fileExists(`${customThemesDirectory}/${parent}/radars.json`)) {
			radarObjects.push(
				await readJson(`${customThemesDirectory}/${parent}/radars.json`),
			)
		} else if (await fileExists(`${builtinThemesDirectory}/${parent}/radars.json`)) {
			radarObjects.push(
				await readJson(`${builtinThemesDirectory}/${parent}/radars.json`),
			)
		}
	}

	const result = {
		themeTree,

		bombsites: merge({}, ...bombsiteObjects.reverse()),
		radars: merge({}, ...radarObjects.reverse()),
		settings: merge({}, ...settingsObjects.reverse()),
	}

	result.settings = normalizeSettingsOptions(result.settings)

	return result
}

export const getThemeTree = async (firstTheme = 'userspace') => {
	const themeTree = [firstTheme]

	// make sure we don't end up in this loop forever
	for (let i = 0; i < 16; i++) {
		let settingsObject

		if (await fileExists(`${customThemesDirectory}/${themeTree[themeTree.length - 1]}/theme.json`)) {
			settingsObject = await readJson(`${customThemesDirectory}/${themeTree[themeTree.length - 1]}/theme.json`)
		} else if (await fileExists(`${builtinThemesDirectory}/${themeTree[themeTree.length - 1]}/theme.json`)) {
			settingsObject = await readJson(`${builtinThemesDirectory}/${themeTree[themeTree.length - 1]}/theme.json`)
		} else {
			throw new Error(`Theme "${themeTree[themeTree.length - 1]}" not found`)
		}

		if (! settingsObject?.parent) return themeTree

		themeTree.push(settingsObject.parent)
	}

	return themeTree
}

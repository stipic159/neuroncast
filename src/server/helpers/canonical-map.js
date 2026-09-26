// Dynamically constructed two-way mapping dictionary between legacy layout/style/theme keys and clean canonical keys.
// Loaded directly from theme option slices to avoid duplicate maintenance.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the option-slices directory
const slicesDir = path.resolve(__dirname, '../../themes/raw/core/option-slices')

export const LEGACY_TO_CANONICAL = {}
export const CANONICAL_TO_LEGACY = {}

const ALL_DEFINITIONS = []

try {
	const files = await fs.readdir(slicesDir)
	const jsFiles = files.filter(f => f.endsWith('.js'))

	for (const file of jsFiles) {
		const filePath = path.join(slicesDir, file)
		const fileUrl = pathToFileURL(filePath).href
		const module = await import(fileUrl)

		// Aggregate all exported definition arrays from this slice
		for (const key of Object.keys(module)) {
			const definitionsList = module[key]
			if (Array.isArray(definitionsList)) {
				definitionsList.forEach(def => {
					ALL_DEFINITIONS.push(def)
					if (def.canonical && def.aliases) {
						def.aliases.forEach(alias => {
							LEGACY_TO_CANONICAL[alias] = def.canonical
						})
					}
				})
			}
		}
	}

	// Construct CANONICAL_TO_LEGACY bidirectional mapping
	for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
		if (!CANONICAL_TO_LEGACY[canonical]) {
			CANONICAL_TO_LEGACY[canonical] = []
		}
		CANONICAL_TO_LEGACY[canonical].push(legacy)
	}
} catch (error) {
	console.error('[Error] Failed to dynamically construct canonical-map from option-slices:', error)
}

/**
 * Aggregates all defined legacy aliases with their metadata and canonical targets.
 * @returns {Object} Object mapping each legacy alias key to its full deprecation/lifecycle details.
 */
export function getDeprecatedAliases() {
	const deprecated = {}
	for (const def of ALL_DEFINITIONS) {
		if (def.lifecycle && def.lifecycle.aliases) {
			for (const [alias, meta] of Object.entries(def.lifecycle.aliases)) {
				deprecated[alias] = {
					canonical: def.canonical,
					introducedIn: def.lifecycle.introducedIn,
					canonicalSince: def.lifecycle.canonicalSince,
					...meta
				}
			}
		}
	}
	return deprecated
}

/**
 * Identifies legacy aliases that are scheduled for sunset in a target release.
 * @param {string} targetRelease Release version to filter by (e.g. 'v2.0.0' or '2.0.0').
 * @returns {Object} Legacy aliases scheduled for removal in targetRelease.
 */
export function getSunsetCandidates(targetRelease) {
	if (!targetRelease) return {}
	const releaseStr = targetRelease.startsWith('v') ? targetRelease : `v${targetRelease}`
	const deprecated = getDeprecatedAliases()
	const candidates = {}
	for (const [alias, meta] of Object.entries(deprecated)) {
		if (meta.removeAfter === releaseStr) {
			candidates[alias] = meta
		}
	}
	return candidates
}


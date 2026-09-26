import { options } from '/hud/core/state.js'

import { RADAR_OPTION_DEFINITIONS } from '/hud/core/option-slices/radar.js'
import { TOPBAR_OPTION_DEFINITIONS } from '/hud/core/option-slices/topbar.js'
import { SIDEBAR_POSITION_OPTION_DEFINITIONS, SIDEBAR_VISIBILITY_OPTION_DEFINITIONS } from '/hud/core/option-slices/sidebar.js'
import { PLAYERS_ALIVE_OPTION_DEFINITIONS } from '/hud/core/option-slices/players-alive.js'
import { FOCUSED_PLAYER_OPTION_DEFINITIONS } from '/hud/core/option-slices/focused-player.js'
import { CURRENT_MAP_OPTION_DEFINITIONS } from '/hud/core/option-slices/current-map.js'
import { EVENT_BADGE_OPTION_DEFINITIONS } from '/hud/core/option-slices/event-badge.js'
import { SPONSOR_OPTION_DEFINITIONS } from '/hud/core/option-slices/sponsors.js'
import { MAPS_OPTION_DEFINITIONS } from '/hud/core/option-slices/maps.js'
import { THEME_MATERIALS_OPTION_DEFINITIONS } from '/hud/core/option-slices/theme-materials.js'
import { THEME_COLORS_OPTION_DEFINITIONS } from '/hud/core/option-slices/theme-colors.js'
import { THEME_SHAPES_OPTION_DEFINITIONS } from '/hud/core/option-slices/theme-shapes.js'
import { THEME_TYPOGRAPHY_OPTION_DEFINITIONS } from '/hud/core/option-slices/theme-typography.js'

// Re-export option definitions for seamless backwards compatibility
export {
	RADAR_OPTION_DEFINITIONS,
	TOPBAR_OPTION_DEFINITIONS,
	SIDEBAR_POSITION_OPTION_DEFINITIONS,
	SIDEBAR_VISIBILITY_OPTION_DEFINITIONS,
	PLAYERS_ALIVE_OPTION_DEFINITIONS,
	FOCUSED_PLAYER_OPTION_DEFINITIONS,
	CURRENT_MAP_OPTION_DEFINITIONS,
	EVENT_BADGE_OPTION_DEFINITIONS,
	SPONSOR_OPTION_DEFINITIONS,
	MAPS_OPTION_DEFINITIONS,
	THEME_MATERIALS_OPTION_DEFINITIONS,
	THEME_COLORS_OPTION_DEFINITIONS,
	THEME_SHAPES_OPTION_DEFINITIONS,
	THEME_TYPOGRAPHY_OPTION_DEFINITIONS
}

// Build LEGACY_OPTION_ALIASES dynamically at runtime from imported definitions
export const LEGACY_OPTION_ALIASES = {}

const allDefinitionsLists = [
	RADAR_OPTION_DEFINITIONS,
	TOPBAR_OPTION_DEFINITIONS,
	SIDEBAR_POSITION_OPTION_DEFINITIONS,
	SIDEBAR_VISIBILITY_OPTION_DEFINITIONS,
	PLAYERS_ALIVE_OPTION_DEFINITIONS,
	FOCUSED_PLAYER_OPTION_DEFINITIONS,
	CURRENT_MAP_OPTION_DEFINITIONS,
	EVENT_BADGE_OPTION_DEFINITIONS,
	SPONSOR_OPTION_DEFINITIONS,
	MAPS_OPTION_DEFINITIONS,
	THEME_MATERIALS_OPTION_DEFINITIONS,
	THEME_COLORS_OPTION_DEFINITIONS,
	THEME_SHAPES_OPTION_DEFINITIONS,
	THEME_TYPOGRAPHY_OPTION_DEFINITIONS
]

allDefinitionsLists.forEach(definitionsList => {
	definitionsList.forEach(def => {
		if (def.canonical && def.aliases) {
			LEGACY_OPTION_ALIASES[def.canonical] = def.aliases
		}
	})
})




/**
 * Resolves an option from the unified store, falling back to legacy aliases or default.
 * @param {string} canonicalKey - The canonical key path
 * @param {any} fallback - The absolute default fallback value
 * @returns {any} Option value
 */
export function resolveOption(canonicalKey, fallback = null) {
	// 1. Check canonical key
	if (options[canonicalKey] !== undefined && options[canonicalKey] !== null) {
		return options[canonicalKey]
	}

	// 2. Check legacy aliases in order
	const aliases = LEGACY_OPTION_ALIASES[canonicalKey] || []
	for (const alias of aliases) {
		if (options[alias] !== undefined && options[alias] !== null) {
			return options[alias]
		}
	}

	// 3. Fallback to default
	return fallback
}

function hexToRgb(hex) {
	if (!hex.startsWith('#')) return hex
	let s = hex.substring(1)
	if (s.length === 3) s = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
	const r = parseInt(s.substring(0, 2), 16)
	const g = parseInt(s.substring(2, 4), 16)
	const b = parseInt(s.substring(4, 6), 16)
	return `${r}, ${g}, ${b}`
}

/**
 * Wraps resolveOption for CSS-specific processing.
 */
export function resolveCssOption(canonicalKey, fallback = null) {
	const val = resolveOption(canonicalKey, fallback)
	if (typeof val === 'string' && val.startsWith('#') && (canonicalKey.includes('colors.') || canonicalKey.endsWith('-rgb'))) {
		return hexToRgb(val)
	}
	return val
}

/**
 * Returns all canonical keys and legacy aliases from definitions flattened into a single array.
 * @param {Array} definitions - The option definitions list
 * @returns {string[]} Flattened array of migrated option keys
 */
export function getMigratedOptionKeys(definitions) {
	const keys = []
	definitions.forEach(def => {
		if (def.canonical) {
			keys.push(def.canonical)
		}
		if (def.aliases) {
			keys.push(...def.aliases)
		}
	})
	return keys
}

/**
 * Applies a list of option definitions as CSS variables on document.documentElement.
 * @param {Array} definitions - The array of definitions to apply
 */
export function applyResolvedCssVariables(definitions) {
	definitions.forEach(def => {
		const val = resolveCssOption(def.canonical, def.fallback)
		if (val === undefined || val === null) return

		// TEMP DIAG: confirm resolve-option sees the correct options object identity and values
		if (def.canonical && def.canonical.startsWith('layout.radar')) {
			console.log('[resolve-option] applyResolved', def.canonical, '=', val, '| options ref id:', options.__diagId ?? (options.__diagId = Math.random().toString(36).slice(2, 7)))
		}

		if (def.cssVars) {
			def.cssVars.forEach(v => {
				if (val === '') {
					document.documentElement.style.removeProperty(v)
				} else {
					document.documentElement.style.setProperty(v, val)
				}
			})
		}
	})
}

import { options } from '/hud/core/state.js'

import { RADAR_OPTION_DEFINITIONS } from '/hud/core/option-slices/radar.js'
import { TOPBAR_OPTION_DEFINITIONS } from '/hud/core/option-slices/topbar.js'
import { SIDEBAR_POSITION_OPTION_DEFINITIONS, SIDEBAR_VISIBILITY_OPTION_DEFINITIONS } from '/hud/core/option-slices/sidebar.js'
import { PLAYERS_ALIVE_OPTION_DEFINITIONS } from '/hud/core/option-slices/players-alive.js'
import { FOCUSED_PLAYER_OPTION_DEFINITIONS } from '/hud/core/option-slices/focused-player.js'
import { CURRENT_MAP_OPTION_DEFINITIONS } from '/hud/core/option-slices/current-map.js'
import { EVENT_BADGE_OPTION_DEFINITIONS } from '/hud/core/option-slices/event-badge.js'
import { SERIES_OPTION_DEFINITIONS } from '/hud/core/option-slices/series.js'
import { SPONSOR_OPTION_DEFINITIONS } from '/hud/core/option-slices/sponsors.js'
import { MAPS_OPTION_DEFINITIONS } from '/hud/core/option-slices/maps.js'
import { PROMOTION_OPTION_DEFINITIONS } from '/hud/core/option-slices/promotion.js'
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
	SERIES_OPTION_DEFINITIONS,
	SPONSOR_OPTION_DEFINITIONS,
	MAPS_OPTION_DEFINITIONS,
	PROMOTION_OPTION_DEFINITIONS,
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
	SERIES_OPTION_DEFINITIONS,
	SPONSOR_OPTION_DEFINITIONS,
	MAPS_OPTION_DEFINITIONS,
	PROMOTION_OPTION_DEFINITIONS,
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
	let val = resolveOption(canonicalKey, fallback)
	if (val === undefined || val === null) return val

	// Normalize boolean or visibility values to valid CSS display strings
	if (
		canonicalKey.endsWith('.visible') ||
		canonicalKey.includes('.visible') ||
		canonicalKey.endsWith('-display')
	) {
		if (val === true || val === 'true' || val === 'flex' || val === 'block') {
			return (fallback === 'block' || fallback === 'flex') ? fallback : 'flex'
		}
		if (val === false || val === 'false' || val === 'none') {
			return 'none'
		}
	}

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
 * Applies a list of option definitions as CSS variables on target (defaults to document.documentElement).
 * Also synchronizes document.documentElement if a distinct element target was provided.
 * @param {Array} definitions - The array of definitions to apply
 * @param {HTMLElement} [target=document.documentElement] - Target element to apply styles to
 */
export function applyResolvedCssVariables(definitions, target = (typeof document !== 'undefined' ? document.documentElement : null)) {
	if (!target || typeof document === 'undefined') return

	const root = document.documentElement
	definitions.forEach(def => {
		const val = resolveCssOption(def.canonical, def.fallback)
		if (val === undefined || val === null) return

		if (def.cssVars) {
			def.cssVars.forEach(v => {
				const strVal = String(val)
				if (val === '') {
					target.style.removeProperty(v)
					if (target !== root) root.style.removeProperty(v)
				} else {
					target.style.setProperty(v, strVal)
					if (target !== root) root.style.setProperty(v, strVal)
				}
			})
		}
	})
}

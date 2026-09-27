import fs from 'fs'
import { writeJsonAtomic } from './json-file.js'
import path from 'path'
import { userspaceDirectory, userspaceSettingsPath } from './paths.js'
import { EVENT_THEME_PRESETS } from './theme-presets.js'

const EVENT_THEMES_DIR = path.resolve(userspaceDirectory, 'event-themes')

/**
 * Ensures the event-themes userspace folder exists
 */
function ensureEventThemesDir() {
	try {
		if (!fs.existsSync(EVENT_THEMES_DIR)) {
			fs.mkdirSync(EVENT_THEMES_DIR, { recursive: true })
		}
	} catch (err) {
		console.warn('[ThemeDesignerHelper] Failed to create event-themes root folder:', err)
	}
}

// writeJsonAtomic imported from ./json-file.js


/**
 * Sanitizes a custom theme slug to prevent path traversal and shell injection
 */
export function sanitizeThemeSlug(id) {
	if (!id || typeof id !== 'string') {
		throw new Error('Theme slug ID must be a valid string.')
	}
	const slug = id
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, '-') // collapse non-alphanumerics/hyphens/underscores
		.replace(/-+/g, '-')           // collapse consecutive hyphens
		.replace(/^-+|-+$/g, '')       // trim hyphens
	
	if (!slug) {
		throw new Error('Theme slug ID cannot be empty after sanitization.')
	}
	
	// Boundary check to prevent directory traversal
	const targetPath = path.join(EVENT_THEMES_DIR, `${slug}.json`)
	const relative = path.relative(EVENT_THEMES_DIR, targetPath)
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Path traversal detected inside theme slug ID.')
	}
	
	return slug
}

/**
 * Validates a theme object structure and its tokens boundaries
 */
export function validateEventTheme(theme) {
	if (!theme || typeof theme !== 'object') {
		throw new Error('Theme configurations must be a valid JSON object.')
	}
	if (!theme.name || typeof theme.name !== 'string' || !theme.name.trim()) {
		throw new Error('Theme name is required and must be a non-empty string.')
	}
	
	// Validate tokens
	if (!theme.tokens || typeof theme.tokens !== 'object') {
		throw new Error('Theme tokens structure is required.')
	}
	
	const allowedPrefixes = ['theme.', 'series.', 'sponsors.']
	const rgbRegex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d),\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d),\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/
	
	for (const [key, val] of Object.entries(theme.tokens)) {
		// 1. Prefix checks: only allow theme.*, series.*, and sponsors.* keys
		const hasPrefix = allowedPrefixes.some(pfx => key.startsWith(pfx))
		if (!hasPrefix) {
			throw new Error(`Token mutation rejected: Key "${key}" violates canonical prefix boundaries. Only theme.*, series.*, and sponsors.* prefixes are allowed.`)
		}
		if (key.startsWith('layout.') || key.startsWith('style.')) {
			throw new Error(`Token mutation rejected: Dynamic layout/style overrides ("${key}") are forbidden in event themes.`)
		}
		
		// 2. Local-only customFontUrl font checks
		if (key === 'theme.typography.customFontUrl' && val) {
			const fontUrl = String(val).trim()
			if (fontUrl.includes('://') || /^(https?:)?\/\//i.test(fontUrl) || !fontUrl.startsWith('/hud/')) {
				throw new Error(`Font path rejected: "${val}" is not an offline-safe local URL. Custom fonts must reside under NeuronCast's local path (starting with "/hud/").`)
			}
		}
		
		// 3. Validate RGB color strings
		if (key.startsWith('theme.colors.') && !key.endsWith('Background') && key !== 'theme.colors.accentColor') {
			const colorStr = String(val).trim()
			if (!rgbRegex.test(colorStr)) {
				throw new Error(`Color format rejected: "${key}" must be a valid, comma-separated "R, G, B" color (0-255). Got: "${val}"`)
			}
		}
	}
}

/**
 * Lists all combined built-in presets and custom on-disk event themes
 */
export function listEventThemes() {
	ensureEventThemesDir()
	const results = [...EVENT_THEME_PRESETS]
	
	try {
		const files = fs.readdirSync(EVENT_THEMES_DIR)
		for (const filename of files) {
			if (!filename.endsWith('.json')) continue
			try {
				const fullPath = path.join(EVENT_THEMES_DIR, filename)
				const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
				// Ensure slug/ID matches file base
				content.id = path.basename(filename, '.json')
				content.isCustom = true
				results.push(content)
			} catch (err) {
				console.warn(`[ThemeDesignerHelper] Skipping unreadable custom theme "${filename}":`, err.message)
			}
		}
	} catch (err) {
		console.error('[ThemeDesignerHelper] Failed to read custom event themes from disk:', err)
	}
	
	return results
}

/**
 * Reads a single event theme by ID (supports presets and custom themes)
 */
export function getEventTheme(themeId) {
	// 1. Check presets
	const preset = EVENT_THEME_PRESETS.find(p => p.id === themeId)
	if (preset) return { ...preset, isCustom: false }
	
	// 2. Check custom themes
	ensureEventThemesDir()
	const slug = sanitizeThemeSlug(themeId)
	const themePath = path.join(EVENT_THEMES_DIR, `${slug}.json`)
	
	if (!fs.existsSync(themePath)) return null
	
	const content = JSON.parse(fs.readFileSync(themePath, 'utf8'))
	content.id = slug
	content.isCustom = true
	return content
}

/**
 * Saves a custom event theme to disk atomically
 */
export function saveCustomTheme(themeId, themeData) {
	ensureEventThemesDir()
	const slug = sanitizeThemeSlug(themeId)
	
	// Safeguard: Protect built-in presets from overwrite
	const isPreset = EVENT_THEME_PRESETS.some(p => p.id === slug)
	if (isPreset) {
		throw new Error('Permission Denied: Built-in visual presets are read-only and cannot be overwritten.')
	}
	
	validateEventTheme(themeData)
	
	const targetPath = path.join(EVENT_THEMES_DIR, `${slug}.json`)
	const payload = {
		schemaVersion: '1.0.0',
		id: slug,
		name: themeData.name,
		description: themeData.description || '',
		event: themeData.event || {},
		tokens: themeData.tokens || {}
	}
	
	writeJsonAtomic(targetPath, payload)
	return payload
}

/**
 * Deletes a custom theme from disk
 */
export function deleteCustomTheme(themeId) {
	ensureEventThemesDir()
	const slug = sanitizeThemeSlug(themeId)
	
	// Safeguard: Protect built-in presets
	const isPreset = EVENT_THEME_PRESETS.some(p => p.id === slug)
	if (isPreset) {
		throw new Error('Permission Denied: Built-in presets are read-only and cannot be deleted.')
	}
	
	const targetPath = path.join(EVENT_THEMES_DIR, `${slug}.json`)
	if (fs.existsSync(targetPath)) {
		fs.unlinkSync(targetPath)
		return true
	}
	return false
}

/**
 * Applies a theme's tokens and event configurations to NeuronCast's active options inside theme.json
 */
export function applyThemeToOptions(themeId) {
	const theme = getEventTheme(themeId)
	if (!theme) {
		throw new Error(`Theme "${themeId}" not found.`)
	}
	
	if (!fs.existsSync(userspaceSettingsPath)) {
		throw new Error('NeuronCast master theme.json configuration file not found.')
	}
	
	// Read master configurations
	const masterConfig = JSON.parse(fs.readFileSync(userspaceSettingsPath, 'utf8'))
	if (!masterConfig.options) masterConfig.options = {}
	
	// 1. Merge visual tokens
	for (const [key, val] of Object.entries(theme.tokens)) {
		if (!masterConfig.options[key]) {
			masterConfig.options[key] = {}
		}
		masterConfig.options[key].value = val
	}
	
	// 2. Merge event branding details
	if (theme.event) {
		const mapping = {
			'series.name.center': theme.event.name,
			'series.name.left': theme.event.subtitle,
			'series.logoUrl': theme.event.logo,
		}

		for (const [key, val] of Object.entries(mapping)) {
			if (val !== undefined && val !== null) {
				if (!masterConfig.options[key]) {
					masterConfig.options[key] = {}
				}
				masterConfig.options[key].value = val
			}
		}

		// Only write sponsor titles when sponsorFlavor is explicitly provided and non-empty.
		// Built-in presets omit sponsorFlavor to prevent fake sponsor panels from appearing.
		if (theme.event.sponsorFlavor) {
			for (const sponsorKey of ['sponsors.left.title', 'sponsors.right.title']) {
				if (!masterConfig.options[sponsorKey]) {
					masterConfig.options[sponsorKey] = {}
				}
				masterConfig.options[sponsorKey].value = theme.event.sponsorFlavor
			}
		}
	}
	
	// Write atomic update to theme.json
	writeJsonAtomic(userspaceSettingsPath, masterConfig)
	return masterConfig
}

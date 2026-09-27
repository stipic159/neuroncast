import fs from 'fs'
import { writeJsonAtomicSync } from './json-file.js'
import path from 'path'
import { userspaceDirectory, userspaceSettingsPath } from './paths.js'

const LAYOUTS_DIR = path.resolve(userspaceDirectory, 'layouts')

/**
 * Ensures the layouts userspace folder exists
 */
export function ensureLayoutsDir() {
	try {
		if (!fs.existsSync(LAYOUTS_DIR)) {
			fs.mkdirSync(LAYOUTS_DIR, { recursive: true })
		}
	} catch (err) {
		console.warn('[LayoutPresetHelper] Failed to create layouts root folder:', err)
	}
}

/**
 * Sanitizes a custom layout slug to prevent path traversal and shell injection
 */
export function sanitizeLayoutSlug(id) {
	if (!id || typeof id !== 'string') {
		throw new Error('Layout slug ID must be a valid string.')
	}
	
	// Pre-sanitization check to immediately catch traversal/injection attempts
	if (id.includes('..') || id.includes('/') || id.includes('\\')) {
		throw new Error('Path traversal detected inside layout slug ID.')
	}
	
	const slug = id
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, '-') // collapse non-alphanumerics/hyphens/underscores
		.replace(/-+/g, '-')           // collapse consecutive hyphens
		.replace(/^-+|-+$/g, '')       // trim hyphens
	
	if (!slug) {
		throw new Error('Layout slug ID cannot be empty after sanitization.')
	}
	
	// Boundary check to prevent directory traversal
	const targetPath = path.join(LAYOUTS_DIR, `${slug}.json`)
	const relative = path.relative(LAYOUTS_DIR, targetPath)
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Path traversal detected inside layout slug ID.')
	}
	
	return slug
}

/**
 * Validates a layout preset object structure and its options boundaries
 */
export function validateLayoutPreset(layout) {
	if (!layout || typeof layout !== 'object') {
		throw new Error('Layout configurations must be a valid JSON object.')
	}
	if (!layout.name || typeof layout.name !== 'string' || !layout.name.trim()) {
		throw new Error('Layout name is required and must be a non-empty string.')
	}
	if (!layout.options || typeof layout.options !== 'object') {
		throw new Error('Layout options structure is required.')
	}
	
	const allowedKeys = [
		'style.eventBadge.width',
		'style.currentMap.width',
		'style.sponsors.width',
		'style.sponsors.height',
		'style.maps.scale',
		'style.mapsSleek.scale'
	]
	
	for (const [key, obj] of Object.entries(layout.options)) {
		// 1. Explicit rejections:
		if (key.startsWith('theme.') || key.startsWith('series.') || key.startsWith('sponsors.')) {
			throw new Error(`Option key rejected: "${key}" is theme/series branding and cannot be modified via layout presets.`)
		}
		
		if (key === 'css.lan66-sidebar-scale-y' || key === 'css.top-bar-width') {
			throw new Error(`Option key rejected: Legacy key "${key}" is deprecated and forbidden.`)
		}
		
		if (key.startsWith('css.')) {
			throw new Error(`Option key rejected: Unknown CSS override "${key}". Only canonical keys are allowed.`)
		}

		// 2. Key must be in allowed list or start with 'layout.'
		const isLayoutKey = key.startsWith('layout.')
		const isAllowedStyleKey = allowedKeys.includes(key)
		
		if (!isLayoutKey && !isAllowedStyleKey) {
			throw new Error(`Option key rejected: "${key}" is not allowed in layout presets. Only layout.* and specific style width/scale keys are permitted.`)
		}
		
		// 3. Validate that value property exists
		if (!obj || typeof obj !== 'object' || obj.value === undefined || obj.value === null) {
			throw new Error(`Option structure rejected: Key "${key}" must contain an object with a "value" property.`)
		}
	}
}

/**
 * Lists all custom on-disk layout presets
 */
export function listLayoutPresets() {
	ensureLayoutsDir()
	const results = []
	
	try {
		const files = fs.readdirSync(LAYOUTS_DIR)
		for (const filename of files) {
			if (!filename.endsWith('.json')) continue
			try {
				const fullPath = path.join(LAYOUTS_DIR, filename)
				const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
				// Ensure slug/ID matches file base
				content.id = path.basename(filename, '.json')
				content.isCustom = true
				results.push(content)
			} catch (err) {
				console.warn(`[LayoutPresetHelper] Skipping unreadable custom layout preset "${filename}":`, err.message)
			}
		}
	} catch (err) {
		console.error('[LayoutPresetHelper] Failed to read custom layout presets from disk:', err)
	}
	
	return results
}

/**
 * Reads a single layout preset by ID
 */
export function getLayoutPreset(layoutId) {
	ensureLayoutsDir()
	const slug = sanitizeLayoutSlug(layoutId)
	const themePath = path.join(LAYOUTS_DIR, `${slug}.json`)
	
	if (!fs.existsSync(themePath)) return null
	
	try {
		const content = JSON.parse(fs.readFileSync(themePath, 'utf8'))
		content.id = slug
		content.isCustom = true
		return content
	} catch (err) {
		console.warn(`[LayoutPresetHelper] Failed to parse custom layout "${slug}":`, err.message)
		return null
	}
}

/**
 * Saves a custom layout preset to disk atomically and synchronously
 */
export function saveLayoutPreset(layoutId, layoutData) {
	ensureLayoutsDir()
	const slug = sanitizeLayoutSlug(layoutId)
	
	validateLayoutPreset(layoutData)
	
	const targetPath = path.join(LAYOUTS_DIR, `${slug}.json`)
	
	// Reformat options values cleanly
	const formattedOptions = {}
	for (const [key, obj] of Object.entries(layoutData.options)) {
		formattedOptions[key] = { value: String(obj.value).trim() }
	}
	
	const payload = {
		schemaVersion: '1.0.0',
		id: slug,
		name: layoutData.name.trim(),
		description: layoutData.description ? layoutData.description.trim() : '',
		createdAt: layoutData.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		target: {
			width: 1920,
			height: 1080
		},
		options: formattedOptions
	}
	
	writeJsonAtomicSync(targetPath, payload)
	return payload
}

/**
 * Deletes a custom layout preset from disk
 */
export function deleteLayoutPreset(layoutId) {
	ensureLayoutsDir()
	const slug = sanitizeLayoutSlug(layoutId)
	
	const targetPath = path.join(LAYOUTS_DIR, `${slug}.json`)
	if (fs.existsSync(targetPath)) {
		fs.unlinkSync(targetPath)
		return true
	}
	return false
}

/**
 * Applies a layout preset's coordinates to NeuronCast's active options inside theme.json
 */
export function applyLayoutPresetToOptions(layoutId) {
	const layout = getLayoutPreset(layoutId)
	if (!layout) {
		throw new Error(`Layout preset "${layoutId}" not found.`)
	}
	
	if (!fs.existsSync(userspaceSettingsPath)) {
		throw new Error('NeuronCast master theme.json configuration file not found.')
	}
	
	// Read master configurations
	const masterConfig = JSON.parse(fs.readFileSync(userspaceSettingsPath, 'utf8'))
	if (!masterConfig.options) masterConfig.options = {}
	
	// Merge option values selectively
	validateLayoutPreset(layout) // double check validation before merge
	
	for (const [key, obj] of Object.entries(layout.options)) {
		if (!masterConfig.options[key]) {
			masterConfig.options[key] = {}
		}
		masterConfig.options[key].value = obj.value
	}
	
	// Write atomic update to theme.json synchronously
	writeJsonAtomicSync(userspaceSettingsPath, masterConfig)
	return masterConfig
}

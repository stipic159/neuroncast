import fs from 'fs'
import { writeJsonAtomic } from './json-file.js'
import path from 'path'
import { userspaceDirectory, userspaceSettingsPath } from './paths.js'
import { applyThemeToOptions } from './theme-designer-helper.js'
import { applyLayoutPresetToOptions } from './layout-preset-helper.js'

const PACKAGES_DIR = path.resolve(userspaceDirectory, 'event-packages')
const PACKAGE_STATE_PATH = path.resolve(userspaceDirectory, 'package-state.json')

const ALLOWED_OPTION_PREFIXES = ['series.', 'sponsors.', 'promotion.', 'cvars.', 'preferences.', 'match.']

export function ensurePackagesDir() {
	try {
		if (!fs.existsSync(PACKAGES_DIR)) {
			fs.mkdirSync(PACKAGES_DIR, { recursive: true })
		}
	} catch (err) {
		console.warn('[EventPackageHelper] Failed to create event-packages folder:', err)
	}
}

// writeJsonAtomic imported from ./json-file.js

export function sanitizePackageSlug(id) {
	if (!id || typeof id !== 'string') {
		throw new Error('Package slug ID must be a valid string.')
	}

	if (id.includes('..') || id.includes('/') || id.includes('\\')) {
		throw new Error('Path traversal detected inside package slug ID.')
	}

	const slug = id
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')

	if (!slug) {
		throw new Error('Package slug ID cannot be empty after sanitization.')
	}

	const targetPath = path.join(PACKAGES_DIR, `${slug}.json`)
	const relative = path.relative(PACKAGES_DIR, targetPath)
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Path traversal detected inside package slug ID.')
	}

	return slug
}

export function validatePackage(pkg) {
	if (!pkg || typeof pkg !== 'object') {
		throw new Error('Package must be a valid JSON object.')
	}
	if (!pkg.name || typeof pkg.name !== 'string' || !pkg.name.trim()) {
		throw new Error('Package name is required and must be a non-empty string.')
	}

	if (pkg.branding?.logoUrl) {
		const url = String(pkg.branding.logoUrl).trim()
		if (url && !url.startsWith('/hud/')) {
			throw new Error(`Logo URL must be a local /hud/ path. Got: "${pkg.branding.logoUrl}"`)
		}
	}

	if (pkg.sponsors?.rotationInterval != null) {
		const interval = Number(pkg.sponsors.rotationInterval)
		if (!Number.isFinite(interval) || interval <= 0) {
			throw new Error('sponsors.rotationInterval must be a positive number.')
		}
	}

	if (pkg.options && typeof pkg.options === 'object') {
		for (const [key, obj] of Object.entries(pkg.options)) {
			const allowed = ALLOWED_OPTION_PREFIXES.some(pfx => key.startsWith(pfx))
			if (!allowed) {
				throw new Error(
					`Option key rejected: "${key}" is not in an allowed namespace. Allowed prefixes: ${ALLOWED_OPTION_PREFIXES.join(', ')}`
				)
			}
			if (!obj || typeof obj !== 'object' || obj.value === undefined) {
				throw new Error(`Option "${key}" must have a { value } structure.`)
			}
		}
	}
}

export function listPackages() {
	ensurePackagesDir()
	const results = []

	try {
		const files = fs.readdirSync(PACKAGES_DIR)
		for (const filename of files) {
			if (!filename.endsWith('.json')) continue
			try {
				const fullPath = path.join(PACKAGES_DIR, filename)
				const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
				content.id = path.basename(filename, '.json')
				results.push(content)
			} catch (err) {
				console.warn(`[EventPackageHelper] Skipping unreadable package "${filename}":`, err.message)
			}
		}
	} catch (err) {
		console.error('[EventPackageHelper] Failed to read event-packages from disk:', err)
	}

	results.sort((a, b) => {
		const ta = a.updatedAt || a.createdAt || ''
		const tb = b.updatedAt || b.createdAt || ''
		return tb.localeCompare(ta)
	})

	return results
}

export function getPackage(packageId) {
	ensurePackagesDir()
	const slug = sanitizePackageSlug(packageId)
	const pkgPath = path.join(PACKAGES_DIR, `${slug}.json`)

	if (!fs.existsSync(pkgPath)) return null

	try {
		const content = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
		content.id = slug
		return content
	} catch (err) {
		console.warn(`[EventPackageHelper] Failed to parse package "${slug}":`, err.message)
		return null
	}
}

export function packageExists(packageId) {
	try {
		const slug = sanitizePackageSlug(packageId)
		return fs.existsSync(path.join(PACKAGES_DIR, `${slug}.json`))
	} catch {
		return false
	}
}

export function savePackage(packageId, data, { allowOverwrite = false } = {}) {
	ensurePackagesDir()
	const slug = sanitizePackageSlug(packageId)
	const pkgPath = path.join(PACKAGES_DIR, `${slug}.json`)

	if (!allowOverwrite && fs.existsSync(pkgPath)) {
		const err = new Error(`A package with id "${slug}" already exists. Use PUT to update it.`)
		err.code = 'PACKAGE_EXISTS'
		err.id = slug
		throw err
	}

	validatePackage(data)

	let existingCreatedAt = null
	if (allowOverwrite && fs.existsSync(pkgPath)) {
		try {
			const existing = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
			existingCreatedAt = existing.createdAt || null
		} catch (_) {}
	}

	const sponsorsPayload = {}
	if (data.sponsors?.rotationInterval != null) {
		sponsorsPayload.rotationInterval = Number(data.sponsors.rotationInterval)
	}
	if (data.sponsors?.title) {
		sponsorsPayload.title = String(data.sponsors.title).trim()
	}

	const payload = {
		schemaVersion: '1.0.0',
		id: slug,
		name: data.name.trim(),
		description: data.description ? String(data.description).trim() : '',
		branding: {
			title: data.branding?.title ? String(data.branding.title).trim() : '',
			subtitle: data.branding?.subtitle ? String(data.branding.subtitle).trim() : '',
			logoUrl: data.branding?.logoUrl ? String(data.branding.logoUrl).trim() : '',
		},
		themeId: data.themeId ? String(data.themeId).trim() : '',
		layoutPresetId: data.layoutPresetId ? String(data.layoutPresetId).trim() : '',
		sponsors: sponsorsPayload,
		options: data.options || {},
		createdAt: existingCreatedAt || data.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	}

	writeJsonAtomic(pkgPath, payload)
	return payload
}

export function readPackageState() {
	try {
		if (!fs.existsSync(PACKAGE_STATE_PATH)) return null
		return JSON.parse(fs.readFileSync(PACKAGE_STATE_PATH, 'utf8'))
	} catch (err) {
		console.warn('[EventPackageHelper] Failed to read package-state.json:', err.message)
		return null
	}
}

export function writePackageState(state) {
	writeJsonAtomic(PACKAGE_STATE_PATH, state)
}

export function clearPackageState() {
	try {
		if (fs.existsSync(PACKAGE_STATE_PATH)) {
			fs.unlinkSync(PACKAGE_STATE_PATH)
		}
	} catch (err) {
		console.warn('[EventPackageHelper] Failed to clear package-state.json:', err.message)
	}
}

export function getActivePackageStatus() {
	const state = readPackageState()
	if (!state || !state.activePackageId) {
		return { active: false, state: null, package: null, warnings: [] }
	}

	const warnings = [...(state.warnings || [])]
	let pkg = null

	try {
		pkg = getPackage(state.activePackageId)
	} catch (_) {}

	if (!pkg) {
		warnings.push({ code: 'PACKAGE_MISSING', message: 'Active package file no longer exists.' })
		return { active: true, state, package: null, warnings }
	}

	const packageMeta = {
		id: pkg.id,
		name: pkg.name,
		description: pkg.description,
		themeId: pkg.themeId,
		layoutPresetId: pkg.layoutPresetId,
		createdAt: pkg.createdAt,
		updatedAt: pkg.updatedAt,
	}

	return { active: true, state, package: packageMeta, warnings }
}

export function deletePackage(packageId) {
	ensurePackagesDir()
	const slug = sanitizePackageSlug(packageId)
	const pkgPath = path.join(PACKAGES_DIR, `${slug}.json`)

	if (fs.existsSync(pkgPath)) {
		fs.unlinkSync(pkgPath)
		return true
	}
	return false
}

export function captureCurrentAsPackage(opts) {
	const {
		name,
		description = '',
		themeId = '',
		layoutPresetId = '',
		includeSeries = true,
		includeSponsors = true,
		includePreferences = false,
		includeCvars = false,
	} = opts || {}

	if (!name || typeof name !== 'string' || !name.trim()) {
		throw new Error('Package name is required.')
	}

	if (!fs.existsSync(userspaceSettingsPath)) {
		throw new Error('NeuronCast master theme.json configuration file not found.')
	}

	const masterConfig = JSON.parse(fs.readFileSync(userspaceSettingsPath, 'utf8'))
	const activeOptions = masterConfig.options || {}
	const warnings = []
	const capturedOptions = {}
	const branding = { title: '', subtitle: '', logoUrl: '' }
	const sponsors = {}

	// Never capture these — they belong to refs or are match-specific
	const BLOCKED_PREFIXES = ['theme.', 'layout.', 'style.', 'css.', 'teams.']

	// series.* keys that are promoted to the branding block (not duplicated in options)
	const BRANDING_MAP = {
		'series.name.center': 'title',
		'series.name.left':   'subtitle',
		'series.logoUrl':     'logoUrl',
	}

	for (const [key, obj] of Object.entries(activeOptions)) {
		if (!obj || obj.value === undefined || obj.value === null) continue

		if (BLOCKED_PREFIXES.some(pfx => key.startsWith(pfx))) continue

		const val = obj.value

		if (key.startsWith('series.')) {
			if (!includeSeries) continue
			if (key in BRANDING_MAP) {
				branding[BRANDING_MAP[key]] = String(val)
			} else {
				capturedOptions[key] = { value: val }
			}
			continue
		}

		if (key.startsWith('sponsors.')) {
			if (!includeSponsors) continue
			// Promote rotationInterval to the sponsors display block;
			// all sponsors.* also go into options for exact per-slot restore
			if (key === 'sponsors.rotationInterval') {
				sponsors.rotationInterval = Number(val)
			}
			capturedOptions[key] = { value: val }
			continue
		}

		if (key.startsWith('promotion.')) {
			capturedOptions[key] = { value: val }
			continue
		}

		if (key.startsWith('preferences.')) {
			if (!includePreferences) continue
			capturedOptions[key] = { value: val }
			continue
		}

		if (key.startsWith('cvars.')) {
			if (!includeCvars) continue
			capturedOptions[key] = { value: val }
			continue
		}

		// match.mode is safe to capture (broadcast format, not live game state)
		if (key === 'match.mode') {
			capturedOptions[key] = { value: val }
		}
	}

	if (!themeId) warnings.push('No theme selected — apply will not restore visual styling.')
	if (!layoutPresetId) warnings.push('No layout preset selected — apply will not restore HUD positions.')

	// Derive slug from name without risking traversal chars
	const baseSlug = name.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
		|| 'package'

	const packageData = {
		name: name.trim(),
		description: String(description || '').trim(),
		branding,
		themeId: themeId ? String(themeId).trim() : '',
		layoutPresetId: layoutPresetId ? String(layoutPresetId).trim() : '',
		sponsors,
		options: capturedOptions,
	}

	// savePackage enforces conflict protection (throws PACKAGE_EXISTS on collision)
	const saved = savePackage(baseSlug, packageData, { allowOverwrite: false })

	return { package: saved, warnings }
}

export function applyPackage(packageId) {
	const pkg = getPackage(packageId)
	if (!pkg) {
		throw new Error(`Package "${packageId}" not found.`)
	}

	validatePackage(pkg)

	if (!fs.existsSync(userspaceSettingsPath)) {
		throw new Error('NeuronCast master theme.json configuration file not found.')
	}

	const snapshot = fs.readFileSync(userspaceSettingsPath, 'utf8')
	const warnings = []

	try {
		if (pkg.themeId) {
			try {
				applyThemeToOptions(pkg.themeId)
			} catch {
				warnings.push(`Theme "${pkg.themeId}" not found — skipped.`)
			}
		}

		if (pkg.layoutPresetId) {
			try {
				applyLayoutPresetToOptions(pkg.layoutPresetId)
			} catch {
				warnings.push(`Layout preset "${pkg.layoutPresetId}" not found — skipped.`)
			}
		}

		const masterConfig = JSON.parse(fs.readFileSync(userspaceSettingsPath, 'utf8'))
		if (!masterConfig.options) masterConfig.options = {}

		if (pkg.branding?.title) {
			masterConfig.options['series.name.center'] = { value: pkg.branding.title }
		}
		if (pkg.branding?.subtitle) {
			masterConfig.options['series.name.left'] = { value: pkg.branding.subtitle }
		}
		if (pkg.branding?.logoUrl) {
			masterConfig.options['series.logoUrl'] = { value: pkg.branding.logoUrl }
		}

		if (pkg.sponsors?.rotationInterval != null) {
			masterConfig.options['sponsors.rotationInterval'] = { value: pkg.sponsors.rotationInterval }
		}
		if (pkg.sponsors?.title) {
			masterConfig.options['sponsors.left.title'] = { value: pkg.sponsors.title }
			masterConfig.options['sponsors.right.title'] = { value: pkg.sponsors.title }
		}

		for (const [key, obj] of Object.entries(pkg.options || {})) {
			masterConfig.options[key] = { value: obj.value }
		}

		writeJsonAtomic(userspaceSettingsPath, masterConfig)

		try {
			writePackageState({
				schemaVersion: '1.0.0',
				activePackageId: pkg.id,
				activePackageName: pkg.name,
				appliedAt: new Date().toISOString(),
				themeId: pkg.themeId || '',
				layoutPresetId: pkg.layoutPresetId || '',
				warnings,
				source: 'manual-apply',
			})
		} catch (stateErr) {
			console.warn('[EventPackageHelper] Failed to write package-state.json after apply:', stateErr.message)
		}

		return { success: true, warnings }

	} catch (err) {
		try {
			fs.writeFileSync(userspaceSettingsPath, snapshot, 'utf8')
		} catch (rollbackErr) {
			console.error('[EventPackageHelper] CRITICAL: rollback failed after apply error:', rollbackErr)
		}
		throw err
	}
}

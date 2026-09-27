import send from 'koa-send'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getSettings, normalizeSettingsOptions } from './settings.js'
import { readJson, writeJson } from './helpers/json-file.js'
import { builtinRootDirectory, userspaceDirectory, userspaceSettingsPath } from './helpers/paths.js'
import { MODE_PRESETS } from './helpers/game-modes.js'
import { LEGACY_TO_CANONICAL, CANONICAL_TO_LEGACY } from './helpers/canonical-map.js'
import {
	listEventThemes,
	getEventTheme,
	saveCustomTheme,
	deleteCustomTheme,
	applyThemeToOptions
} from './helpers/theme-designer-helper.js'
import {
	listLayoutPresets,
	getLayoutPreset,
	saveLayoutPreset,
	deleteLayoutPreset,
	applyLayoutPresetToOptions
} from './helpers/layout-preset-helper.js'
import {
	listPackages,
	getPackage,
	savePackage,
	deletePackage,
	applyPackage,
	captureCurrentAsPackage,
	getActivePackageStatus,
	clearPackageState,
} from './helpers/event-package-helper.js'

// Константы и пути вынесены на уровень модуля, чтобы не пересоздавать их на каждый запрос
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_FONT_BYTES = 5 * 1024 * 1024  // 5 MB

const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
const ALLOWED_FONT_EXTS = new Set(['woff2', 'woff', 'ttf', 'otf'])

const CONFIG_STATIC_ROOT = join(builtinRootDirectory, 'src/config')
const FONTS_DIRECTORY = join(userspaceDirectory, 'fonts')
const BACKUP_THEME_PATH = join(userspaceDirectory, 'theme.backup.pre-canonical.json')

// Предварительная оценка размера base64 строки без выделения тяжелого Buffer в куче
const getBase64Payload = (base64) => {
	const commaIndex = base64.indexOf(',')
	const cleanStr = commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64
	// 4 символа base64 = 3 байта сырых данных
	const estimatedBytes = (cleanStr.length * 3) / 4
	return { cleanStr, estimatedBytes }
}

const purgeAliases = (options, canonicalKey) => {
	const aliases = CANONICAL_TO_LEGACY[canonicalKey]
	if (aliases) {
		for (const alias of aliases) {
			delete options[alias]
		}
	}
}

export const registerConfigRoutes = (router, websocket) => {
	router.get('/', (context) => {
		context.status = 302
		context.redirect('/hud')
	})

	router.get('/config/options', async (context) => {
		let settings
		try {
			const res = await getSettings()
			settings = res.settings
		} catch (err) {
			console.error('Error getting settings', err)
			settings = { options: {} }
		}

		const options = settings?.options || {}
		const descriptions = settings?.optionSectionDescriptions

		const result = [
			{
				fallback: 'default',
				key: 'theme',
				section: 'Theme',
				type: 'string',
				value: settings?.parent,
			},
		]

		for (const key in options) {
			const data = options[key]
			result.push({
				...data,
				key,
				sectionDescription: descriptions?.[data.section],
			})
		}

		context.body = result
	})

	router.get('/analysis', async (context) => {
		try {
			await send(context, 'analysis.html', { root: CONFIG_STATIC_ROOT })
		} catch (err) {
			context.status = 404
			context.body = 'Analysis view not found'
		}
	})

	router.put('/config/options', async (context) => {
		const settings = await readJson(userspaceSettingsPath)
		normalizeSettingsOptions(settings)

		if (!settings.options) settings.options = {}

		let wasThemeChanged = false
		const incoming = context.request.body || {}

		// 1. Применение пресетов режима
		const currentMode = settings.options['match.mode']?.value
		const newMode = incoming['match.mode']

		if (newMode && newMode !== currentMode) {
			const presets = MODE_PRESETS[newMode]
			if (presets) {
				for (const key in presets) {
					const canonicalKey = LEGACY_TO_CANONICAL[key] || key
					if (!settings.options[canonicalKey]) settings.options[canonicalKey] = {}
					settings.options[canonicalKey].value = presets[key]
					purgeAliases(settings.options, canonicalKey)
				}
			}
		}

		// 2. Обработка входящих настроек
		for (const key in incoming) {
			const value = incoming[key]
			if (key === 'theme') {
				const normalizedTheme = value || 'default'
				wasThemeChanged = settings.parent !== normalizedTheme
				settings.parent = normalizedTheme
			} else {
				const canonicalKey = LEGACY_TO_CANONICAL[key] || key
				if (value != null) {
					if (!settings.options[canonicalKey]) settings.options[canonicalKey] = {}
					settings.options[canonicalKey].value = value
				} else if (settings.options[canonicalKey]) {
					delete settings.options[canonicalKey].value
				}

				purgeAliases(settings.options, canonicalKey)
			}
		}

		await writeJson(userspaceSettingsPath, settings)
		await websocket.updateCaches()

		if (wasThemeChanged) websocket.broadcastRefresh()

		context.status = 204
	})

	router.post('/config/upload-image', async (context) => {
		const { filename, base64 } = context.request.body || {}
		if (!filename || !base64) {
			context.status = 400
			return
		}

		const ext = String(filename).slice(String(filename).lastIndexOf('.') + 1).toLowerCase()
		if (!ALLOWED_IMAGE_EXTS.has(ext)) {
			context.status = 400
			context.body = { error: 'Unsupported file type. Use PNG, JPG, GIF, or WEBP (SVG is rejected for security).' }
			return
		}

		const { cleanStr, estimatedBytes } = getBase64Payload(base64)
		if (estimatedBytes > MAX_IMAGE_BYTES * 1.05) {
			context.status = 413
			context.body = { error: `Image exceeds the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB limit.` }
			return
		}

		try {
			const buffer = Buffer.from(cleanStr, 'base64')
			if (buffer.length > MAX_IMAGE_BYTES) {
				context.status = 413
				context.body = { error: `Image exceeds the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB limit.` }
				return
			}

			const newName = `upload-${Date.now()}.${ext}`
			await writeFile(join(userspaceDirectory, newName), buffer)

			context.body = { url: `/hud/${newName}` }
		} catch (err) {
			console.error('Upload Error:', err)
			context.status = 500
			context.body = { error: 'Failed to save image' }
		}
	})

	router.post('/config/upload-font', async (context) => {
		const { filename, base64 } = context.request.body || {}
		if (!filename || !base64) {
			context.status = 400
			return
		}

		const ext = String(filename).slice(String(filename).lastIndexOf('.') + 1).toLowerCase()
		if (!ALLOWED_FONT_EXTS.has(ext)) {
			context.status = 400
			context.body = { error: 'Unsupported font type' }
			return
		}

		const { cleanStr, estimatedBytes } = getBase64Payload(base64)
		if (estimatedBytes > MAX_FONT_BYTES * 1.05) {
			context.status = 413
			context.body = { error: `Font exceeds the ${Math.round(MAX_FONT_BYTES / (1024 * 1024))} MB limit.` }
			return
		}

		try {
			const buffer = Buffer.from(cleanStr, 'base64')
			if (buffer.length > MAX_FONT_BYTES) {
				context.status = 413
				context.body = { error: `Font exceeds the ${Math.round(MAX_FONT_BYTES / (1024 * 1024))} MB limit.` }
				return
			}

			const fontFamily = String(filename)
				.replace(/\.[^.]+$/, '')
				.replace(/[^a-z0-9_-]+/gi, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 48) || 'uploaded-font'

			const newName = `font-${Date.now()}-${fontFamily}.${ext}`
			const filepath = join(FONTS_DIRECTORY, newName)

			await mkdir(FONTS_DIRECTORY, { recursive: true })
			await writeFile(filepath, buffer)

			context.body = {
				fontFamily,
				url: `/hud/fonts/${newName}`,
			}
		} catch (err) {
			console.error('Font Upload Error:', err)
			context.status = 500
			context.body = { error: 'Failed to save font' }
		}
	})

	router.post('/config/force-hud-refresh', async (context) => {
		websocket.broadcastRefresh()
		context.status = 204
	})

	/* ── Layout Presets CRUD (Phase 18D) ── */
	router.get('/config/layout-presets', (context) => {
		try {
			context.body = listLayoutPresets()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/layout-presets/:id', (context) => {
		try {
			const preset = getLayoutPreset(context.params.id)
			if (!preset) {
				context.status = 404
				context.body = { error: `Layout preset with ID "${context.params.id}" not found.` }
				return
			}
			context.body = preset
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.post('/config/layout-presets', (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('layout-' + Math.random().toString(36).substring(2, 8))
			context.body = saveLayoutPreset(slug, incoming)
			context.status = 201
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.put('/config/layout-presets/:id', (context) => {
		try {
			const incoming = context.request.body || {}
			context.body = saveLayoutPreset(context.params.id, incoming)
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/layout-presets/:id', (context) => {
		try {
			if (!deleteLayoutPreset(context.params.id)) {
				context.status = 404
				context.body = { error: `Layout preset with ID "${context.params.id}" not found.` }
				return
			}
			context.status = 204
		} catch (err) {
			context.status = 403
			context.body = { error: 'Forbidden', message: err.message }
		}
	})

	router.post('/config/layout-presets/:id/apply', async (context) => {
		try {
			applyLayoutPresetToOptions(context.params.id)
			await websocket.updateCaches()
			websocket.broadcastRefresh()
			context.status = 200
			context.body = { success: true, message: `Layout preset "${context.params.id}" applied successfully.` }
		} catch (err) {
			context.status = 400
			context.body = { error: 'Execution Error', message: err.message }
		}
	})

	/* ── Setup Import/Export ── */
	router.get('/config/export', async (context) => {
		const theme = await readJson(userspaceSettingsPath).catch(() => ({}))

		context.body = {
			theme,
			presets: listLayoutPresets(),
			exportedAt: new Date().toISOString()
		}
		context.set('Content-Disposition', `attachment; filename="neuroncast-setup-${Date.now()}.json"`)
	})

	router.post('/config/import', async (context) => {
		const { theme, presets } = context.request.body || {}
		if (!theme && !presets) {
			context.status = 400
			context.body = { error: 'Invalid setup file' }
			return
		}

		if (theme) {
			const currentTheme = await readJson(userspaceSettingsPath).catch(() => null)
			if (currentTheme) {
				await writeJson(BACKUP_THEME_PATH, currentTheme)
			}

			normalizeSettingsOptions(theme)
			await writeJson(userspaceSettingsPath, theme)
		}

		if (Array.isArray(presets)) {
			for (const preset of presets) {
				if (preset?.id) {
					try {
						saveLayoutPreset(preset.id, preset)
					} catch (e) {
						console.warn(`[Config Import] Skipped invalid layout preset ${preset.id}:`, e.message)
					}
				}
			}
		}

		await websocket.updateCaches()
		websocket.broadcastRefresh()
		context.status = 204
	})

	/* ── Visual Event Themes CRUD (Phase 17A) ── */
	router.get('/config/event-themes', (context) => {
		try {
			context.body = listEventThemes()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/event-themes/:id', (context) => {
		try {
			const theme = getEventTheme(context.params.id)
			if (!theme) {
				context.status = 404
				context.body = { error: `Theme with ID "${context.params.id}" not found.` }
				return
			}
			context.body = theme
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.post('/config/event-themes', (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('theme-' + Math.random().toString(36).substring(2, 8))
			context.body = saveCustomTheme(slug, incoming)
			context.status = 201
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.put('/config/event-themes/:id', (context) => {
		try {
			const incoming = context.request.body || {}
			context.body = saveCustomTheme(context.params.id, incoming)
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/event-themes/:id', (context) => {
		try {
			if (!deleteCustomTheme(context.params.id)) {
				context.status = 404
				context.body = { error: `Theme with ID "${context.params.id}" not found or cannot be deleted.` }
				return
			}
			context.status = 204
		} catch (err) {
			context.status = 403
			context.body = { error: 'Forbidden', message: err.message }
		}
	})

	router.post('/config/event-themes/:id/apply', async (context) => {
		try {
			applyThemeToOptions(context.params.id)
			await websocket.updateCaches()
			websocket.broadcastRefresh()
			context.status = 200
			context.body = { success: true, message: `Theme "${context.params.id}" applied successfully.` }
		} catch (err) {
			context.status = 400
			context.body = { error: 'Execution Error', message: err.message }
		}
	})

	/* ── Event Packages CRUD (Phase 20A) ── */
	router.get('/config/event-packages', (context) => {
		try {
			context.body = listPackages()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/event-packages/active', (context) => {
		try {
			context.body = getActivePackageStatus()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.delete('/config/event-packages/active', (context) => {
		try {
			clearPackageState()
			context.status = 204
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/event-packages/:id', (context) => {
		try {
			const pkg = getPackage(context.params.id)
			if (!pkg) {
				context.status = 404
				context.body = { error: `Package with ID "${context.params.id}" not found.` }
				return
			}
			context.body = pkg
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.post('/config/event-packages', (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('pkg-' + Math.random().toString(36).substring(2, 8))
			context.body = savePackage(slug, incoming, { allowOverwrite: false })
			context.status = 201
		} catch (err) {
			if (err.code === 'PACKAGE_EXISTS') {
				context.status = 409
				context.body = { error: 'PACKAGE_EXISTS', id: err.id, message: err.message }
			} else {
				context.status = 400
				context.body = { error: 'Validation Error', message: err.message }
			}
		}
	})

	router.put('/config/event-packages/:id', (context) => {
		try {
			const incoming = context.request.body || {}
			context.body = savePackage(context.params.id, incoming, { allowOverwrite: true })
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/event-packages/:id', (context) => {
		try {
			if (!deletePackage(context.params.id)) {
				context.status = 404
				context.body = { error: `Package with ID "${context.params.id}" not found.` }
				return
			}
			context.status = 204
		} catch (err) {
			context.status = 403
			context.body = { error: 'Forbidden', message: err.message }
		}
	})

	router.post('/config/event-packages/capture-current', (context) => {
		try {
			const incoming = context.request.body || {}
			context.body = captureCurrentAsPackage(incoming)
			context.status = 201
		} catch (err) {
			if (err.code === 'PACKAGE_EXISTS') {
				context.status = 409
				context.body = { error: 'PACKAGE_EXISTS', id: err.id, message: err.message }
			} else {
				context.status = 400
				context.body = { error: 'Validation Error', message: err.message }
			}
		}
	})

	router.post('/config/event-packages/:id/apply', async (context) => {
		try {
			const result = applyPackage(context.params.id)
			await websocket.updateCaches()
			websocket.broadcastRefresh()
			context.status = 200
			context.body = { success: true, warnings: result.warnings }
		} catch (err) {
			if (err.message.includes('not found')) {
				context.status = 404
				context.body = { error: 'Not Found', message: err.message }
			} else {
				context.status = 400
				context.body = { error: 'Execution Error', message: err.message }
			}
		}
	})
}

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

export const registerConfigRoutes = (router, websocket) => {
	router.get('/', (context) => {
		context.status = 302
		context.redirect('/hud')
	})

	router.get('/config/options', async (context) => {
		const { settings } = await getSettings().catch((err) => {
			console.error('Error getting settings', err)
			return { settings: { options: {} } }
		})

		context.body = [
			{
				fallback: 'default',
				key: 'theme',
				section: 'Theme',
				type: 'string',
				value: settings.parent,
			},

			...Object.entries(settings.options).map(([key, data]) => ({
				...data,
				key,
				sectionDescription: settings.optionSectionDescriptions?.[data.section],
			})),
		]
	})



	router.get('/analysis', async (context) => {
		await send(context, 'analysis.html', { root: `${builtinRootDirectory}/src/config` })
	})

	router.put('/config/options', async (context) => {
		const settings = await readJson(userspaceSettingsPath)
		normalizeSettingsOptions(settings)

		if (! settings.options) settings.options = {}

		let wasThemeChanged = false
		const incoming = context.request.body

		// 1. Detect Game Mode change for automatic presets
		const currentMode = settings.options['match.mode']?.value
		const newMode = incoming['match.mode']

		if (newMode && newMode !== currentMode) {
			const presets = MODE_PRESETS[newMode]
			if (presets) {
				for (const [key, val] of Object.entries(presets)) {
					const canonicalKey = LEGACY_TO_CANONICAL[key] || key
					if (! settings.options[canonicalKey]) settings.options[canonicalKey] = {}
					settings.options[canonicalKey].value = val

					// Remove legacy aliases to prevent duplication
					const aliases = CANONICAL_TO_LEGACY[canonicalKey] || []
					for (const alias of aliases) {
						delete settings.options[alias]
					}
				}
			}
		}

		for (const [key, value] of Object.entries(incoming)) {
			if (key === 'theme') {
				wasThemeChanged = settings.parent !== (value || 'default')
				settings.parent = (value || 'default')
			} else {
				const canonicalKey = LEGACY_TO_CANONICAL[key] || key
				if (value != null) { // this SHOULD be a double-equal instead of triple-equal (similar to lodash's isNil)
					if (! settings.options[canonicalKey]) settings.options[canonicalKey] = {}
					settings.options[canonicalKey].value = value
				} else if (settings.options[canonicalKey]) {
					delete settings.options[canonicalKey].value
				}

				// Remove legacy aliases to prevent duplication in userspace theme.json
				const aliases = CANONICAL_TO_LEGACY[canonicalKey] || []
				for (const alias of aliases) {
					delete settings.options[alias]
				}
			}
		}

		await writeJson(userspaceSettingsPath, settings)
		await websocket.updateCaches()

		if (wasThemeChanged) websocket.broadcastRefresh()

		context.status = 204
	})

	// Uploads are served back from the same origin under /hud/, so anything
	// script-bearing (SVG in particular) would be a stored-XSS vector against the
	// HUD/config origin. Restrict to raster formats and cap the decoded size.
	const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
	const MAX_FONT_BYTES = 5 * 1024 * 1024  // 5 MB

	router.post('/config/upload-image', async (context) => {
		const { filename, base64 } = context.request.body
		if (!filename || !base64) {
			context.status = 400
			return
		}
		try {
			const ext = String(filename).split('.').pop().toLowerCase()
			if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
				context.status = 400
				context.body = { error: 'Unsupported file type. Use PNG, JPG, GIF, or WEBP (SVG is rejected for security).' }
				return
			}
			const newName = `upload-${Date.now()}.${ext}`
			const filepath = join(userspaceDirectory, newName)

			const base64Data = base64.split(',')[1] || base64
			const buffer = Buffer.from(base64Data, 'base64')
			if (buffer.length > MAX_IMAGE_BYTES) {
				context.status = 413
				context.body = { error: `Image exceeds the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB limit.` }
				return
			}
			await writeFile(filepath, buffer)

			context.body = { url: `/hud/${newName}` }
		} catch (err) {
			console.error('Upload Error:', err)
			context.status = 500
			context.body = { error: 'Failed to save image' }
		}
	})

	router.post('/config/upload-font', async (context) => {
		const { filename, base64 } = context.request.body
		if (!filename || !base64) {
			context.status = 400
			return
		}

		try {
			const ext = String(filename).split('.').pop().toLowerCase()
			if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext)) {
				context.status = 400
				context.body = { error: 'Unsupported font type' }
				return
			}

			const fontFamily = String(filename)
				.replace(/\.[^.]+$/, '')
				.replace(/[^a-z0-9_-]+/gi, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 48) || 'uploaded-font'
			const newName = `font-${Date.now()}-${fontFamily}.${ext}`
			const fontsDirectory = join(userspaceDirectory, 'fonts')
			const filepath = join(fontsDirectory, newName)

			const base64Data = base64.split(',')[1] || base64
			const buffer = Buffer.from(base64Data, 'base64')
			if (buffer.length > MAX_FONT_BYTES) {
				context.status = 413
				context.body = { error: `Font exceeds the ${Math.round(MAX_FONT_BYTES / (1024 * 1024))} MB limit.` }
				return
			}
			await mkdir(fontsDirectory, { recursive: true })
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
	router.get('/config/layout-presets', async (context) => {
		try {
			context.body = listLayoutPresets()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/layout-presets/:id', async (context) => {
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

	router.post('/config/layout-presets', async (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('layout-' + Math.random().toString(36).substring(2, 8))
			const saved = saveLayoutPreset(slug, incoming)
			context.body = saved
			context.status = 201
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.put('/config/layout-presets/:id', async (context) => {
		try {
			const id = context.params.id
			const incoming = context.request.body || {}
			const saved = saveLayoutPreset(id, incoming)
			context.body = saved
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/layout-presets/:id', async (context) => {
		try {
			const deleted = deleteLayoutPreset(context.params.id)
			if (!deleted) {
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
		const presets = listLayoutPresets()
		
		context.body = {
			theme,
			presets,
			exportedAt: new Date().toISOString()
		}
		context.set('Content-Disposition', `attachment; filename="neuroncast-setup-${Date.now()}.json"`)
	})

	router.post('/config/import', async (context) => {
		const { theme, presets } = context.request.body
		if (!theme && !presets) {
			context.status = 400
			context.body = { error: 'Invalid setup file' }
			return
		}

		if (theme) {
			// 1. Create backup of existing theme.json if it exists
			const currentTheme = await readJson(userspaceSettingsPath).catch(() => null)
			if (currentTheme) {
				const backupPath = `${userspaceDirectory}/theme.backup.pre-canonical.json`
				await writeJson(backupPath, currentTheme)
			}

			// 2. Normalize imported options to canonical
			normalizeSettingsOptions(theme)

			await writeJson(userspaceSettingsPath, theme)
		}

		if (presets) await writeJson(presetsPath, presets)

		websocket.broadcastRefresh()
		context.status = 204
	})

	/* ── Visual Event Themes CRUD (Phase 17A) ── */
	router.get('/config/event-themes', async (context) => {
		try {
			context.body = listEventThemes()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/event-themes/:id', async (context) => {
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

	router.post('/config/event-themes', async (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('theme-' + Math.random().toString(36).substring(2, 8))
			const saved = saveCustomTheme(slug, incoming)
			context.body = saved
			context.status = 201
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.put('/config/event-themes/:id', async (context) => {
		try {
			const id = context.params.id
			const incoming = context.request.body || {}
			const saved = saveCustomTheme(id, incoming)
			context.body = saved
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/event-themes/:id', async (context) => {
		try {
			const deleted = deleteCustomTheme(context.params.id)
			if (!deleted) {
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
	router.get('/config/event-packages', async (context) => {
		try {
			context.body = listPackages()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	/* /active must be registered before /:id so "active" is not consumed as a package ID */
	router.get('/config/event-packages/active', async (context) => {
		try {
			context.body = getActivePackageStatus()
			context.status = 200
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.delete('/config/event-packages/active', async (context) => {
		try {
			clearPackageState()
			context.status = 204
		} catch (err) {
			context.status = 500
			context.body = { error: 'Internal Server Error', message: err.message }
		}
	})

	router.get('/config/event-packages/:id', async (context) => {
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

	router.post('/config/event-packages', async (context) => {
		try {
			const incoming = context.request.body || {}
			const slug = incoming.id || ('pkg-' + Math.random().toString(36).substring(2, 8))
			const saved = savePackage(slug, incoming, { allowOverwrite: false })
			context.body = saved
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

	router.put('/config/event-packages/:id', async (context) => {
		try {
			const id = context.params.id
			const incoming = context.request.body || {}
			const saved = savePackage(id, incoming, { allowOverwrite: true })
			context.body = saved
			context.status = 200
		} catch (err) {
			context.status = 400
			context.body = { error: 'Validation Error', message: err.message }
		}
	})

	router.delete('/config/event-packages/:id', async (context) => {
		try {
			const deleted = deletePackage(context.params.id)
			if (!deleted) {
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

	/* capture-current must be registered before /:id/apply so the static segment
	   is not consumed as an :id parameter by Koa Router */
	router.post('/config/event-packages/capture-current', async (context) => {
		try {
			const incoming = context.request.body || {}
			const result = captureCurrentAsPackage(incoming)
			context.body = result
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

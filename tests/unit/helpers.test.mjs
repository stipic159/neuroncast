import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileExists, fileExistsSync } from '../../src/server/helpers/file-exists.js'
import {
	writeJsonAtomic,
	writeJsonAtomicSync,
	readJsonIfExists
} from '../../src/server/helpers/json-file.js'
import {
	sanitizeThemeSlug,
	validateEventTheme,
	saveCustomTheme,
	getEventTheme,
	deleteCustomTheme,
	listEventThemes
} from '../../src/server/helpers/theme-designer-helper.js'
import {
	sanitizeLayoutSlug,
	validateLayoutPreset,
	saveLayoutPreset,
	getLayoutPreset,
	deleteLayoutPreset,
	listLayoutPresets
} from '../../src/server/helpers/layout-preset-helper.js'
import {
	sanitizePackageSlug,
	validatePackage,
	savePackage,
	getPackage,
	deletePackage,
	listPackages,
	writePackageState,
	readPackageState,
	clearPackageState
} from '../../src/server/helpers/event-package-helper.js'
import { userspaceDirectory } from '../../src/server/helpers/paths.js'

test('Helpers: fileExists and fileExistsSync safety', async () => {
	assert.equal(await fileExists(null), false)
	assert.equal(await fileExists(''), false)
	assert.equal(await fileExists('Z:/this/path/definitely/does/not/exist.txt'), false)
	assert.equal(fileExistsSync(null), false)
	assert.equal(fileExistsSync('Z:/this/path/definitely/does/not/exist.txt'), false)

	// Existing file
	const packageJsonPath = path.resolve('package.json')
	assert.equal(await fileExists(packageJsonPath), true)
	assert.equal(fileExistsSync(packageJsonPath), true)
})

test('Helpers: JSON atomic read and write operations', async () => {
	const tempDir = path.resolve(userspaceDirectory, 'test_helpers_tmp')
	const targetFile = path.join(tempDir, 'atomic_test.json')

	try {
		// Synchronous atomic write
		const testDataSync = { hello: 'world', count: 42 }
		writeJsonAtomicSync(targetFile, testDataSync)
		assert.equal(fs.existsSync(targetFile), true)

		const readSync = await readJsonIfExists(targetFile)
		assert.deepEqual(readSync, testDataSync)

		// Overwrite with async atomic write
		const testDataAsync = { hello: 'updated', count: 99 }
		await writeJsonAtomic(targetFile, testDataAsync)

		const readAsync = await readJsonIfExists(targetFile)
		assert.deepEqual(readAsync, testDataAsync)

		// readJsonIfExists with nonexistent file
		const nonExistent = await readJsonIfExists(path.join(tempDir, 'does_not_exist.json'))
		assert.deepEqual(nonExistent, {})

		// readJsonIfExists with malformed file
		const corruptFile = path.join(tempDir, 'corrupt.json')
		fs.writeFileSync(corruptFile, 'NOT_VALID_JSON{', 'utf8')
		const corruptRead = await readJsonIfExists(corruptFile)
		assert.deepEqual(corruptRead, {})
	} finally {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true })
		} catch (_) {}
	}
})

test('Helpers: theme-designer-helper validation, save, get, and delete', () => {
	// Traversal defense
	assert.throws(() => sanitizeThemeSlug('../evil'), /Path traversal/)
	assert.throws(() => sanitizeThemeSlug('evil/test'), /Path traversal/)
	assert.throws(() => sanitizeThemeSlug('evil\\test'), /Path traversal/)

	// Built-in presets protected from overwrite and delete
	assert.throws(() => saveCustomTheme('dark-broadcast', { name: 'Hack' }), /Permission Denied/)
	assert.throws(() => deleteCustomTheme('dark-broadcast'), /Permission Denied/)

	// Validation
	assert.throws(() => validateEventTheme({}), /Theme name is required/)
	assert.throws(() => validateEventTheme({ name: 'Test', tokens: { 'invalid.prefix': '1' } }), /violates canonical prefix boundaries/)
	assert.throws(() => validateEventTheme({
		name: 'Test',
		tokens: { 'theme.colors.ctFill': 'not,a,color,string' }
	}), /Color format rejected/)

	// Save and retrieve valid custom theme
	const themeId = 'unit-test-custom-theme'
	const customData = {
		name: 'Unit Test Custom Theme',
		description: 'A test custom theme',
		tokens: {
			'theme.colors.ctFill': '25, 106, 232',
			'theme.colors.tFill': '232, 137, 22'
		}
	}

	try {
		const saved = saveCustomTheme(themeId, customData)
		assert.equal(saved.id, themeId)
		assert.equal(saved.name, customData.name)

		const loaded = getEventTheme(themeId)
		assert.ok(loaded)
		assert.equal(loaded.isCustom, true)
		assert.equal(loaded.tokens['theme.colors.ctFill'], '25, 106, 232')

		const list = listEventThemes()
		const found = list.find(t => t.id === themeId)
		assert.ok(found)
	} finally {
		deleteCustomTheme(themeId)
		assert.equal(getEventTheme(themeId), null)
	}
})

test('Helpers: layout-preset-helper validation, save, get, and delete', () => {
	// Traversal defense
	assert.throws(() => sanitizeLayoutSlug('../hack'), /Path traversal/)
	assert.throws(() => sanitizeLayoutSlug('hack/layout'), /Path traversal/)

	// Validation
	assert.throws(() => validateLayoutPreset({}), /Layout name is required/)
	assert.throws(() => validateLayoutPreset({
		name: 'Invalid Layout',
		options: { 'theme.colors.accent': { value: '#fff' } }
	}), /Option key rejected/)

	const layoutId = 'unit-test-layout'
	const layoutData = {
		name: 'Unit Test Layout',
		description: 'Test layout preset',
		options: {
			'layout.radar.x': { value: '100px' },
			'layout.radar.y': { value: '200px' },
			'style.eventBadge.width': { value: '350px' }
		}
	}

	try {
		const saved = saveLayoutPreset(layoutId, layoutData)
		assert.equal(saved.id, layoutId)

		const loaded = getLayoutPreset(layoutId)
		assert.ok(loaded)
		assert.equal(loaded.isCustom, true)
		assert.equal(loaded.options['layout.radar.x'].value, '100px')

		const list = listLayoutPresets()
		const found = list.find(l => l.id === layoutId)
		assert.ok(found)
	} finally {
		deleteLayoutPreset(layoutId)
		assert.equal(getLayoutPreset(layoutId), null)
	}
})

test('Helpers: event-package-helper validation, state management and cleanup', () => {
	// Traversal defense
	assert.throws(() => sanitizePackageSlug('../../etc/passwd'), /Path traversal/)

	// Validation
	assert.throws(() => validatePackage({}), /Package name is required/)
	assert.throws(() => validatePackage({
		name: 'Bad Package',
		branding: { logoUrl: 'https://evil.com/logo.png' }
	}), /Logo URL must be a local \/hud\/ path/)

	const pkgId = 'unit-test-pkg'
	const pkgData = {
		name: 'Unit Test Package',
		description: 'A test event package',
		branding: {
			title: 'Test Cup',
			subtitle: 'Grand Finals',
			logoUrl: '/hud/img/branding/logo-ubg.png'
		},
		sponsors: {
			rotationInterval: 15,
			title: 'Official Partners'
		},
		options: {
			'series.name.center': { value: 'Test Cup' },
			'sponsors.rotationInterval': { value: 15 }
		}
	}

	try {
		const saved = savePackage(pkgId, pkgData, { allowOverwrite: true })
		assert.equal(saved.id, pkgId)

		const loaded = getPackage(pkgId)
		assert.ok(loaded)
		assert.equal(loaded.name, 'Unit Test Package')

		// Set as active package
		writePackageState({
			schemaVersion: '1.0.0',
			activePackageId: pkgId,
			activePackageName: 'Unit Test Package'
		})

		const stateBefore = readPackageState()
		assert.equal(stateBefore.activePackageId, pkgId)

		// Deleting package cleans up active package state automatically
		deletePackage(pkgId)
		assert.equal(getPackage(pkgId), null)

		const stateAfter = readPackageState()
		assert.equal(stateAfter, null)
	} finally {
		try {
			deletePackage(pkgId)
			clearPackageState()
		} catch (_) {}
	}
})

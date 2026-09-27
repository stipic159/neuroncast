import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {
	ensureAssetDirectories,
	getFallbackPlaceholderUrl,
	cacheRemoteAsset,
	batchCacheAssets,
} from '../../src/server/cache/asset-cache-manager.js'
import { builtinRootDirectory } from '../../src/server/helpers/paths.js'

test('Asset Cache Manager: Directory & Placeholder Initialization', async () => {
	await ensureAssetDirectories()

	const avatarPlaceholder = path.join(builtinRootDirectory, 'public', 'assets', 'placeholders', 'default_avatar.svg')
	const teamPlaceholder = path.join(builtinRootDirectory, 'public', 'assets', 'placeholders', 'default_team.svg')

	assert.equal(fsSync.existsSync(avatarPlaceholder), true, 'default_avatar.svg must exist')
	assert.equal(fsSync.existsSync(teamPlaceholder), true, 'default_team.svg must exist')
	assert.equal(getFallbackPlaceholderUrl('avatars'), '/assets/placeholders/default_avatar.svg')
	assert.equal(getFallbackPlaceholderUrl('teams'), '/assets/placeholders/default_team.svg')
})

test('Asset Cache Manager: Local and invalid URL handling', async () => {
	const local = await cacheRemoteAsset('/assets/custom/logo.png', 'teams')
	assert.equal(local, '/assets/custom/logo.png')

	const invalid = await cacheRemoteAsset('not-a-valid-url', 'avatars')
	assert.equal(invalid, '/assets/placeholders/default_avatar.svg')

	const empty = await cacheRemoteAsset('', 'teams')
	assert.equal(empty, '/assets/placeholders/default_team.svg')
})

test('Asset Cache Manager: Live download, caching & batch support', async (t) => {
	// Spin up a mini local HTTP server that serves a test PNG
	const testPngBuffer = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	)

	const server = http.createServer((req, res) => {
		if (req.url === '/test-avatar.png') {
			res.writeHead(200, { 'Content-Type': 'image/png' })
			res.end(testPngBuffer)
		} else if (req.url === '/error-404.png') {
			res.writeHead(404)
			res.end('Not Found')
		} else {
			res.writeHead(500)
			res.end('Server Error')
		}
	})

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	const port = server.address().port

	t.after(() => {
		server.close()
	})

	const avatarUrl = `http://127.0.0.1:${port}/test-avatar.png`
	const cachedPath = await cacheRemoteAsset(avatarUrl, 'avatars', 'player_76561198000000001')

	assert.match(cachedPath, /^\/assets\/cache\/avatars\/player_76561198000000001_[a-f0-9]+\.png$/)

	// Verify file actually exists on disk
	const diskPath = path.join(builtinRootDirectory, 'public', cachedPath.replace(/^\//, ''))
	assert.equal(fsSync.existsSync(diskPath), true, 'Cached image file must exist on disk')

	// Cache Hit test (subsequent call should return same path immediately)
	const cachedAgain = await cacheRemoteAsset(avatarUrl, 'avatars', 'player_76561198000000001')
	assert.equal(cachedAgain, cachedPath, 'Subsequent call should return identical cached path')

	// 404 test falls back to placeholder
	const failedUrl = `http://127.0.0.1:${port}/error-404.png`
	const fallbackPath = await cacheRemoteAsset(failedUrl, 'avatars', 'broken_player')
	assert.equal(fallbackPath, '/assets/placeholders/default_avatar.svg')

	// Batch test
	const batch = await batchCacheAssets([
		{ url: avatarUrl, subfolder: 'avatars', key: 'batch1' },
		{ url: failedUrl, subfolder: 'teams', key: 'broken_team' },
	])
	assert.equal(batch.get(avatarUrl), cachedPath)
	assert.equal(batch.get(failedUrl), '/assets/placeholders/default_team.svg')
})

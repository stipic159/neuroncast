import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { builtinRootDirectory } from '../helpers/paths.js'

const PUBLIC_ASSETS_DIR = path.join(builtinRootDirectory, 'public', 'assets')
const CACHE_ROOT_DIR = path.join(PUBLIC_ASSETS_DIR, 'cache')
const PLACEHOLDERS_DIR = path.join(PUBLIC_ASSETS_DIR, 'placeholders')

const MIME_TO_EXT = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/webp': '.webp',
	'image/svg+xml': '.svg',
	'image/gif': '.gif',
	'image/avif': '.avif',
}

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" fill="#121824"/>
  <circle cx="64" cy="46" r="22" fill="#2A374A"/>
  <path d="M28 108 C28 84, 44 76, 64 76 C84 76, 100 84, 100 108 Z" fill="#2A374A"/>
</svg>`

const DEFAULT_TEAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" fill="#121824"/>
  <polygon points="64,24 100,52 86,96 42,96 28,52" fill="none" stroke="#38BDF8" stroke-width="6"/>
  <circle cx="64" cy="62" r="12" fill="#38BDF8"/>
</svg>`

/**
 * Ensures required asset and placeholder directories exist on disk.
 */
export async function ensureAssetDirectories() {
	await fs.mkdir(path.join(CACHE_ROOT_DIR, 'avatars'), { recursive: true })
	await fs.mkdir(path.join(CACHE_ROOT_DIR, 'teams'), { recursive: true })
	await fs.mkdir(path.join(CACHE_ROOT_DIR, 'misc'), { recursive: true })
	await fs.mkdir(PLACEHOLDERS_DIR, { recursive: true })

	const avatarPlaceholderPath = path.join(PLACEHOLDERS_DIR, 'default_avatar.svg')
	const teamPlaceholderPath = path.join(PLACEHOLDERS_DIR, 'default_team.svg')

	if (!fsSync.existsSync(avatarPlaceholderPath)) {
		await fs.writeFile(avatarPlaceholderPath, DEFAULT_AVATAR_SVG, 'utf8')
	}
	if (!fsSync.existsSync(teamPlaceholderPath)) {
		await fs.writeFile(teamPlaceholderPath, DEFAULT_TEAM_SVG, 'utf8')
	}
}

/**
 * Returns fallback placeholder URL based on subfolder category.
 */
export function getFallbackPlaceholderUrl(subfolder = 'avatars') {
	if (subfolder === 'teams') {
		return '/assets/placeholders/default_team.svg'
	}
	return '/assets/placeholders/default_avatar.svg'
}

/**
 * Determines file extension from Content-Type or original URL.
 */
function resolveFileExtension(contentType, originalUrl) {
	if (contentType) {
		const cleanType = contentType.split(';')[0].trim().toLowerCase()
		if (MIME_TO_EXT[cleanType]) return MIME_TO_EXT[cleanType]
	}

	try {
		const pathname = new URL(originalUrl).pathname
		const ext = path.extname(pathname).toLowerCase()
		if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif'].includes(ext)) {
			return ext === '.jpeg' ? '.jpg' : ext
		}
	} catch (_) {}

	return '.png'
}

/**
 * Generates a deterministic safe filename based on key or URL hash.
 */
function generateFilename(subfolder, filenameKey, rawUrl, ext) {
	const sanitizedKey = filenameKey
		? String(filenameKey).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
		: ''
	const hash = crypto.createHash('sha1').update(rawUrl).digest('hex').slice(0, 10)
	return sanitizedKey ? `${sanitizedKey}_${hash}${ext}` : `${hash}${ext}`
}

/**
 * Downloads a remote image and stores it in the local cache.
 * Returns the web-accessible URL (/assets/cache/...) or fallback on failure.
 *
 * @param {string} url - Remote image URL.
 * @param {'avatars'|'teams'|'misc'} subfolder - Storage category.
 * @param {string} [filenameKey] - Identifier prefix (e.g. SteamID64 or TeamTag).
 * @param {number} [timeoutMs=5000] - Request timeout.
 * @returns {Promise<string>} Local web URL.
 */
export async function cacheRemoteAsset(url, subfolder = 'avatars', filenameKey = '', timeoutMs = 5000) {
	await ensureAssetDirectories()

	if (!url || typeof url !== 'string') {
		return getFallbackPlaceholderUrl(subfolder)
	}

	const trimmedUrl = url.trim()

	// If already a local asset, return as-is
	if (trimmedUrl.startsWith('/assets/')) {
		return trimmedUrl
	}

	// Must be an HTTP(S) URL
	if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
		return getFallbackPlaceholderUrl(subfolder)
	}

	const targetDir = path.join(CACHE_ROOT_DIR, subfolder)
	const fallbackUrl = getFallbackPlaceholderUrl(subfolder)

	// Check if already cached with any valid image extension
	const baseHash = crypto.createHash('sha1').update(trimmedUrl).digest('hex').slice(0, 10)
	try {
		const existingFiles = await fs.readdir(targetDir)
		const existingMatch = existingFiles.find(f => f.includes(`_${baseHash}.`) || f.startsWith(`${baseHash}.`))
		if (existingMatch) {
			return `/assets/cache/${subfolder}/${existingMatch}`
		}
	} catch (_) {}

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const response = await fetch(trimmedUrl, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'NeuronCast-AssetCache/3.1.0',
				'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
			},
		})
		clearTimeout(timeoutId)

		if (!response.ok) {
			console.warn(`[Asset Cache] HTTP ${response.status} fetching ${trimmedUrl}`)
			return fallbackUrl
		}

		const contentType = response.headers.get('content-type') || ''
		const ext = resolveFileExtension(contentType, trimmedUrl)
		const filename = generateFilename(subfolder, filenameKey, trimmedUrl, ext)
		const filePath = path.join(targetDir, filename)
		const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`

		const arrayBuffer = await response.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)

		// Sanity check: minimum 64 bytes, maximum 15MB
		if (buffer.length < 64 || buffer.length > 15 * 1024 * 1024) {
			console.warn(`[Asset Cache] Image size out of bounds (${buffer.length} bytes) for ${trimmedUrl}`)
			return fallbackUrl
		}

		await fs.writeFile(tempFilePath, buffer)

		try {
			await fs.rename(tempFilePath, filePath)
		} catch (renameErr) {
			try { await fs.unlink(filePath) } catch (_) {}
			await fs.rename(tempFilePath, filePath)
		}

		return `/assets/cache/${subfolder}/${filename}`
	} catch (err) {
		clearTimeout(timeoutId)
		console.warn(`[Asset Cache] Failed to cache image "${trimmedUrl}": ${err.message}`)
		return fallbackUrl
	}
}

/**
 * Batch downloads multiple assets with concurrency control.
 *
 * @param {Array<{ url: string, subfolder: string, key?: string }>} items
 * @param {number} [concurrency=4]
 * @returns {Promise<Map<string, string>>} Mapping from original URL to local cached URL
 */
export async function batchCacheAssets(items = [], concurrency = 4) {
	await ensureAssetDirectories()
	const results = new Map()
	const queue = [...items]

	const worker = async () => {
		while (queue.length > 0) {
			const item = queue.shift()
			if (!item || !item.url) continue
			if (results.has(item.url)) continue

			const cachedUrl = await cacheRemoteAsset(item.url, item.subfolder, item.key)
			results.set(item.url, cachedUrl)
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker())
	await Promise.all(workers)

	return results
}

/**
 * Prunes cached assets older than maxAgeMs (default: 14 days).
 */
export async function pruneOldAssets(maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
	const now = Date.now()
	const subfolders = ['avatars', 'teams', 'misc']

	for (const subfolder of subfolders) {
		const dir = path.join(CACHE_ROOT_DIR, subfolder)
		try {
			const files = await fs.readdir(dir)
			for (const file of files) {
				const filePath = path.join(dir, file)
				const stat = await fs.stat(filePath)
				if (now - stat.mtimeMs > maxAgeMs) {
					await fs.unlink(filePath).catch(() => {})
				}
			}
		} catch (_) {}
	}
}

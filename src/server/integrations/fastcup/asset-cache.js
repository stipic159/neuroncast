import { createHash } from 'crypto'
import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { userspaceDirectory } from '../../helpers/paths.js'

export const ASSET_DIR = join(userspaceDirectory, 'cache', 'fastcup_assets')

/**
 * Ensures that the fastcup_assets cache directory exists.
 */
export const ensureAssetDir = async () => {
	try {
		await mkdir(ASSET_DIR, { recursive: true })
	} catch (err) {
		// Ignore if already exists
	}
}

/**
 * Generates an MD5 filename hash for a given URL and optional key.
 */
export const hashAssetName = (url, prefix = '') => {
	const hash = createHash('md5').update(`${prefix}_${url}`).digest('hex')
	let ext = '.png'
	if (url.endsWith('.jpg') || url.endsWith('.jpeg')) ext = '.jpg'
	if (url.endsWith('.webp')) ext = '.webp'
	if (url.endsWith('.svg')) ext = '.svg'
	return `${hash}${ext}`
}

/**
 * Gets the absolute path to a cached asset file.
 */
export const getAssetFilePath = (filename) => {
	return join(ASSET_DIR, filename)
}

/**
 * Downloads an external image asset and caches it locally.
 * Returns the local API route URL (/api/fastcup/assets/:filename) or null.
 * 
 * @param {string} url 
 * @param {string} prefixKey 
 * @param {number} timeoutMs 
 * @returns {Promise<string|null>}
 */
export const downloadAsset = async (url, prefixKey = 'asset', timeoutMs = 4000) => {
	if (!url || typeof url !== 'string') return null
	if (url.startsWith('/api/fastcup/assets/')) return url
	if (url.startsWith('data:image')) return url

	await ensureAssetDir()
	const filename = hashAssetName(url, prefixKey)
	const filePath = getAssetFilePath(filename)
	const publicUrl = `/api/fastcup/assets/${filename}`

	// Check if already cached locally
	try {
		await readFile(filePath)
		return publicUrl
	} catch (err) {
		// File does not exist yet, download it below
	}

	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			}
		})
		clearTimeout(timer)

		if (!response.ok) {
			return null
		}

		const buffer = Buffer.from(await response.arrayBuffer())
		if (buffer.length > 0) {
			await writeFile(filePath, buffer)
			return publicUrl
		}
	} catch (err) {
		clearTimeout(timer)
		// Network timeout or download error - return null without crashing
	}

	return null
}

/**
 * Clears all cached asset files from the fastcup_assets directory.
 */
export const clearAssetCache = async () => {
	await ensureAssetDir()
	try {
		const files = await readdir(ASSET_DIR)
		for (const file of files) {
			await unlink(join(ASSET_DIR, file)).catch(() => {})
		}
	} catch (err) {
		// Directory might be empty or missing
	}
}

/**
 * Returns a fallback SVG avatar/logo buffer if a requested asset is missing on disk.
 */
export const getDefaultAssetPlaceholder = (type = 'avatar') => {
	if (type === 'logo') {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
			<rect width="128" height="128" rx="16" fill="#1b222d"/>
			<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#58a6ff" font-family="sans-serif" font-weight="bold" font-size="36">FC</text>
		</svg>`
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
		<rect width="128" height="128" rx="64" fill="#21262d"/>
		<circle cx="64" cy="48" r="24" fill="#8b949e"/>
		<path d="M 24 108 C 24 84, 104 84, 104 108 Z" fill="#8b949e"/>
	</svg>`
}

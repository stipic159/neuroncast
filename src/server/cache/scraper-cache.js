import fs from 'fs/promises';
import path from 'path';
import { userspaceDirectory } from '../helpers/paths.js';

const cacheDir = path.join(userspaceDirectory, 'cache');

/**
 * Ensures cache directory exists.
 */
async function ensureCacheDir() {
	try {
		await fs.mkdir(cacheDir, { recursive: true });
	} catch (err) {
		console.warn(`[Cache Warning] Failed to create cache directory: ${err.message}`);
	}
}

/**
 * Resolves absolute cache file path.
 */
function getCacheFilePath(cacheName) {
	return path.join(cacheDir, `${cacheName}.json`);
}

/**
 * Safely reads a raw cache file, returning parsed contents or null if missing/corrupt.
 */
export async function readCache(cacheName) {
	const filePath = getCacheFilePath(cacheName);
	try {
		const data = await fs.readFile(filePath, 'utf8');
		return JSON.parse(data);
	} catch (err) {
		// Log warning only, never fail the live request
		if (err.code !== 'ENOENT') {
			console.warn(`[Cache Warning] Failed to read cache "${cacheName}": ${err.message}`);
		}
		return null;
	}
}

/**
 * Safely writes a payload to a cache file using an atomic write pattern (temp file + rename).
 * Log warnings only, never blocks live request.
 */
export async function writeCache(cacheName, payload, source = 'api') {
	const filePath = getCacheFilePath(cacheName);
	const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
	try {
		await ensureCacheDir();
		const envelope = {
			savedAt: new Date().toISOString(),
			source,
			schemaVersion: '1.0.0',
			payload
		};
		// Write to the temporary file first
		await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), 'utf8');

		try {
			// Attempt to atomically rename/move the temp file to the final destination
			await fs.rename(tempPath, filePath);
		} catch (_renameErr) {
			// Windows EPERM: destination file has open handles; use delete-and-rename fallback.
			try {
				await fs.unlink(filePath);
			} catch (unlinkErr) {
				if (unlinkErr.code !== 'ENOENT') {
					throw unlinkErr;
				}
			}
			await fs.rename(tempPath, filePath);
			// Fallback succeeded — no warning needed.
		}
		return true;
	} catch (err) {
		console.warn(`[Cache Warning] Failed to write cache "${cacheName}": ${err.message}`);
		// Attempt to clean up the temp file if it exists
		try {
			await fs.unlink(tempPath);
		} catch (cleanupErr) {
			// Ignore cleanup errors
		}
		return false;
	}
}

/**
 * Safely deletes a cache file.
 */
export async function invalidateCache(cacheName) {
	const filePath = getCacheFilePath(cacheName);
	try {
		await fs.unlink(filePath);
		return true;
	} catch (err) {
		if (err.code !== 'ENOENT') {
			console.warn(`[Cache Warning] Failed to invalidate cache "${cacheName}": ${err.message}`);
		}
		return false;
	}
}

/**
 * Safely reads a single item from a map-based cache file (like matches.json or standings.json).
 */
export async function readCacheItem(cacheName, key) {
	try {
		const cacheMap = await readCache(cacheName);
		if (cacheMap && cacheMap.payload && typeof cacheMap.payload === 'object') {
			return cacheMap.payload[key] || null;
		}
		return null;
	} catch (err) {
		console.warn(`[Cache Warning] Failed to read item "${key}" from cache "${cacheName}": ${err.message}`);
		return null;
	}
}

/**
 * Safely writes a single item into a map-based cache file (like matches.json or standings.json).
 */
export async function writeCacheItem(cacheName, key, itemPayload, source = 'api') {
	try {
		let cacheMapEnvelope = await readCache(cacheName);
		let map = {};
		if (cacheMapEnvelope && cacheMapEnvelope.payload && typeof cacheMapEnvelope.payload === 'object') {
			map = cacheMapEnvelope.payload;
		}

		map[key] = {
			savedAt: new Date().toISOString(),
			source,
			schemaVersion: '1.0.0',
			payload: itemPayload
		};

		await writeCache(cacheName, map, source);
		return true;
	} catch (err) {
		console.warn(`[Cache Warning] Failed to write item "${key}" into cache "${cacheName}": ${err.message}`);
		return false;
	}
}

/**
 * Returns cache file metadata (exists, savedAt, age, source, size).
 */
export async function getCacheMetadata(cacheName) {
	const filePath = getCacheFilePath(cacheName);
	try {
		const stat = await fs.stat(filePath);
		const cacheData = await readCache(cacheName);
		
		if (!cacheData) {
			return { exists: false };
		}

		const ageMs = Date.now() - new Date(cacheData.savedAt).getTime();

		return {
			exists: true,
			savedAt: cacheData.savedAt,
			ageMinutes: Math.floor(ageMs / 60000),
			source: cacheData.source,
			sizeBytes: stat.size,
			stale: ageMs > 5 * 60 * 1000 // Stale if older than 5 minutes
		};
	} catch (err) {
		return { exists: false };
	}
}

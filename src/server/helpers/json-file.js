import { readFile, writeFile, rename, unlink, mkdir, copyFile } from 'node:fs/promises'
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const readJson = async (path) => {
	const str = await readFile(path, 'utf-8')
	return JSON.parse(str)
}

export const readJsonIfExists = async (path) => {
	try {
		return await readJson(path)
	} catch (err) {
		if (err.code === 'ENOENT' || err.name === 'SyntaxError') return {}
		throw err
	}
}

export const writeJson = (path, obj) => writeFile(path, JSON.stringify(obj, null, '\t'))

/**
 * Asynchronously writes JSON data to a temporary file and atomically renames it over the target.
 * Includes Windows EPERM/EBUSY/EEXIST fallback and temporary file cleanup.
 */
export const writeJsonAtomic = async (filePath, data) => {
	const dir = dirname(filePath)
	await mkdir(dir, { recursive: true })
	const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
	const payload = typeof data === 'string' ? data : JSON.stringify(data, null, '\t')
	try {
		await writeFile(tempPath, payload, 'utf8')
		try {
			await rename(tempPath, filePath)
		} catch (renameErr) {
			// On Windows, rename can fail with EPERM, EBUSY, or EEXIST if the target file is locked or exists
			if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY' || renameErr.code === 'EEXIST') {
				await copyFile(tempPath, filePath)
				try { await unlink(tempPath) } catch (_) {}
			} else {
				throw renameErr
			}
		}
	} catch (err) {
		try { await unlink(tempPath) } catch (_) {}
		throw err
	}
}

/**
 * Synchronously writes JSON data to a temporary file and atomically renames it over the target.
 * Prevents unhandled Promise rejections and race conditions in synchronous callers.
 */
export const writeJsonAtomicSync = (filePath, data) => {
	const dir = dirname(filePath)
	mkdirSync(dir, { recursive: true })
	const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
	const payload = typeof data === 'string' ? data : JSON.stringify(data, null, '\t')
	try {
		writeFileSync(tempPath, payload, 'utf8')
		try {
			renameSync(tempPath, filePath)
		} catch (renameErr) {
			if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY' || renameErr.code === 'EEXIST') {
				copyFileSync(tempPath, filePath)
				try { unlinkSync(tempPath) } catch (_) {}
			} else {
				throw renameErr
			}
		}
	} catch (err) {
		try { unlinkSync(tempPath) } catch (_) {}
		throw err
	}
}

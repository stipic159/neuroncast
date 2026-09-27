import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const readJson = async (path) => {
	const str = await readFile(path, 'utf-8')
	return JSON.parse(str)
}

export const readJsonIfExists = async (path) => {
	try {
		return await readJson(path)
	} catch (err) {
		if (err.code === 'ENOENT') return {}
		throw err
	}
}

export const writeJson = (path, obj) => writeFile(path, JSON.stringify(obj, null, '\t'))

export const writeJsonAtomic = async (filePath, data) => {
	const dir = dirname(filePath)
	await mkdir(dir, { recursive: true })
	const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
	const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
	try {
		await writeFile(tempPath, payload, 'utf8')
		await rename(tempPath, filePath)
	} catch (err) {
		try {
			await unlink(tempPath)
		} catch (_) {}
		throw err
	}
}

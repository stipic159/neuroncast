import { stat } from 'fs/promises'
import { statSync } from 'fs'

/**
 * Checks asynchronously if a file exists.
 * Returns false safely if the file or any parent directory does not exist or path is invalid.
 */
export const fileExists = async (filePath) => {
	if (!filePath || typeof filePath !== 'string') return false
	try {
		await stat(filePath)
		return true
	} catch (err) {
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EINVAL') return false
		return false
	}
}

/**
 * Checks synchronously if a file exists.
 */
export const fileExistsSync = (filePath) => {
	if (!filePath || typeof filePath !== 'string') return false
	try {
		statSync(filePath)
		return true
	} catch (err) {
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EINVAL') return false
		return false
	}
}

import { basename, extname, parse } from 'path'
import { readFile } from 'fs/promises'

import resolvePath from 'resolve-path'

import { builtinThemesDirectory, customThemesDirectory } from './helpers/paths.js'
import { fileExists } from './helpers/file-exists.js'
import { getThemeTree } from './settings.js'

const textFormats = [
	'.css',
	'.htm',
	'.html',
	'.js',
	'.json',
	'.jsx',
	'.svg',
	'.ts',
	'.vue',
	'.xml',
]

export const registerHudRoutes = (router) => {
	// HUD routing moved to fallback middleware in index.js for better reliability
}

// Assembling a HUD asset walks the theme tree and reads several files from disk
// per request. Theme/userspace files are effectively static during a broadcast,
// so we cache the assembled result and invalidate it whenever the operator
// changes config/themes (which always triggers a refresh broadcast). This turns
// a multi-read-per-request hot path into a single map lookup for repeat loads
// and reconnects.
const themeAssetCache = new Map()

export const clearThemeAssetCache = () => {
	themeAssetCache.clear()
}

export const concatStaticFileFromThemeTreeRecursively = async (path, concatTree, themeTree) => {
	// Only the entry call (empty accumulator) is cacheable; recursive calls carry
	// partial state and must run uncached.
	if (concatTree.length) {
		return buildConcatFromThemeTree(path, concatTree, themeTree)
	}

	const cacheKey = `${themeTree.join('>')}::${path}`
	if (themeAssetCache.has(cacheKey)) {
		return themeAssetCache.get(cacheKey)
	}

	const result = await buildConcatFromThemeTree(path, concatTree, themeTree)
	themeAssetCache.set(cacheKey, result)
	return result
}

const buildConcatFromThemeTree = async (path, concatTree, themeTree) => {
	if (! themeTree.length) {
		if (concatTree.length) return concatTree

		const { dir, ext, name } = parse(path)
		if (ext !== '.vue' || ! `/${path}`.endsWith(`/${name}/${name}.vue`)) return

		return [`
			<!-- generated dynamically -->
			<script src="/hud/${dir}/${name}.js"></script>
			<style src="/hud/${dir}/${name}.css" scoped></style>
			<template src="/hud/${dir}/${name}.html"></template>
		`]
	}

	themeTree = themeTree.slice()
	const theme = themeTree.shift()

	const sanitizedBuiltinPath = sanitizePath(`${builtinThemesDirectory}/${theme}`, path)
	if (! sanitizedBuiltinPath) return

	const parsedBuiltinPath = parse(sanitizedBuiltinPath)
	const builtinAppendPath = `${parsedBuiltinPath.dir}/${parsedBuiltinPath.name}.append${parsedBuiltinPath.ext}`

	const sanitizedCustomPath = sanitizePath(`${customThemesDirectory}/${theme}`, path)
	if (! sanitizedCustomPath) return

	const parsedCustomPath = parse(sanitizedCustomPath)
	const customAppendPath = `${parsedCustomPath.dir}/${parsedCustomPath.name}.append${parsedCustomPath.ext}`

	const encoding = textFormats.includes(parsedBuiltinPath.ext) ? 'utf-8' : null

	if (await fileExists(customAppendPath)) {
		concatTree.unshift(await readFile(customAppendPath, encoding))

		const comment = concatComment(parsedCustomPath, theme, true)
		if (comment) concatTree.unshift(comment)
	}

	if (await fileExists(builtinAppendPath)) {
		concatTree.unshift(await readFile(builtinAppendPath, encoding))

		const comment = concatComment(parsedBuiltinPath, theme, true)
		if (comment) concatTree.unshift(comment)
	}

	if (await fileExists(sanitizedCustomPath)) {
		concatTree.unshift(await readFile(sanitizedCustomPath, encoding))

		const comment = concatComment(parsedCustomPath, theme, false)
		if (comment) concatTree.unshift(comment)

		return concatTree
	}

	if (await fileExists(sanitizedBuiltinPath)) {
		concatTree.unshift(await readFile(sanitizedBuiltinPath, encoding))

		const comment = concatComment(parsedBuiltinPath, theme, false)
		if (comment) concatTree.unshift(comment)

		return concatTree
	}

	return buildConcatFromThemeTree(path, concatTree, themeTree)
}

const sanitizePath = (root, path) => {
	try {
		return resolvePath(root, path)
	} catch {
		return null
	}
}

const concatComment = (parsedPath, theme, append) => {
	const commentBody = `from theme: ${theme}${append ? ' (append)' : ''}`

	switch (parsedPath.ext) {
		case '.css':
		case '.js':
			return `/* ${commentBody} */`

		case '.htm':
		case '.html':
			return `<!-- ${commentBody} -->`
	}
}

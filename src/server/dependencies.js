import send from 'koa-send'
import { builtinRootDirectory } from './helpers/paths.js'

export const registerDependencyRoutes = (router) => {
	router.get('/dependencies/vue.js', sendStaticFile('node_modules/vue/dist/vue.esm-browser.js'))
	router.get('/dependencies/vue3-sfc-loader.js', sendStaticFile('node_modules/vue3-sfc-loader/dist/vue3-sfc-loader.esm.js'))
	router.get('/dependencies/vue3-sfc-loader.esm.js.map', sendStaticFile('node_modules/vue3-sfc-loader/dist/vue3-sfc-loader.esm.js.map'))

	router.get('/dependencies/normalize.css', sendStaticFile('node_modules/normalize.css/normalize.css'))

	serveFontsourceFont(router, 'noto-sans')
	serveFontsourceFont(router, 'quantico')
	serveFontsourceFont(router, 'space-grotesk')
	serveFontsourceFont(router, 'jetbrains-mono')

	router.get('/dependencies/vue3-sfc-loader-options.js', sendStaticFile('src/assets/vue3-sfc-loader-options.js'))
}

// NB! Do _not_ use this with user-supplied values for localFile!
const sendStaticFile = (localFile) => async (context) => {
	try {
		await send(context, localFile, { root: builtinRootDirectory })
	} catch (err) {
		if (err.status === 404 || err.statusCode === 404 || err.code === 'ENOENT') {
			context.status = 404
			return
		}
		context.status = 500
		context.body = { error: 'Failed to serve dependency' }
	}
}

const serveFontsourceFont = (router, fontName) => {
	const prefix = `/dependencies/${fontName}`
	const fontRoot = `${builtinRootDirectory}/node_modules/@fontsource/${fontName}`

	router.get(new RegExp(`^${prefix}(?:\\/(?<path>.*))?$`), async (context) => {
		const rawRelativePath = context.path.substring(prefix.length).replace(/^\/+/, '') || 'index.css'
		try {
			await send(context, rawRelativePath, { root: fontRoot })
		} catch (err) {
			if (err.status === 404 || err.statusCode === 404 || err.code === 'ENOENT') {
				context.status = 404
				return
			}
			context.status = 500
			context.body = { error: 'Failed to serve font asset' }
		}
	})
}

import send from 'koa-send'
import { builtinRootDirectory } from './helpers/paths.js'

export const registerVersionRoutes = (router) => {
	router.get('/version', async (context) => {
		try {
			await send(context, 'version.txt', { root: `${builtinRootDirectory}/src` })
		} catch (err) {
			if (err.status === 404 || err.statusCode === 404 || err.code === 'ENOENT') {
				context.status = 404
				context.type = 'text/plain'
				context.body = 'version not found'
				return
			}
			context.status = 500
			context.body = { error: 'Failed to retrieve version' }
		}
	})
}

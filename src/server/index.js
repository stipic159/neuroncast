import http from 'http'
import os from 'os'
import { parse } from 'url'
import { join, basename, extname } from 'path'

import bodyParser from 'koa-bodyparser'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import KoaCompress from 'koa-compress'

import { initSettings, getSettings, getThemeTree } from './settings.js'
import { registerConfigRoutes } from './config.js'
import { registerDependencyRoutes } from './dependencies.js'
import { registerGsiRoutes } from './gsi.js'
import { registerDiagnosticsRoutes } from './diagnostics.js'
import { registerHudRoutes, concatStaticFileFromThemeTreeRecursively } from './hud.js'
import { registerKomplettligaenRoutes } from './komplettligaen.js'
import { registerLicensesRoutes } from './licenses.js'
import { registerRadarRoutes } from './radar.js'
import { registerVersionRoutes } from './version.js'
import { registerSessionRoutes } from './sessions/session-routes.js'
import { registerObsRoutes } from './obs-routes.js'
import { obsManager } from './integrations/obs-manager.js'
import { Websocket } from './websocket.js'
import send from 'koa-send'
import { builtinRootDirectory } from './helpers/paths.js'
import { isUiDevMode } from './dev-mode.js'
import { isAuthorizedControl, getControlToken } from './auth.js'

Error.stackTraceLimit = 64

const run = async () => {
	await initSettings()
	const { settings } = await getSettings()

	// Default to loopback only. Exposing the control surface on a shared/venue
	// network is opt-in via HOST=0.0.0.0 (or settings.host) and should be paired
	// with the control token below.
	const host = process.env.HOST || settings.host || '127.0.0.1'
	const port = process.env.PORT || settings.port || 31982

	const app = new Koa()
	const server = http.createServer(app.callback())

	// Suppress expected client premature close & abort errors (e.g. video Range requests from OBS / browser)
	app.on('error', (err) => {
		if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECANCELED', 'ERR_STREAM_PREMATURE_CLOSE'].includes(err.code)) {
			return
		}
		console.error('[Server Error]', err.message || err)
	})

	app.use(KoaCompress())

	app.use(bodyParser({
		strict: true,
		enableTypes: ['json'],
		jsonLimit: '12mb',
	}))

	const websocket = new Websocket(server)
	await websocket.init()
	await obsManager.init().catch((err) => console.warn('[OBS] Init warning:', err.message))

	// 1. Mandatory Trailing Slash Redirects
	app.use(async (context, next) => {
		const path = context.path
		if ((path === '/config' || path === '/hud' || path === '/radar' || path === '/remote') && !path.endsWith('/')) {
			context.status = 301
			context.redirect(`${path}/`)
			return
		}
		// animation-asset telemetry: every card-performance / waiting-idle fetch is
		// one playback (per-show cache-busters guarantee a server hit), so the
		// server log doubles as a "what actually played on stream" record
		if (path.includes('/performances/') || path.includes('/waiting-idle/renders/')) {
			console.log(`[anim] ${new Date().toISOString()} ${path.split('/').pop()} (${context.querystring})`)
		}
		await next()
	})

	// 1b. Control-plane gate.
	// Mutating requests (anything that isn't a safe read) must come from loopback
	// or carry a valid control token. GSI ingestion is exempt — it has its own
	// token auth and CS2 posts from loopback.
	app.use(async (context, next) => {
		const method = context.method
		const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
		const path = context.path
		const isGsi = path === '/gsi' || path.startsWith('/api/gsi')

		if (!isSafe && !isGsi && !isAuthorizedControl(context)) {
			context.status = 401
			context.body = {
				error: 'Unauthorized',
				message: 'Control actions require a loopback connection or a valid X-Neuron-Token header.',
			}
			return
		}
		await next()
	})

	// 2. Initialize principal router for API routes
	const router = new KoaRouter()
	registerConfigRoutes(router, websocket)
	registerDiagnosticsRoutes(router, websocket)
	registerDependencyRoutes(router)
	registerGsiRoutes(router, websocket)
	registerHudRoutes(router)
	registerKomplettligaenRoutes(router, websocket)
	registerLicensesRoutes(router)
	registerRadarRoutes(router)
	registerVersionRoutes(router)
	registerSessionRoutes(router)
	registerObsRoutes(router, websocket)

	app.use(router.routes())
	app.use(router.allowedMethods())

	// 3. Centralized fallback for static assets
	app.use(async (context) => {
		if (context.status !== 404 || context.body) return

		const urlPath = context.path
		
		try {
			if (urlPath.startsWith('/config/')) {
				const file = urlPath.slice(8).trim() || 'index.html'
				const root = join(builtinRootDirectory, 'src/config')
				await send(context, file, { root })
				if (context.body) {
					context.status = 200
					if (file.endsWith('.vue')) context.type = 'text/plain'
					else if (file.endsWith('.js')) context.type = 'application/javascript'
					else if (file.endsWith('.css')) context.type = 'text/css'
				}
			} 
			else if (urlPath.startsWith('/radar/')) {
				const file = urlPath.slice(7).trim() || 'index.html'
				const root = join(builtinRootDirectory, 'src/radar')
				await send(context, file, { root })
				if (context.body) context.status = 200
			} 
			else if (urlPath.startsWith('/remote/')) {
				const file = urlPath.slice(8).trim() || 'index.html'
				const root = join(builtinRootDirectory, 'src/remote')
				await send(context, file, { root })
				if (context.body) {
					context.status = 200
					if (file.endsWith('.vue')) context.type = 'text/plain'
					else if (file.endsWith('.js')) context.type = 'application/javascript'
					else if (file.endsWith('.css')) context.type = 'text/css'
				}
			}
			else if (urlPath.startsWith('/hud/')) {
				const themeTree = await getThemeTree(context.query.theme)
				const hudPath = decodeURIComponent(urlPath.slice(5) || 'index.html').replace(/^\//, '')
				if (basename(hudPath).startsWith('.')) return

				const body = await concatStaticFileFromThemeTreeRecursively(hudPath, [], themeTree)
				if (body) {
					context.type = extname(hudPath)
					context.body = Buffer.isBuffer(body[0]) ? Buffer.concat(body) : body.join('\n')
					context.status = 200
				}
			}
			else {
				// Fallback to serving from the public directory
				const root = join(builtinRootDirectory, 'public')
				await send(context, urlPath.replace(/^\//, ''), { root })
				if (context.body) context.status = 200
			}
		} catch (err) {
			// Silent 404
		}
	})

	server.listen(port, host)
	
	const interfaces = os.networkInterfaces()
	const addresses = []
	for (const k in interfaces) {
		for (const k2 in interfaces[k]) {
			const address = interfaces[k][k2]
			if (address.family === 'IPv4' && !address.internal) {
				addresses.push(address.address)
			}
		}
	}

	const exposedToNetwork = host !== '127.0.0.1' && host !== 'localhost' && host !== '::1'

	console.info(`\n[NeuronCast] CS2 Broadcast Server active at:`)
	console.info(` > Local Config:  http://localhost:${port}/config/`)
	console.info(` > Local Remote:  http://localhost:${port}/remote/`)
	console.info(` > Local HUD:     http://localhost:${port}/hud/`)

	if (exposedToNetwork) {
		const token = getControlToken()
		addresses.forEach(addr => {
			console.info(` > Mobile Remote: http://${addr}:${port}/remote/?token=${token}`)
		})
		console.info(`\n[Server] Bound to ${host} — control surface reachable from the network.`)
		console.info(`[Server] Remote control actions require token (?token=${token}).`)
	} else {
		console.info(`\n[Server] Bound to loopback (${host}). Set HOST=0.0.0.0 in .env to expose for phone over Wi-Fi.`)
	}
	if (isUiDevMode) {
		console.info('UI dev mode enabled: serving static match state and ignoring live GSI posts.')
	}

	// 4. Graceful Shutdown & Unhandled Exception Logging
	process.on('uncaughtException', (error) => {
		console.error('[NON-FATAL] Uncaught Exception (server kept alive):', error)
	})

	process.on('unhandledRejection', (reason, promise) => {
		console.error('[NON-FATAL] Unhandled Rejection (server kept alive) at:', promise, 'reason:', reason)
	})

	const shutdown = (code = 0) => {
		console.info('Shutting down NeuronCast server cleanly...')
		
		try {
			obsManager.disconnect().catch(() => {})
			websocket.websocket.close(() => {
				console.info('Websocket server closed.')
				server.close(() => {
					console.info('HTTP server closed.')
					process.exit(code)
				})
			})
		} catch (err) {
			console.error('Error during graceful shutdown:', err)
			process.exit(code)
		}

		// Force exit after timeout if closing hangs
		setTimeout(() => {
			console.warn('Shutdown timed out, forcing exit.')
			process.exit(code)
		}, 3000)
	}

	process.on('SIGINT', () => shutdown(0))
	process.on('SIGTERM', () => shutdown(0))
}

run().then(() => {}).catch(console.error)

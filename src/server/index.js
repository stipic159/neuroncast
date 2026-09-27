import http from 'http'
import os from 'os'
import { join, basename, extname } from 'path'

import bodyParser from 'koa-bodyparser'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import KoaCompress from 'koa-compress'

import { initSettings, getSettings, getThemeTree } from './settings.js'
import { registerConfigRoutes } from './config.js'
import { registerDependencyRoutes } from './dependencies.js'
import { registerGsiRoutes } from './gsi.js'
import { registerOperatorRoutes } from './routes/operator-routes.js'
import { registerCs2Routes } from './routes/cs2-routes.js'
import { registerDiagnosticsRoutes } from './diagnostics.js'
import { registerHudRoutes, concatStaticFileFromThemeTreeRecursively } from './hud.js'
import { registerKomplettligaenRoutes } from './komplettligaen.js'
import { registerFastcupRoutes, startFastcupPolling } from './fastcup.js'
import { registerLicensesRoutes } from './licenses.js'
import { registerRadarRoutes } from './radar.js'
import { registerVersionRoutes } from './version.js'
import { registerSessionRoutes } from './sessions/session-routes.js'
import { registerObsRoutes } from './obs-routes.js'
import { obsManager } from './integrations/obs-manager.js'
import { cs2Netcon } from './integrations/cs2-netcon.js'
import { Websocket } from './websocket.js'
import send from 'koa-send'
import { builtinRootDirectory } from './helpers/paths.js'
import { isUiDevMode } from './dev-mode.js'
import { isAuthorizedControl, getControlToken } from './auth.js'

Error.stackTraceLimit = 64

// Pre-computed roots and static sets
const ROOT_CONFIG = join(builtinRootDirectory, 'src/config')
const ROOT_RADAR = join(builtinRootDirectory, 'src/radar')
const ROOT_REMOTE = join(builtinRootDirectory, 'src/remote')
const ROOT_PUBLIC = join(builtinRootDirectory, 'public')

const REDIRECT_PATHS = new Set(['/config', '/hud', '/radar', '/remote'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const IGNORED_ERROR_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECANCELED', 'ERR_STREAM_PREMATURE_CLOSE'])

const MIME_TYPES = {
	'.vue': 'text/plain',
	'.js': 'application/javascript',
	'.css': 'text/css',
}

const run = async () => {
	await initSettings()
	const { settings } = await getSettings()

	// Default to 0.0.0.0 so phone / tablet can access mobile remote over local Wi-Fi.
	const host = process.env.HOST || settings.host || '0.0.0.0'
	const port = process.env.PORT || settings.port || 31982

	const app = new Koa()
	const server = http.createServer(app.callback())

	// Suppress expected client premature close & abort errors (e.g. video Range requests from OBS / browser)
	app.on('error', (err) => {
		if (IGNORED_ERROR_CODES.has(err.code)) {
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

	// Параллельная инициализация подсистем вместо водопада await
	await Promise.all([
		websocket.init(),
		obsManager.init().catch((err) => console.warn('[OBS] Init warning:', err.message)),
	])

	// 1. Mandatory Trailing Slash Redirects
	app.use(async (context, next) => {
		const path = context.path
		if (REDIRECT_PATHS.has(path)) {
			context.status = 301
			context.redirect(`${path}/`)
			return
		}
		// animation-asset telemetry: every card-performance / waiting-idle fetch is
		// one playback (per-show cache-busters guarantee a server hit), so the
		// server log doubles as a "what actually played on stream" record
		if (path.includes('/performances/') || path.includes('/waiting-idle/renders/')) {
			console.log(`[anim] ${new Date().toISOString()} ${basename(path)} (${context.querystring})`)
		}
		await next()
	})

	// 1b. Control-plane gate.
	// Mutating requests (anything that isn't a safe read) must come from loopback
	// or carry a valid control token. GSI ingestion is exempt — it has its own
	// token auth and CS2 posts from loopback.
	app.use(async (context, next) => {
		const isSafe = SAFE_METHODS.has(context.method)
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
	registerOperatorRoutes(router, websocket)
	registerHudRoutes(router)
	registerKomplettligaenRoutes(router, websocket)
	registerFastcupRoutes(router, websocket)
	registerLicensesRoutes(router)
	registerRadarRoutes(router)
	registerVersionRoutes(router)
	registerSessionRoutes(router)
	registerObsRoutes(router, websocket)
	registerCs2Routes(router)
	startFastcupPolling(websocket)

	app.use(router.routes())
	app.use(router.allowedMethods())

	// 3. Centralized fallback for static assets
	app.use(async (context) => {
		if (context.status !== 404 || context.body) return

		const urlPath = context.path

		try {
			if (urlPath.startsWith('/config/')) {
				const file = urlPath.slice(8).trim() || 'index.html'
				await send(context, file, { root: ROOT_CONFIG })
				if (context.body) {
					context.status = 200
					const ext = extname(file)
					if (MIME_TYPES[ext]) context.type = MIME_TYPES[ext]
				}
			}
			else if (urlPath.startsWith('/radar/')) {
				const file = urlPath.slice(7).trim() || 'index.html'
				await send(context, file, { root: ROOT_RADAR })
				if (context.body) context.status = 200
			}
			else if (urlPath.startsWith('/remote/')) {
				const file = urlPath.slice(8).trim() || 'index.html'
				await send(context, file, { root: ROOT_REMOTE })
				if (context.body) {
					context.status = 200
					const ext = extname(file)
					if (MIME_TYPES[ext]) context.type = MIME_TYPES[ext]
				}
			}
			else if (urlPath.startsWith('/hud/')) {
				let hudPath
				try {
					hudPath = decodeURIComponent(urlPath.slice(5) || 'index.html').replace(/^\/+/, '')
				} catch (_) {
					return
				}
				if (basename(hudPath).startsWith('.')) return

				const themeTree = await getThemeTree(context.query.theme)
				const body = await concatStaticFileFromThemeTreeRecursively(hudPath, [], themeTree)
				if (body) {
					context.type = extname(hudPath)
					context.body = Buffer.isBuffer(body[0]) ? Buffer.concat(body) : body.join('\n')
					context.status = 200
				}
			}
			else {
				// Fallback to serving from the public directory
				await send(context, urlPath.replace(/^\/+/, ''), { root: ROOT_PUBLIC })
				if (context.body) context.status = 200
			}
		} catch {
			// Silent 404
		}
	})

	server.listen(port, host)

	const interfaces = os.networkInterfaces()
	const addresses = []
	for (const k of Object.keys(interfaces)) {
		const ifaceList = interfaces[k]
		if (!ifaceList) continue
		for (const iface of ifaceList) {
			if (iface.family === 'IPv4' && !iface.internal) {
				addresses.push(iface.address)
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

	let isShuttingDown = false

	const shutdown = (code = 0) => {
		if (isShuttingDown) return
		isShuttingDown = true

		console.info('Shutting down NeuronCast server cleanly...')

		// Force exit after timeout if closing hangs
		const forceTimer = setTimeout(() => {
			console.warn('Shutdown timed out, forcing exit.')
			process.exit(code)
		}, 3000)
		if (forceTimer.unref) forceTimer.unref()

		obsManager.disconnect().catch(() => {})
		cs2Netcon.disconnect()

		websocket.websocket.close(() => {
			console.info('Websocket server closed.')
			server.close((err) => {
				if (err) console.error('Error closing HTTP server:', err)
				else console.info('HTTP server closed.')
				clearTimeout(forceTimer)
				process.exit(code)
			})
		})
	}

	process.on('SIGINT', () => shutdown(0))
	process.on('SIGTERM', () => shutdown(0))
}

run().catch(console.error)

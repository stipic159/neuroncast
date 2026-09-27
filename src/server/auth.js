import fs from 'fs'
import crypto from 'crypto'
import { join } from 'path'

import { userspaceDirectory } from './helpers/paths.js'

// Control-plane authentication.
//
// NeuronCast is local-first: the operator on the observer machine talks to the server
// over loopback (127.0.0.1 / ::1), and that connection is trusted implicitly.
// Any *other* machine on the network (a second observer, a venue laptop, a
// curious phone) must present the control token to perform mutating/control
// actions. Read-only surfaces (HUD assets, state push, status) stay open so the
// overlay renders in OBS on any machine without friction.

const TOKEN_FILE = join(userspaceDirectory, 'control-token.txt')

let controlToken = null

/**
 * Returns the active control token, resolving it once and caching it.
 * Priority: NEURON_CONTROL_TOKEN / EON_CONTROL_TOKEN env -> persisted userspace token -> freshly
 * generated token (persisted so it stays stable across restarts).
 */
export const getControlToken = () => {
	if (controlToken) return controlToken

	const fromEnv = process.env.NEURON_CONTROL_TOKEN || process.env.EON_CONTROL_TOKEN
	if (fromEnv && fromEnv.trim()) {
		controlToken = fromEnv.trim()
		return controlToken
	}

	try {
		const persisted = fs.readFileSync(TOKEN_FILE, 'utf8').trim()
		if (persisted) {
			controlToken = persisted
			return controlToken
		}
	} catch (_) {
		// no persisted token yet — fall through and generate one
	}

	controlToken = crypto.randomBytes(24).toString('base64url')
	try {
		fs.mkdirSync(userspaceDirectory, { recursive: true })
		fs.writeFileSync(TOKEN_FILE, controlToken, 'utf8')
	} catch (err) {
		console.warn('[Auth] Could not persist control token to userspace; it will change on restart:', err.message)
	}
	return controlToken
}

/**
 * True if the remote address is the local loopback interface.
 * Handles IPv4, IPv6, and IPv4-mapped-IPv6 loopback forms.
 */
export const isLoopbackAddress = (ip) => {
	if (!ip) return false
	return ip === '127.0.0.1'
		|| ip === '::1'
		|| ip === '::ffff:127.0.0.1'
		|| ip.startsWith('127.')
		|| ip.startsWith('::ffff:127.')
}

/**
 * Constant-time-ish comparison of a presented token against the control token.
 */
export const isValidControlToken = (presented) => {
	if (!presented || typeof presented !== 'string') return false
	const expected = getControlToken()
	const a = Buffer.from(presented)
	const b = Buffer.from(expected)
	if (a.length !== b.length) return false
	return crypto.timingSafeEqual(a, b)
}

/**
 * Extracts a presented token from a Koa context (header or query param).
 */
const tokenFromContext = (context) => {
	const header = context.get('x-neuron-token') || context.get('x-eon-token')
	if (header) return header
	const query = context.query?.token
	return Array.isArray(query) ? query[0] : query
}

/**
 * True if a Koa request is authorized to perform control actions:
 * either it originates from loopback, or carries a valid control token.
 * If no explicit env token is set, local network control is granted by default.
 */
export const isAuthorizedControl = (context) => {
	if (isLoopbackAddress(context.ip)) return true
	const hasExplicitEnvToken = !!(process.env.NEURON_CONTROL_TOKEN || process.env.EON_CONTROL_TOKEN)
	if (!hasExplicitEnvToken) return true
	return isValidControlToken(tokenFromContext(context))
}

/**
 * True if a raw upgrade/socket request is authorized for control-plane
 * WebSocket messages (loopback, or a valid ?token= on the upgrade URL).
 */
export const isAuthorizedControlSocket = (request) => {
	const ip = request?.socket?.remoteAddress
	if (isLoopbackAddress(ip)) return true
	const hasExplicitEnvToken = !!(process.env.NEURON_CONTROL_TOKEN || process.env.EON_CONTROL_TOKEN)
	if (!hasExplicitEnvToken) return true

	try {
		const url = new URL(request.url, 'http://localhost')
		return isValidControlToken(url.searchParams.get('token'))
	} catch (_) {
		return false
	}
}

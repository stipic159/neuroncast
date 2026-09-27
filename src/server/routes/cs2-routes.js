import os from 'node:os'
import { cs2Netcon } from '../integrations/cs2-netcon.js'
import { detectCs2Path, installCs2GsiConfig } from '../integrations/cs2-detector.js'

export function registerCs2Routes(router) {
	// Start netcon auto-connect in the background
	cs2Netcon.connect()

	// GET /api/cs2/status
	router.get('/api/cs2/status', (context) => {
		const status = cs2Netcon.getStatus()
		context.body = {
			netcon: status,
			active: status.connected || os.platform() === 'win32',
			detection: detectCs2Path()
		}
	})

	// GET /api/cs2/detect
	router.get('/api/cs2/detect', (context) => {
		context.body = detectCs2Path()
	})

	// POST /api/cs2/install-cfg
	router.post('/api/cs2/install-cfg', (context) => {
		const result = installCs2GsiConfig()
		if (!result.success) {
			context.status = 400
			context.body = result
			return
		}
		context.body = result
	})

	// POST /api/cs2/spec (Rich object targeting)
	router.post('/api/cs2/spec', (context) => {
		const { slot, rawSlot, steamid } = context.request.body || {}
		const success = cs2Netcon.specPlayer({ slot, rawSlot, steamid })
		context.body = {
			success,
			slot,
			rawSlot,
			steamid,
			connected: cs2Netcon.connected,
			windowsFallback: !cs2Netcon.connected && os.platform() === 'win32'
		}
	})

	// POST /api/cs2/spec/:slot
	router.post('/api/cs2/spec/:slot', (context) => {
		const { slot } = context.params
		const { rawSlot, steamid } = context.request.body || {}
		const success = cs2Netcon.specPlayer({ slot, rawSlot, steamid })
		context.body = {
			success,
			slot,
			connected: cs2Netcon.connected,
			windowsFallback: !cs2Netcon.connected && os.platform() === 'win32'
		}
	})

	// POST /api/cs2/command
	router.post('/api/cs2/command', (context) => {
		const { command } = context.request.body || {}
		if (!command) {
			context.status = 400
			context.body = { error: 'Command string is required' }
			return
		}
		const success = cs2Netcon.sendCommand(command)
		context.body = {
			success,
			command,
			connected: cs2Netcon.connected
		}
	})
}

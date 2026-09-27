import { cs2Netcon } from '../integrations/cs2-netcon.js'
import { detectCs2Path, installCs2GsiConfig } from '../integrations/cs2-detector.js'

export function registerCs2Routes(router) {
	// Start netcon auto-connect in the background
	cs2Netcon.connect()

	// GET /api/cs2/status
	router.get('/api/cs2/status', (context) => {
		context.body = {
			netcon: cs2Netcon.getStatus(),
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

	// POST /api/cs2/spec/:slot
	router.post('/api/cs2/spec/:slot', (context) => {
		const { slot } = context.params
		const success = cs2Netcon.specPlayer(slot)
		context.body = {
			success,
			slot,
			connected: cs2Netcon.connected
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

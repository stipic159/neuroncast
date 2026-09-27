import { vetoEngine } from './veto-engine.js'
import { getActiveMatchConfig } from '../integrations/faceit/faceit-service.js'

export function registerVetoRoutes(router, websocket) {
	// Broadcast engine updates automatically to all clients
	vetoEngine.onStateChange((state) => {
		if (websocket?.broadcastToWebsockets) {
			websocket.broadcastToWebsockets('veto:sync', state)
		}
	})

	// Get current veto snapshot
	router.get('/api/veto/state', async (context) => {
		context.body = {
			ok: true,
			state: vetoEngine.getState(),
		}
	})

	// Start or restart a veto session
	router.post('/api/veto/start', async (context) => {
		const body = context.request.body || {}
		const activeMatch = getActiveMatchConfig()

		const sessionConfig = {
			matchId: body.matchId || activeMatch?.id,
			format: body.format || activeMatch?.format || 'bo3',
			knifeRoundDecider: body.knifeRoundDecider !== undefined ? body.knifeRoundDecider : true,
			firstTeam: body.firstTeam || 'team1',
			timerDuration: body.timerDuration || 30,
			timerEnabled: body.timerEnabled !== false,
			autoStartTimer: body.autoStartTimer !== false,
			mapPool: body.mapPool || activeMatch?.activeMapPool,
		}

		const state = vetoEngine.initSession(sessionConfig)
		context.body = { ok: true, state }
	})

	// Execute action (BAN, PICK, SIDE_PICK)
	router.post('/api/veto/action', async (context) => {
		const body = context.request.body || {}
		try {
			const updatedState = vetoEngine.executeAction(body)
			context.body = { ok: true, state: updatedState }
		} catch (err) {
			context.status = 400
			context.body = { ok: false, error: err.message }
		}
	})

	// Undo last action
	router.post('/api/veto/undo', async (context) => {
		const updatedState = vetoEngine.undoLastAction()
		context.body = { ok: true, state: updatedState }
	})

	// Reset veto
	router.post('/api/veto/reset', async (context) => {
		const resetState = vetoEngine.reset()
		context.body = { ok: true, state: resetState }
	})

	// Timer control
	router.post('/api/veto/timer', async (context) => {
		const body = context.request.body || {}
		const action = body.action || 'toggle' // 'start', 'pause', 'add', 'reset'

		if (action === 'start') vetoEngine.startTimer()
		else if (action === 'pause') vetoEngine.pauseTimer()
		else if (action === 'add') vetoEngine.addTimerSeconds(body.seconds || 30)
		else if (action === 'reset') vetoEngine._resetStepTimer()

		context.body = { ok: true, timer: vetoEngine.getState().timer }
	})
}

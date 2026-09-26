import { obsManager } from './integrations/obs-manager.js'

export const registerObsRoutes = (router, websocket) => {
	// Status & config
	router.get('/api/obs/status', (context) => {
		context.body = obsManager.getStatus()
	})

	router.post('/api/obs/config', async (context) => {
		const body = context.request.body || {}
		await obsManager.saveConfig(body)
		context.body = {
			success: true,
			status: obsManager.getStatus(),
		}
	})

	router.post('/api/obs/connect', async (context) => {
		try {
			await obsManager.connect()
			context.body = { success: true, status: obsManager.getStatus() }
		} catch (err) {
			context.status = 502
			context.body = { success: false, error: err.message, status: obsManager.getStatus() }
		}
	})

	router.post('/api/obs/disconnect', async (context) => {
		await obsManager.disconnect()
		context.body = { success: true, status: obsManager.getStatus() }
	})

	// Scene control
	router.post('/api/obs/scene', async (context) => {
		const { sceneName, role } = context.request.body || {}
		try {
			if (role) {
				await obsManager.switchRoleScene(role)
			} else if (sceneName) {
				await obsManager.setScene(sceneName)
			} else {
				context.status = 400
				context.body = { success: false, error: 'sceneName or role required' }
				return
			}
			context.body = { success: true, currentScene: obsManager.currentScene }
		} catch (err) {
			context.status = 500
			context.body = { success: false, error: err.message }
		}
	})

	// Microphone Mute toggle (Caster Cough)
	router.post('/api/obs/mic/toggle', async (context) => {
		try {
			const muted = await obsManager.toggleMicMute()
			context.body = { success: true, muted }
		} catch (err) {
			context.status = 500
			context.body = { success: false, error: err.message }
		}
	})

	// Save Replay Buffer
	router.post('/api/obs/replay-buffer/save', async (context) => {
		try {
			await obsManager.saveReplayBuffer()
			context.body = { success: true }
		} catch (err) {
			context.status = 500
			context.body = { success: false, error: err.message }
		}
	})

	// Broadcast OBS status updates to connected WebSocket clients
	obsManager.subscribe((status) => {
		websocket?.broadcastToWebsockets?.('obs:status', status)
	})
}

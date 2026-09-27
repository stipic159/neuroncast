import { autoReplayService } from '../director/auto-replay-service.js'

export const registerReplaysRoutes = (router, websocket) => {
	// List recent match highlights / replay queue
	router.get('/api/replays', (context) => {
		context.body = {
			highlights: autoReplayService.getHighlights(),
		}
	})

	// Trigger manual replay save or replay action
	router.post('/api/replays/trigger', async (context) => {
		const { highlightId } = context.request.body || {}
		try {
			const hl = await autoReplayService.triggerManualReplay(highlightId)
			context.body = {
				success: true,
				highlight: hl,
			}
		} catch (err) {
			context.status = 500
			context.body = { success: false, error: err.message }
		}
	})

	// Clear highlights
	router.delete('/api/replays', (context) => {
		autoReplayService.clearHighlights()
		context.body = { success: true }
	})
}

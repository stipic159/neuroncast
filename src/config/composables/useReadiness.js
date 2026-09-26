/*
 * useReadiness — shared subscription to /api/diagnostics/broadcast-readiness.
 *
 * Single shared instance at module scope so AppSidebar's footer chip and
 * BroadcastStatusBar do not poll independently.
 *
 * Polls every 5 seconds. Reactive consumers receive updates automatically.
 *
 * No websocket invalidation in Phase 24A — the existing store websocket
 * already mutates state.options reactively; the readiness endpoint is the
 * authoritative source for scene/GSI/package/theme/cache state that's not
 * already in state.options.
 */

import { reactive, readonly } from '/dependencies/vue.js'

const POLL_MS = 5000

const sharedState = reactive({
	summary: null,
	lastFetchedAt: null,
	loading: false,
	error: null,
})

let pollTimer = null
let started = false

const fetchOnce = async () => {
	sharedState.loading = true
	try {
		const res = await fetch('/api/diagnostics/broadcast-readiness')
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		sharedState.summary = await res.json()
		sharedState.lastFetchedAt = Date.now()
		sharedState.error = null
	} catch (err) {
		sharedState.error = err.message || String(err)
	} finally {
		sharedState.loading = false
	}
}

const start = () => {
	if (started) return
	started = true
	fetchOnce()
	pollTimer = setInterval(fetchOnce, POLL_MS)
}

export const useReadiness = () => {
	if (!started) start()
	return readonly(sharedState)
}

export const refreshReadiness = () => fetchOnce()

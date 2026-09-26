import { reactive, watch } from '/dependencies/vue.js'
import { NAV_GROUP_BY_ITEM_ID, migrateLegacyCategory } from '/config/nav-config.js'
import { state as language, setLocale, readUiPreference, writeUiPreference } from '/config/i18n.js'

const rawStoredCategory = readUiPreference('eon-config-category')
const initialCategory = migrateLegacyCategory(rawStoredCategory)

export const state = reactive({
	// Configuration Data
	options: {},
	sections: [],
	theme: 'default',

	// UI State
	get locale() { return language.locale },
	activeCategory: initialCategory,
	showAdvancedSettings: readUiPreference('eon-config-advanced') === 'true',
	saveState: 'idle', // idle, saving, saved, error
	lastSavedAt: null, // epoch ms, set by actions.save on success
	alerts: [],        // Caster Alerts

	// Sync State
	socket: null,
	isSynced: false,
})

// If we migrated from a legacy category id, rewrite localStorage immediately
// so the next load skips the migration path.
if (rawStoredCategory !== initialCategory) {
	writeUiPreference('eon-config-category', initialCategory)
}

// Persistence for UI preferences
watch(() => state.activeCategory, (val) => writeUiPreference('eon-config-category', val))
watch(() => state.showAdvancedSettings, (val) => writeUiPreference('eon-config-advanced', val))

// Derived: nav group id for the currently active item. Computed by watcher so
// it stays a plain reactive field consumable from templates without composition.
state.activeGroup = NAV_GROUP_BY_ITEM_ID[state.activeCategory] || ''
watch(() => state.activeCategory, (id) => {
	state.activeGroup = NAV_GROUP_BY_ITEM_ID[id] || ''
})

function warnIfLegacy(key) {
	if (!key) return
	if (
		key.startsWith('css.lan66-') ||
		key.startsWith('css.counter-terrorists-') ||
		key.startsWith('css.terrorists-') ||
		key === 'css.primary-font-family' ||
		key === 'css.custom-font-url' ||
		key === 'css.sponsor-panel-width' ||
		key === 'css.sponsor-panel-height' ||
		key === 'css.ui-radius' ||
		key === 'css.skew-20' ||
		key === 'css.skew-160' ||
		key === 'css.red-rgb' ||
		key === 'css.green-rgb'
	) {
		console.warn(`[Dev Warning] Config SPA emitted legacy key: "${key}". Use the canonical equivalent instead.`)
	}
}

export const actions = {
	setLocale,
	async init() {
		await this.loadOptions()
		this.initWebsocket()
	},

	async loadOptions() {
		try {
			const res = await fetch('/config/options')
			const json = await res.json()

			const options = {}
			for (const opt of json) {
				options[opt.key] = opt.value ?? opt.fallback ?? null
				if (opt.key === 'theme') state.theme = opt.value || opt.fallback
			}
			state.options = options
			state.isSynced = true
		} catch (err) {
			console.error('Failed to load options', err)
		}
	},

	initWebsocket() {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		state.socket = new WebSocket(`${protocol}//${window.location.host}`)

		state.socket.onmessage = (msg) => {
			try {
				const { event, body } = JSON.parse(msg.data)
				if (event === 'config:update' && body.key) {
					state.options[body.key] = body.value
				} else if ((event === 'static_data' || event === 'state') && body.options) {
					Object.assign(state.options, body.options)
				} else if (event === 'CASTER_ALERT') {
					this.addAlert(body.message, body.type)
				}
			} catch (e) {}
		}

		state.socket.onclose = () => setTimeout(() => this.initWebsocket(), 1000)
	},

	addAlert(message, type = 'info') {
		const id = Date.now()
		state.alerts.push({ id, message, type })
		setTimeout(() => {
			const idx = state.alerts.findIndex(a => a.id === id)
			if (idx !== -1) state.alerts.splice(idx, 1)
		}, 5000)
	},

	async save(partial = null) {
		state.saveState = 'saving'
		const payload = partial || { ...state.options, theme: state.theme }

		if (partial) {
			for (const key of Object.keys(partial)) {
				warnIfLegacy(key)
			}
		} else {
			for (const key of Object.keys(state.options)) {
				warnIfLegacy(key)
			}
		}

		try {
			await fetch('/config/options', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			state.saveState = 'saved'
			state.lastSavedAt = Date.now()
			setTimeout(() => { if (state.saveState === 'saved') state.saveState = 'idle' }, 2000)
		} catch (err) {
			state.saveState = 'error'
			console.error(err)
		}
	},

	async forceRefresh() {
		try {
			await fetch('/config/force-hud-refresh', { method: 'POST' })
			this.addAlert('HUD Refresh Triggered', 'success')
		} catch (err) {
			this.addAlert('Refresh failed', 'error')
		}
	},

	broadcast(key, value) {
		warnIfLegacy(key)
		if (state.socket && state.socket.readyState === WebSocket.OPEN) {
			if (key.includes(':')) {
				state.socket.send(JSON.stringify({ event: key, body: value }))
				return
			}

			state.socket.send(JSON.stringify({ event: 'config:update', body: { key, value } }))
		}
	}
}

import * as Vue from '/dependencies/vue.js'
// Pre-import the shared state module so vue3-sfc-loader components receive the
// SAME reactive objects as the native websocket/app code.  Without this, vue3-sfc-loader
// creates a separate module instance and options is always empty inside shell.js.
import * as stateModule from '/hud/core/state.js'

// These options are used for vue3-sfc-loader, which enables the entire "inherit and override" model for extensibility in this project.
export const sfcLoaderOptions = {
	moduleCache: {
		vue: Vue,
		'/dependencies/vue.js': Vue,
		'/hud/core/state.js': stateModule,
	},

	getFile: async (url) => {
		const res = await fetch(`${url}?v=1717590100`)
		if (! res.ok) throw Object.assign(new Error(res.statusText + ' ' + url), { res })

		// #65: this enables using query params
		const pathname = new URL(`${window.location.origin}${url}`).pathname

		return {
			type: pathname.endsWith('.js') ? '.mjs' : undefined, // this allows nested imports within modules
			getContentData: (asBinary) => asBinary ? res.arrayBuffer() : res.text(),
		}
	},

	addStyle: (textContent) => {
		const style = Object.assign(document.createElement('style'), { textContent })
		const ref = document.head.getElementsByTagName('style')[0] || null
		document.head.insertBefore(style, ref)
	},
}

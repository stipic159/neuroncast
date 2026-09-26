import * as Vue from '/dependencies/vue.js'
import { loadModule } from '/dependencies/vue3-sfc-loader.js'
import { sfcLoaderOptions } from '/dependencies/vue3-sfc-loader-options.js'
import * as i18n from '/config/i18n.js'
import * as store from '/config/store.js'

// Share native module instances with the Config SFC loader only.
const configLoaderOptions = {
	...sfcLoaderOptions,
	moduleCache: { ...sfcLoaderOptions.moduleCache, '/config/i18n.js': i18n, '/config/store.js': store },
}

const app = Vue.createApp(
	Vue.defineAsyncComponent(() => loadModule('/config/App.vue', configLoaderOptions)),
)

i18n.installI18n(app)
app.mount('#app')

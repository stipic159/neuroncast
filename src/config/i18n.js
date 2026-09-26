import { reactive, watch } from '/dependencies/vue.js'
import en from '/config/locales/en.js'
import ru from '/config/locales/ru.js'
import { createTranslator, resolveInitialLocale, readPreference, writePreference, STORAGE_KEY, SUPPORTED_LOCALES } from '/config/i18n-core.js'

export { SUPPORTED_LOCALES }
let storage
try { storage = window.localStorage } catch { /* Continue with an in-memory preference. */ }
const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
export const state = reactive({ locale: resolveInitialLocale(readPreference(STORAGE_KEY, storage), languages) })
const debug = new URLSearchParams(window.location.search).has('i18n-debug')
export const { t, text } = createTranslator({ en, ru }, () => state.locale, debug ? console.warn : null)
export const readUiPreference = key => readPreference(key, storage)
export const writeUiPreference = (key, value) => writePreference(key, value, storage)

export function setLocale(locale) {
	if (!SUPPORTED_LOCALES.includes(locale)) return false
	state.locale = locale
	writePreference(STORAGE_KEY, locale, storage)
	return true
}
watch(() => state.locale, locale => {
	document.documentElement.lang = locale
	document.title = locale === 'ru' ? 'NeuronCast — Панель управления' : 'NeuronCast Config SPA'
}, { immediate: true, flush: 'sync' })
window.addEventListener('storage', event => {
	if (event.key === STORAGE_KEY && (!event.storageArea || event.storageArea === storage)) {
		state.locale = resolveInitialLocale(event.newValue, languages)
	}
})
export const number = (value, options) => new Intl.NumberFormat(state.locale, options).format(value)
export function date(value, options = { dateStyle: 'short', timeStyle: 'short' }) {
	const parsed = value instanceof Date ? value : new Date(value)
	return value == null || !Number.isFinite(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(state.locale, options).format(parsed)
}
export function installI18n(app) {
	Object.assign(app.config.globalProperties, { $t: t, $text: text, $number: number, $date: date, $setLocale: setLocale })
	Object.defineProperty(app.config.globalProperties, '$locale', { get: () => state.locale })
}

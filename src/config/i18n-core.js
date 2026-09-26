// Pure helpers also used by Node tests; no browser or Vue dependency.
export const SUPPORTED_LOCALES = ['en', 'ru']
export const STORAGE_KEY = 'eon-config-locale'

export function readPreference(key, storage) {
	try { return storage?.getItem(key) ?? null } catch { return null }
}
export function writePreference(key, value, storage) {
	try { storage?.setItem(key, value) } catch { /* Private/embedded browsers can deny storage. */ }
}
export function resolveInitialLocale(stored, languages = []) {
	if (SUPPORTED_LOCALES.includes(stored)) return stored
	for (const language of languages) {
		const base = String(language).toLowerCase().split(/[-_]/)[0]
		if (SUPPORTED_LOCALES.includes(base)) return base
	}
	return 'en'
}

export function createTranslator(catalogs, getLocale, warn = null) {
	const missing = new Set()
	const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)
	const interpolate = (value, params) => value.replace(/\{(\w+)\}/g, (match, key) => own(params, key) ? String(params[key]) : match)
	const t = (key, params = {}) => {
		const locale = getLocale()
		const local = catalogs[locale]
		if (!own(local, key) && warn && !missing.has(`${locale}:${key}`)) {
			missing.add(`${locale}:${key}`)
			warn(`[i18n] Missing ${locale} translation: ${key}`)
		}
		const value = own(local, key) ? local[key] : own(catalogs.en, key) ? catalogs.en[key] : String(key)
		return interpolate(value, params)
	}
	// Compatibility for existing operator status strings / server alerts. Unknown
	// messages pass through unchanged. Never call this on user names or form values.
	const patterns = Object.keys(catalogs.en).filter(key => /\{\w+\}/.test(key)).map(key => {
		const names = []
		const escaped = key.split(/(\{\w+\})/).map(part => {
			if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)' }
			return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		}).join('')
		return { key, names, regex: new RegExp(`^${escaped}$`) }
	})
	const text = value => {
		getLocale()
		if (value == null) return ''
		const source = String(value)
		if (own(catalogs.en, source)) return t(source)
		for (const { key, names, regex } of patterns) {
			const match = source.match(regex)
			if (match) return t(key, Object.fromEntries(names.map((name, i) => [name, match[i + 1]])))
		}
		return source
	}
	return { t, text }
}

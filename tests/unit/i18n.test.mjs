import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import en from '../../src/config/locales/en.js'
import ru from '../../src/config/locales/ru.js'
import { createTranslator, resolveInitialLocale, readPreference, writePreference } from '../../src/config/i18n-core.js'

test('locale respects saved choice, ordered browser preferences and English fallback', () => {
	assert.equal(resolveInitialLocale('en', ['ru-RU']), 'en')
	assert.equal(resolveInitialLocale(null, ['ru-RU']), 'ru')
	assert.equal(resolveInitialLocale('broken', ['fr-FR', 'ru']), 'ru')
	assert.equal(resolveInitialLocale(null, ['en-US', 'ru']), 'en')
	assert.equal(resolveInitialLocale(null, ['ja-JP']), 'en')
	assert.equal(resolveInitialLocale(null, []), 'en')
})

test('denied storage does not prevent locale selection', () => {
	const storage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
	assert.equal(readPreference('locale', storage), null)
	assert.doesNotThrow(() => writePreference('locale', 'ru', storage))
})

test('fallback, interpolation, unknown messages and missing-key warnings', () => {
	let locale = 'ru'
	const warnings = []
	const { t, text } = createTranslator({ en: { hello: 'Hello {name}', fallback: 'English' }, ru: { hello: 'Привет, {name}' } }, () => locale, message => warnings.push(message))
	assert.equal(t('hello', { name: '<b>Default</b>' }), 'Привет, <b>Default</b>')
	assert.equal(t('fallback'), 'English')
	t('fallback')
	assert.equal(warnings.length, 1)
	assert.equal(text('Unknown upstream error'), 'Unknown upstream error')
	assert.equal(text(null), '')
	assert.equal(t('unknown.key'), 'unknown.key')
	locale = 'en'
	assert.equal(t('hello', { name: 'Default' }), 'Hello Default')
})

test('existing server alerts translate while parameters remain untouched', () => {
	const { text } = createTranslator({ en, ru }, () => 'ru')
	assert.equal(text('Bomb Planted'), 'Бомба установлена')
	assert.equal(text('Theme "Default" saved successfully.'), 'Тема «Default» сохранена.')
	assert.equal(text('Unrecognized GSI error'), 'Unrecognized GSI error')
})

test('catalog keys and interpolation parameters agree', () => {
	assert.deepEqual(Object.keys(en).sort(), Object.keys(ru).sort())
	const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
	for (const key of Object.keys(en)) {
		assert.ok(ru[key].trim(), key)
		assert.deepEqual(params(en[key]), params(ru[key]), key)
	}
})

test('every translated Config template compiles and literal keys exist', () => {
	const directory = new URL('../../src/config/components/', import.meta.url)
	for (const file of readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.vue'))) {
		const source = readFileSync(new URL(file.replaceAll('\\', '/'), directory), 'utf8')
		const { descriptor, errors } = parse(source)
		assert.deepEqual(errors, [], file)
		const compiled = compileTemplate({ source: descriptor.template.content, filename: file, id: file })
		assert.deepEqual(compiled.errors, [], file)
		for (const match of source.matchAll(/\$t\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
			const key = match[1][0] === '"' ? JSON.parse(match[1]) : match[1].slice(1, -1)
			assert.ok(Object.hasOwn(en, key), `${file}: ${key}`)
		}
	}
})

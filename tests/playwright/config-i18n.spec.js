import { test, expect } from '@playwright/test'
import en from '../../src/config/locales/en.js'
import ru from '../../src/config/locales/ru.js'

test.use({ locale: 'en-US' })
const picker = page => page.getByTestId('language-select')

test('switches without reloading, losing drafts, or writing broadcast settings', async ({ page }) => {
	await page.goto('/config/')
	await expect(picker(page)).toHaveValue('en')
	await page.locator('.eon-nav-item', { hasText: 'Teams & Players' }).click()
	const draft = page.locator('.override-row.--draft input').first()
	await draft.fill('76561198000000000')
	const name = page.locator('.override-row.--draft input').nth(1)
	await name.fill('Default')
	await page.evaluate(async () => {
		const { state } = await import('/config/store.js')
		window.i18nSentMessages = []
		const send = state.socket.send.bind(state.socket)
		state.socket.send = data => { window.i18nSentMessages.push(data); send(data) }
	})
	const documentId = await page.evaluate(() => { window.i18nDocumentId = Math.random(); return window.i18nDocumentId })
	const mutations = []
	page.on('request', request => { if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) mutations.push(request.url()) })
	await picker(page).selectOption('ru')
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
	await expect(page.locator('.eon-header-title')).toHaveText('Команды и игроки')
	await expect(draft).toHaveValue('76561198000000000')
	await expect(name).toHaveValue('Default')
	await expect(page.getByText('Применить изменения списка', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('Сохранить всё', { exact: true })).toBeVisible()
	expect(await page.evaluate(() => window.i18nDocumentId)).toBe(documentId)
	expect(mutations).toEqual([])
	expect(await page.evaluate(() => window.i18nSentMessages)).toEqual([])
	await page.reload()
	await expect(picker(page)).toHaveValue('ru')
	await expect(page.locator('.eon-header-title')).toHaveText('Команды и игроки')
})

test('all navigation pages render in Russian and switch back to English', async ({ page }) => {
	const errors = []
	page.on('pageerror', error => errors.push(error.message))
	await page.goto('/config/')
	await picker(page).selectOption('ru')
	const items = page.locator('.eon-nav-item')
	for (let index = 0; index < await items.count(); index++) {
		const label = (await items.nth(index).innerText()).trim()
		await items.nth(index).click()
		await expect(page.locator('.eon-header-title')).toHaveText(label)
		await expect(page.locator('.eon-main-inner > :not(.eon-missing)').first()).toBeVisible()
		// Check visible source-language copy, not input values or user data.
		const untranslated = await page.evaluate(keys => {
			const expected = new Set(keys)
			const walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT)
			const found = []
			while (walker.nextNode()) {
				const node = walker.currentNode
				// Resolved team names / candidate values are server data even if they
				// happen to equal UI keys such as "Home Team".
				if (node.parentElement?.closest('.team-card h3, .candidate .value')) continue
				if (node.parentElement?.checkVisibility() && expected.has(node.textContent.trim())) found.push(node.textContent.trim())
			}
			return found
		}, Object.keys(en).filter(key => en[key] !== ru[key]))
		expect(untranslated, label).toEqual([])
	}
	await picker(page).selectOption('en')
	await expect(page.locator('.eon-header-title')).toHaveText('Import / Export')
	expect(errors).toEqual([])
})

test('existing alerts react to locale and unknown messages stay visible', async ({ page }) => {
	await page.goto('/config/')
	await expect(picker(page)).toBeVisible()
	await page.evaluate(async () => {
		const { actions } = await import('/config/store.js')
		actions.addAlert('Bomb Planted')
		actions.addAlert('Unknown upstream message')
	})
	await picker(page).selectOption('ru')
	await expect(page.locator('.eon-caster-alerts')).toContainText('Бомба установлена')
	await expect(page.locator('.eon-caster-alerts')).toContainText('Unknown upstream message')
})

test('locale syncs across tabs without changing another tab’s page', async ({ page, context }) => {
	await page.goto('/config/')
	await expect(picker(page)).toHaveValue('en')
	const other = await context.newPage()
	await other.goto('/config/')
	await expect(picker(other)).toHaveValue('en')
	await picker(page).selectOption('ru')
	await expect(picker(other)).toHaveValue('ru')
	await expect(other.locator('.eon-header-title')).toHaveText('Управление эфиром')
})

for (const [browserLocale, expected] of [['ru-RU', 'ru'], ['ja-JP', 'en']]) {
	test(`first visit with ${browserLocale} selects ${expected}`, async ({ browser }) => {
		const context = await browser.newContext({ locale: browserLocale })
		const page = await context.newPage()
		await page.goto('http://localhost:31982/config/')
		await expect(picker(page)).toHaveValue(expected)
		await context.close()
	})
}

test('storage denied: still opens and switches language', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError') } })
	})
	await page.goto('/config/')
	await picker(page).selectOption('ru')
	await expect(page.locator('.eon-header-title')).toHaveText('Управление эфиром')
})

test('Russian header remains usable at 1024px and keyboard selects a language', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 1024, height: 768 })
	await page.goto('/config/')
	await picker(page).focus()
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('Enter')
	await expect(picker(page)).toHaveValue('ru')
	await page.locator('.eon-nav-item', { hasText: 'Редактор расположения' }).click()
	await expect(page.locator('.layout-editor')).toBeVisible()
	const controls = await page.locator('.eon-header-actions').evaluate(element => {
		const rect = element.getBoundingClientRect()
		return { right: rect.right, width: element.scrollWidth, client: element.clientWidth }
	})
	expect(controls.right).toBeLessThanOrEqual(1024)
	expect(controls.width).toBeLessThanOrEqual(controls.client)
	const toolbarRight = await page.locator('.workbench-toggles').evaluate(element => element.getBoundingClientRect().right)
	expect(toolbarRight).toBeLessThanOrEqual(1024)
	await page.screenshot({ path: testInfo.outputPath('config-ru-1024.png') })
})

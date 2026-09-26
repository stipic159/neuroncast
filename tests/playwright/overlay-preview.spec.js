// overlay-preview.spec.js - render the director-triggered overlays over the
// UI-dev-mode mock game and screenshot them, so the broadcast look can be
// eyeballed WITHOUT CS2. Triggers by dispatching the same socket:draw:* DOM
// events websocket-on-message.js emits, so it exercises the real components.
//
//   npx playwright test overlay-preview   (eon auto-starts in --ui-dev-mode)
//
// Screenshots land in eon/screenshots/preview-*.png.
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../screenshots')

async function hudReady(page) {
	await page.goto('/hud/')
	await expect(page.locator('.hud-stage')).toBeVisible()
	await page.waitForTimeout(900) // let backgrounds/transitions settle
}

test('baseline gameplay HUD (no overlay)', async ({ page }) => {
	await hudReady(page)
	await page.screenshot({ path: path.join(OUT, 'preview-00-hud.png') })
})

test('scoreboard overlay (lower-third, sidebars faded)', async ({ page }) => {
	await hudReady(page)
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('socket:draw:scoreboard', { detail: { show: true } })))
	await expect(page.locator('.scoreboard-overlay')).toBeVisible()
	await page.waitForTimeout(700)
	await page.screenshot({ path: path.join(OUT, 'preview-01-scoreboard.png') })
})

test('player-highlight spotlight card (ACE)', async ({ page }) => {
	await hudReady(page)
	// Haze in the dev fixture: 20 kills, CT, steamid ...008 - spotlight as an ACE
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('socket:draw:highlight', {
			detail: { show: true, steamid: '76561198000000008', roundKills: 5, tag: 'ACE' },
		})))
	await expect(page.locator('.player-highlight.--shown')).toBeVisible()
	await page.waitForTimeout(5000) // let the 12MB agent model load + render a gesture frame
	await page.screenshot({ path: path.join(OUT, 'preview-02-highlight.png') })
})

test('player-highlight spotlight card (CLUTCH 1v3)', async ({ page }) => {
	await hudReady(page)
	// Astra: 18 kills, T, steamid ...001 - spotlight as a 1v3 clutch
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('socket:draw:highlight', {
			detail: { show: true, steamid: '76561198000000001', tag: 'CLUTCH 1v3' },
		})))
	await expect(page.locator('.player-highlight')).toBeVisible()
	await page.waitForTimeout(5000) // lazy-loaded T agent model + a settled gesture frame
	await page.screenshot({ path: path.join(OUT, 'preview-03-clutch.png') })
})

test('player-highlight spotlight card (big damage)', async ({ page }) => {
	await hudReady(page)
	// Ghost: CT, steamid ...007 - spotlight for a big-damage round
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('socket:draw:highlight', {
			detail: { show: true, steamid: '76561198000000007', tag: '231 DMG' },
		})))
	await expect(page.locator('.player-highlight')).toBeVisible()
	await page.waitForTimeout(5000) // lazy-loaded agent model + a settled gesture frame
	await page.screenshot({ path: path.join(OUT, 'preview-04-damage.png') })
})

import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

test.describe('HUD Smoke Test', () => {
  test('should load the HUD page and render the standby screen cleanly', async ({ page }) => {
    // Navigate to the HUD page
    await page.goto('/hud/');
    
    // Page title should contain Eon
    await expect(page).toHaveTitle(/Eon/);
    
    // Check that the core viewport has loaded
    const viewport = page.locator('.hud-viewport');
    await expect(viewport).toBeVisible();
    
    // Since no live CS2 GSI payload has been received on standard startup, it should show the Standby layout
    const standby = page.locator('.standby');
    await expect(standby).toBeVisible();
    
    // Should have connection class ws-connected
    await expect(viewport).toHaveClass(/ws-connected/);
  });

  test('should process a simulated live GSI post and transition to gameplay HUD view', async ({ page, request }) => {
    await page.goto('/hud/');
    
    // Load the live fixture JSON payload
    const fixturePath = path.resolve(projectRoot, 'tests/fixtures/gsi/live.json');
    const raw = await fs.readFile(fixturePath, 'utf8');
    const payload = JSON.parse(raw);
    
    // Send POST to the Eon GSI endpoint
    const response = await request.post('/api/gsi', {
      data: payload
    });
    
    expect(response.ok()).toBe(true);
    
    // Wait for the reactive transition from Standby screen to Active gameplay HUD
    // Active HUD shows players alive, top bars, etc.
    const stage = page.locator('.hud-stage');
    await expect(stage).toBeVisible();
    
    // The standby element should disappear when map data exists
    const standby = page.locator('.standby');
    await expect(standby).not.toBeVisible();
    
    // Assert active map name is visible
    const mapName = page.locator('.current-map__name');
    await expect(mapName).toBeVisible();
    await expect(mapName).toHaveText('de_mirage');
  });
});

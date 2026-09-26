import { test, expect } from '@playwright/test';

test.describe('Config SPA Smoke Test', () => {
  test('should load the Config dashboard and render sidebar panels', async ({ page }) => {
    // Navigate to Config dashboard
    await page.goto('/config/');
    
    // Page title check
    await expect(page).toHaveTitle(/Eon/);
    
    // Check that the main app/navigation container has loaded
    const nav = page.locator('.sidebar-nav, .navigation, .nav-menu, #app');
    await expect(nav).toBeVisible();
    
    // Check that standard tabs are present (like dashboard, layout, teams)
    // We search for elements with texts commonly in Eon's Config SPA
    const body = page.locator('body');
    await expect(body).toContainText(/Live Control|Dashboard|Layout|Sponsors|Teams/i);
  });
});

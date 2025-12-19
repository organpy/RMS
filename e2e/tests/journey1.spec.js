const { test, expect } = require('@playwright/test');

// Journey 1 (smoke): Dashboard load -> navigate to Members -> verify page loads
test.describe('Journey 1 - Smoke Test', () => {
  test('Dashboard loads and Members page is accessible', async ({ page, baseURL }) => {
    // Navigate to dashboard
    await page.goto(baseURL || 'http://localhost:5173');
    
    // Wait for dashboard title to be visible (testid added in Dashboard.jsx)
    const dashboardTitle = page.locator('[data-testid="dashboard-title"]');
    await expect(dashboardTitle).toBeVisible({ timeout: 10000 });
    
    // Verify dashboard has loaded with widgets
    const dashboardWidgets = page.locator('[data-testid="dashboard-widgets"]');
    await expect(dashboardWidgets).toBeVisible({ timeout: 5000 });
    
    // Navigate to Members page using navigation link
    // Look for navigation element - could be in sidebar or header
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const membersLink = navLinks.filter({ hasText: /Members/i });
    
    if (await membersLink.count() > 0) {
      await membersLink.first().click();
      
      // Wait for Members page to load
      await expect(page.locator('[data-testid="members-title"]')).toBeVisible({ timeout: 10000 });
      
      // Verify we're on the Members page by checking URL
      await expect(page).toHaveURL(/members/, { timeout: 5000 });
    } else {
      // Alternative: navigate directly via URL if nav link not found
      await page.goto(baseURL + '/members' || 'http://localhost:5173/members');
      await expect(page.locator('[data-testid="members-title"]')).toBeVisible({ timeout: 10000 });
    }
  });
});

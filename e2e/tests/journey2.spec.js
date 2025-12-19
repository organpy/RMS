const { test, expect } = require('@playwright/test');

// Journey 2: Navigate to Members -> Verify page content loads properly
test.describe('Journey 2 - Members Page Content', () => {
  test('Members page loads with data', async ({ page, baseURL }) => {
    // Navigate to Members page directly
    await page.goto((baseURL || 'http://localhost:5173') + '/members');
    
    // Wait for Members page title to load
    const membersTitle = page.locator('[data-testid="members-title"]');
    await expect(membersTitle).toBeVisible({ timeout: 10000 });
    
    // Verify we're on the Members page
    await expect(page).toHaveURL(/members/, { timeout: 5000 });
    
    // Wait for page to load fully
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Check for either a members table or empty state message
    const table = page.locator('table');
    const emptyState = page.locator('text=/no members|empty state/i');
    
    // At least one of these should exist
    const hasContent = (await table.count()) > 0 || (await emptyState.count()) > 0;
    expect(hasContent).toBe(true);
  });
});

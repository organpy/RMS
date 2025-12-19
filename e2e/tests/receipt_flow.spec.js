const { test, expect } = require('@playwright/test');

// Journey 3: Receipt flow - Navigate to Payments page and verify it loads
test.describe('Journey 3 - Payments & Receipts Flow', () => {
  test('Payments page loads successfully', async ({ page, baseURL }) => {
    // Navigate to Payments page
    await page.goto((baseURL || 'http://localhost:5173') + '/payments');
    
    // Wait for Payments page to load
    const paymentsTitle = page.locator('h1:has-text("Payments")');
    await expect(paymentsTitle).toBeVisible({ timeout: 10000 });
    
    // Verify we're on the Payments page
    await expect(page).toHaveURL(/payments/, { timeout: 5000 });
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Verify page has content (either payments table or empty state)
    const pageContent = page.locator('main, [role="main"], section');
    await expect(pageContent.first()).toBeVisible({ timeout: 5000 });
    
    // Verify "Record Payment" button is present
    const recordButton = page.locator('button:has-text("Record Payment")');
    await expect(recordButton).toBeVisible({ timeout: 5000 });
  });
});

// Minimal Playwright test skeleton — requires Playwright to be installed in frontend
const { test, expect } = require('@playwright/test')

test('record payment and download receipt (smoke)', async ({ page }) => {
  // This is a light smoke test that assumes the app runs at http://localhost:5173
  await page.goto('http://localhost:5173')
  // Use specific nav link selector to avoid strict mode violation on multiple 'Payments' text matches
  await expect(page.locator('a[href*="/payments"]')).toBeVisible()
  // Further steps: open Record Payment dialog, fill fields, submit, and click receipt
})

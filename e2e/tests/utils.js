/**
 * Small helper utilities for Playwright E2E tests.
 * Keep selectors resilient and provide fallbacks.
 */

async function navigateTo(page, path) {
  const base = page.context()._options.baseURL || 'http://localhost:5173';
  await page.goto(base + path);
}

async function ensureVisible(page, selector, timeout = 5000) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new Error(`Selector not visible: ${selector}`);
  });
  return loc;
}

module.exports = {
  navigateTo,
  ensureVisible,
};

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

async function dismissOverlays(page) {
  // Try Escape key
  await page.press('body', 'Escape').catch(() => {});
  await page.waitForTimeout(100).catch(() => {});
  // Try clicking known backdrop elements
  const backdrops = page.locator('[data-state=open], [data-aria-hidden], .dialog-backdrop, .overlay, .radix-portal');
  try {
    const count = await backdrops.count();
    for (let i = 0; i < count; i++) {
      try {
        await backdrops.nth(i).click({ timeout: 100 }).catch(() => {});
      } catch (err) {}
    }
  } catch (err) {}
  // As a final fallback, remove obstructing fixed elements via DOM
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-state=open], .overlay, .dialog-backdrop'));
    nodes.forEach(n => n.remove());
  }).catch(() => {});
}

module.exports = {
  navigateTo,
  ensureVisible,
  dismissOverlays,
};

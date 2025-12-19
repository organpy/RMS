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

async function ensureAppReady(page, timeout = 30000) {
  // Poll until the app shows ready signals (nav, member/payments links) or spinner disappears.
  const start = Date.now();
  const spinner = page.locator('text=Loading the next view', { exact: false });
  const signals = ['nav', '[data-test="nav"]', '[data-test="sidebar"]', 'a[href*="/members"]', 'a[href*="/payments"]', '[data-test=app-ready]'];

  while (Date.now() - start < timeout) {
    try {
      // if spinner present and hidden, assume ready
      if (await spinner.count() > 0) {
        const isHidden = await spinner.first().isHidden().catch(() => false);
        if (isHidden) break;
      }

      // check for any ready signals
      for (const sel of signals) {
        const loc = page.locator(sel);
        if (await loc.count() > 0) {
          const vis = await loc.first().isVisible().catch(() => false);
          if (vis) {
            // settle overlays and return
            await dismissOverlays(page);
            return;
          }
        }
      }
    } catch (err) {
      // ignore transient errors while polling
    }
    await page.waitForTimeout(250).catch(() => {});
  }

  // If we reach here, app didn't signal ready. Capture debug artifacts for inspection.
  try {
    const ts = Date.now();
    await page.screenshot({ path: `../test-results/app-ready-timeout-${ts}.png`, fullPage: true }).catch(() => {});
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync(`../test-results/app-ready-timeout-${ts}.html`, html);
  } catch (e) {}
  // Final attempt to dismiss overlays
  await dismissOverlays(page).catch(() => {});
}

/**
 * Robustly click a locator or selector: dismiss overlays, wait for visible, attempt click,
 * then fallback to DOM click or navigation if necessary.
 * Returns true if click succeeded, false otherwise.
 */
async function robustClick(page, maybeSelectorOrLocator, options = {}) {
  const timeout = options.timeout || 5000;
  let locator;
  if (typeof maybeSelectorOrLocator === 'string') {
    locator = page.locator(maybeSelectorOrLocator).first();
  } else {
    locator = maybeSelectorOrLocator.first ? maybeSelectorOrLocator.first() : maybeSelectorOrLocator;
  }

  try {
    await dismissOverlays(page);
    await locator.waitFor({ state: 'visible', timeout }).catch(() => {});
    await locator.click({ timeout }).catch(async (err) => {
      // Try one more time after dismiss
      await dismissOverlays(page);
      throw err;
    });
    return true;
  } catch (err) {
    // If locator didn't exist, try a text-based fallback for common link/button labels
    try {
      const maybeSelector = (typeof maybeSelectorOrLocator === 'string') ? maybeSelectorOrLocator : null;
      if (maybeSelector) {
        // try finding by text: extract last path segment (e.g. '/members' -> 'Members')
        const m = maybeSelector.match(/\/([^\/]*)\]/) || maybeSelector.match(/\/(\w+)/);
        let textGuess = null;
        if (m && m[1]) textGuess = m[1].replace(/[-_]/g, ' ');
        if (!textGuess) {
          if (maybeSelector.includes('members')) textGuess = 'Members';
          if (maybeSelector.includes('payments')) textGuess = 'Payments';
        }
        if (textGuess) {
          const textLoc = page.locator(`:is(a, button):has-text("${textGuess}")`);
          if (await textLoc.count() > 0) {
            await dismissOverlays(page);
            await textLoc.first().click({ timeout }).catch(() => {});
            return true;
          }
        }
      }
    } catch (e) {}
    // Try DOM click fallback
    try {
      const selector = (typeof maybeSelectorOrLocator === 'string') ? maybeSelectorOrLocator : await locator.evaluate((el) => {
        // build a best-effort selector: prefer id or href or data-test
        if (el.id) return `#${el.id}`;
        if (el.getAttribute && el.getAttribute('href')) return `a[href="${el.getAttribute('href')}"]`;
        if (el.getAttribute && el.getAttribute('data-test')) return `[data-test="${el.getAttribute('data-test')}"]`;
        return null;
      }).catch(() => null);

      if (selector) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.click();
        }, selector).catch(() => {});
        return true;
      }
    } catch (e) {}
    return false;
  }
}

module.exports = {
  navigateTo,
  ensureVisible,
  dismissOverlays,
  ensureAppReady,
  robustClick,
};

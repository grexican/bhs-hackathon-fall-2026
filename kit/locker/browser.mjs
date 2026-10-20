// A headless browser (Playwright Chromium) for the server: log in to a site for a user, read a page,
// take a screenshot. One browser at a time (they're heavy: ~150-300 MB each), and it's always closed,
// even after an error. Server side only.
//
//   import { withBrowser } from "./locker/browser.mjs";
//   const title = await withBrowser(async (page) => {
//     await page.goto("https://example.com");
//     return page.title();
//   });
//
// Setup (once per app, see the headless-browser skill):
//   npm install playwright                                       (in the app folder)
//   npx playwright install chromium                              (on your laptop)
//   npm run locker:set -- <codename> RAILPACK_NODE_PLAYWRIGHT_INSTALL=1   (online: the build installs Chromium)
let queue = Promise.resolve();

/** Runs fn(page, browser) in a fresh headless Chromium, one call at a time. Returns what fn returns. */
export function withBrowser(fn, { timeoutMs = 60_000 } = {}) {
  const run = async () => {
    const { chromium } = await import("playwright").catch(() => {
      throw new Error("The headless browser isn't installed in this app. In the app folder: npm install playwright && npx playwright install chromium");
    });
    const browser = await chromium.launch({ headless: true });
    const timer = setTimeout(() => browser.close().catch(() => {}), timeoutMs); // a stuck page never holds the slot forever
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(Math.min(20_000, timeoutMs));
      return await fn(page, browser);
    } finally {
      clearTimeout(timer);
      await browser.close().catch(() => {});
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {}); // one failure doesn't block the next call
  return result;
}

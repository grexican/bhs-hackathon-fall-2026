// Tests kit/locker/browser.mjs with the kit's own Playwright Chromium: one browser at a time, the
// result comes back, and the browser is closed even when the work throws. Skips if Chromium isn't installed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { chromium } from "playwright";
import { withBrowser } from "../kit/locker/browser.mjs";

const installed = fs.existsSync(chromium.executablePath());

test("withBrowser runs one at a time, returns the result, and always closes", { skip: !installed && "Chromium not installed (npm run setup)" }, async () => {
  let open = 0;
  let most = 0;
  const job = (n) =>
    withBrowser(async (page, browser) => {
      open++;
      most = Math.max(most, open);
      browser.on("disconnected", () => open--);
      await page.setContent(`<title>page ${n}</title>`);
      if (n === 2) throw new Error("boom");
      return page.title();
    });
  const results = await Promise.allSettled([job(1), job(2), job(3)]);
  assert.equal(results[0].value, "page 1");
  assert.equal(results[1].reason.message, "boom");
  assert.equal(results[2].value, "page 3", "a failure doesn't block the next one");
  assert.equal(most, 1, "never two browsers at once");
  assert.equal(open, 0, "every browser closed");
});

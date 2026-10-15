// Opens a generated prototype in a real headless browser, under the SAME sandbox rules as
// /s/<id>/app, clicks through it, and reports what broke. Also takes the phone + desktop
// screenshots shown on the showcase. A prototype isn't "ready" until this passes.
import { chromium } from "playwright";
import { APP_CSP } from "./csp.js";

let browserPromise;
function browser() {
  browserPromise ??= chromium.launch({ args: ["--disable-dev-shm-usage"] }).catch((err) => {
    browserPromise = null; // let the next build try again
    throw err;
  });
  return browserPromise;
}

// A cheap fingerprint of the page, including classes and inline styles, so a tab that only swaps
// an "active" class still counts as responding.
const SNAPSHOT = () => {
  const s = document.body.outerHTML;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

const ORIGIN = "https://prototype.test/"; // never resolved: every request is answered below

export async function browserTest(html) {
  const b = await browser();
  const context = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`Runtime error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`Console error: ${m.text()}`));
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url === ORIGIN) return route.fulfill({ status: 200, contentType: "text/html", headers: { "Content-Security-Policy": APP_CSP }, body: html });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.continue();
    return route.abort(); // the CSP blocks these in production too
  });

  try {
    await page.goto(ORIGIN, { waitUntil: "load", timeout: 15_000 });
    await page.waitForTimeout(600);

    const textLength = (await page.locator("body").innerText()).trim().length;
    const blank = textLength < 80; // a page whose script never ran is usually far below this

    // Click through what a person would click, one at a time, and watch whether anything changes.
    const targets = page.locator("button:visible, [role=tab]:visible, a[href^=\"#\"]:visible, [onclick]:visible");
    const total = Math.min(await targets.count(), 14);
    let changed = 0;
    for (let i = 0; i < total; i++) {
      const before = await page.evaluate(SNAPSHOT);
      const errCount = errors.length;
      try {
        await targets.nth(i).click({ timeout: 1500 });
      } catch {
        continue; // covered or moved by the previous click; not a bug in itself
      }
      await page.waitForTimeout(250);
      const after = await page.evaluate(SNAPSHOT);
      if (after !== before || errors.length > errCount) changed++;
    }

    // Fresh load for the screenshots, so they show the first screen and not wherever the clicks ended.
    await page.goto(ORIGIN, { waitUntil: "load" });
    await page.waitForTimeout(600);
    const mobile = (await page.screenshot({ type: "jpeg", quality: 80 })).toString("base64");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    const desktop = (await page.screenshot({ type: "jpeg", quality: 80 })).toString("base64");

    const problems = [...new Set(errors)].slice(0, 8);
    if (blank) problems.push(`The first screen is nearly empty (${textLength} characters of text). Seed data must render on load.`);
    if (total >= 3 && changed === 0) problems.push(`None of the ${total} buttons or tabs did anything when clicked. Wire up the event handlers.`);
    return { problems, stats: { textLength, clickable: total, responded: changed }, shots: { mobile, desktop } };
  } finally {
    await context.close();
  }
}

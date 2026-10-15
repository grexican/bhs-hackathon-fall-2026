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

// Every visible thing a person would try to tap: real controls, plus anything with a pointer cursor.
// Nested matches collapse to the outermost one, so a card and the text inside it count once.
const FIND_CLICKABLE = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && st.visibility !== "hidden" && st.display !== "none" && r.bottom > 0 && r.top < innerHeight * 3 && r.right > 0 && r.left < innerWidth; // off-canvas screens are not clickable yet
  };
  const candidates = [...document.querySelectorAll("body *")].filter((el) => {
    if (el.matches("button, [role=button], [role=tab], a[href^='#'], [onclick], input[type=checkbox], input[type=radio], select, summary, label")) return visible(el) && !el.disabled;
    return getComputedStyle(el).cursor === "pointer" && visible(el);
  });
  return candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el) && getComputedStyle(other).cursor === "pointer"));
};

const VISIBLE_TEXT = () => {
  const seen = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.1) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  let n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.trim();
    if (text && t.parentElement && seen(t.parentElement)) n += text.length;
  }
  return n;
};

// What fraction of the screen actually shows something? Samples a grid of points and asks the
// browser what is painted there. A page whose layout collapsed (a 0px-wide container once hid an
// entire app) hits only <html>/<body> everywhere, even though its text "exists".
const COVERAGE = () => {
  const empty = new Set([document.documentElement, document.body]);
  let hits = 0;
  let total = 0;
  for (let y = 0.08; y < 1; y += 0.12) {
    for (let x = 0.1; x < 1; x += 0.2) {
      total++;
      const el = document.elementFromPoint(innerWidth * x, innerHeight * y);
      if (el && !empty.has(el)) hits++;
    }
  }
  return hits / total;
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

    // Count only text a person can actually see on the first screen. Text that is transparent,
    // off-canvas or waiting on an animation that never ran once let a blank page pass.
    const textLength = await page.evaluate(VISIBLE_TEXT);
    const coverage = await page.evaluate(COVERAGE);
    const blank = textLength < 60 || coverage < 0.15; // a page whose script never ran is usually far below this

    // Click through what a person would click, one at a time, and watch whether anything changes.
    // "Clickable" means a pointer cursor, not just <button>: apps are often built from tappable
    // cards, rows and chips, and a test that only looked for buttons once passed an app untested.
    const found = await page.evaluateHandle(FIND_CLICKABLE);
    const total = Math.min(await found.evaluate((list) => list.length), 16);
    let changed = 0;
    let tried = 0; // only clicks that actually landed are judged
    for (let i = 0; i < total; i++) {
      const target = (await found.evaluateHandle((list, n) => list[n], i)).asElement();
      if (!target || !(await target.evaluate((el) => el.isConnected && el.getClientRects().length > 0))) continue;
      const before = await page.evaluate(SNAPSHOT);
      const errCount = errors.length;
      try {
        await target.click({ timeout: 1500 });
      } catch {
        continue; // covered or moved by the previous click; not a bug in itself
      }
      tried++;
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
    if (blank) problems.push(`The first screen is nearly empty (${textLength} characters of visible text, ${Math.round(coverage * 100)}% of the screen shows anything). Check the layout and that seed data renders on load.`);
    const clickable = tried;
    if (clickable === 0) problems.push("Nothing on the first screen is clickable. The prototype must have working buttons, tabs or tappable cards.");
    else if (clickable >= 3 && changed === 0) problems.push(`None of the ${clickable} buttons or tabs did anything when clicked. Wire up the event handlers.`);
    else if (clickable >= 3 && changed / clickable < 0.5) problems.push(`Only ${changed} of ${clickable} clickable things did anything when clicked. Every button, tab and tappable card should change something visible.`);
    return { problems, stats: { textLength, coverage: Math.round(coverage * 100) / 100, clickable, responded: changed }, shots: { mobile, desktop } };
  } finally {
    await context.close();
  }
}

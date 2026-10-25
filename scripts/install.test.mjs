// The "Add to Home Screen" helper (kit/locker/install.mjs + install.js): the server bakes in LOCKER_INSTALL,
// and in a real browser each phone gets the right steps while laptops and installed apps get nothing.
// Browser parts skip if Chromium isn't installed. INSTALL_SHOTS=<dir> also saves a screenshot of each case.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { chromium, devices } from "playwright";
import { install, installSettings } from "../kit/locker/install.mjs";

const SHOTS = process.env.INSTALL_SHOTS;
const browserMissing = !fs.existsSync(chromium.executablePath()) && "Chromium not installed (npm run setup)";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const IPHONE = devices["iPhone 13"];
const PIXEL = devices["Pixel 7"];
const UA = {
  safari17: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  safari26: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.22.109 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 618357006)",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  whatsappAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 WhatsApp/2.24",
};

test("installSettings reads LOCKER_INSTALL and ignores typos", () => {
  assert.deepEqual(installSettings({}), {});
  assert.deepEqual(installSettings({ LOCKER_INSTALL: " Required " }), { mode: "required" });
  assert.deepEqual(installSettings({ LOCKER_INSTALL: "nudge" }), { mode: "nudge" });
  assert.deepEqual(installSettings({ LOCKER_INSTALL: "yes please" }), {}, "a typo can't lock anyone out");
});

test("install() serves the script with the setting baked in, and nothing else", () => {
  const sent = {};
  const res = { writeHead: (s, h) => Object.assign(sent, { s, h }), end: (b) => (sent.body = b) };
  assert.equal(install({ method: "GET", url: "/locker/install.js?v=2" }, res, { LOCKER_INSTALL: "nudge" }), true);
  assert.equal(sent.s, 200);
  assert.match(sent.h["Content-Type"], /javascript/);
  assert.ok(sent.body.startsWith('window.__LOCKER_INSTALL__ = {"mode":"nudge"};\n'));
  assert.match(sent.body, /window\.LockerInstall = api/);
  assert.equal(install({ method: "GET", url: "/locker/feedback.js" }, res), false);
  assert.equal(install({ method: "POST", url: "/locker/install.js" }, res), false);
});

// A tiny app: one page, a manifest, icons. `site` is changed by each case.
const site = { env: {}, tag: "", manifest: null };
const FULL_MANIFEST = {
  name: "Lunch Line", short_name: "Lunch Line", description: "See the line before you leave class.", start_url: "/", scope: "/",
  display: "standalone", background_color: "#ffffff", theme_color: "#1c2b7a",
  icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icon-m.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  screenshots: [{ src: "/s1.png", sizes: "750x1334", type: "image/png", form_factor: "narrow" }, { src: "/s2.png", sizes: "1280x800", type: "image/png", form_factor: "wide" }],
};
const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lunch Line</title><meta name="theme-color" content="#1c2b7a"><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icon-192.png">
<script src="/locker/install.js" ${site.tag}></script>
<style>body{margin:0;font:18px system-ui;background:#fde68a} main{padding:24px} h1{margin:0 0 8px}</style></head>
<body><main id="app"><h1>Lunch Line</h1><p>The line is 4 minutes long right now.</p><button>I'm in line</button></main></body></html>`;

let server, base;
async function startServer() {
  server = http.createServer((req, res) => {
    if (install(req, res, site.env)) return;
    const url = req.url.split("?")[0];
    if (url === "/manifest.json") return res.writeHead(200, { "Content-Type": "application/manifest+json" }).end(JSON.stringify(site.manifest ?? FULL_MANIFEST));
    if (url.endsWith(".png")) {
      // The icon: a bold "L" on the brand blue, drawn as SVG for the screenshots (the checker only needs it to load).
      if (url.startsWith("/icon")) return res.writeHead(200, { "Content-Type": "image/svg+xml" }).end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1c2b7a"/><text x="50" y="72" font-size="64" font-family="system-ui" font-weight="800" fill="#fde68a" text-anchor="middle">L</text></svg>`);
      return res.writeHead(200, { "Content-Type": "image/png" }).end(PNG);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page());
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://localhost:${server.address().port}`; // "localhost" so the dev manifest check runs
}

// Opens the page as a given device. `standalone` pretends it was opened from the home screen.
async function open(browser, device, { path: p = "/", standalone = false, dark = false, ua } = {}) {
  const ctx = await browser.newContext({ ...device, ...(ua && { userAgent: ua }), colorScheme: dark ? "dark" : "light" });
  if (standalone)
    await ctx.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
      Object.defineProperty(navigator, "standalone", { get: () => true });
    });
  const pg = await ctx.newPage();
  const logs = [];
  pg.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  pg.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await pg.goto(base + p);
  await pg.waitForTimeout(250);
  return { pg, ctx, logs };
}
const shot = async (pg, name) => SHOTS && (fs.mkdirSync(SHOTS, { recursive: true }), await pg.screenshot({ path: path.join(SHOTS, `${name}.png`) }));
const ui = (pg) => pg.evaluate(() => document.querySelector("locker-install")?.shadowRoot?.querySelector(".ui")?.innerText ?? null);
const appVisible = (pg) => pg.locator("#app").isVisible();

test("in a browser: required, nudge, off, for each phone", { skip: browserMissing, timeout: 120_000 }, async (t) => {
  await startServer();
  const browser = await chromium.launch();
  try {
    await t.test("desktop Chrome never sees anything, even with required", async () => {
      Object.assign(site, { env: { LOCKER_INSTALL: "required" }, tag: "", manifest: null });
      const { pg, ctx } = await open(browser, { viewport: { width: 1280, height: 800 } });
      assert.equal(await ui(pg), null);
      assert.equal(await appVisible(pg), true);
      await shot(pg, "1-desktop-required");
      await ctx.close();
    });

    await t.test("iPhone Safari 17, required: the install page instead of the app, Share at the bottom", async () => {
      const { pg, ctx, logs } = await open(browser, IPHONE, { ua: UA.safari17 });
      const text = await ui(pg);
      assert.match(text, /Lunch Line/);
      assert.match(text, /See the line before you leave class/, "tagline from the manifest");
      assert.match(text, /bar at the bottom/);
      assert.match(text, /Add to Home Screen/);
      assert.equal(await appVisible(pg), false, "the app stays hidden");
      assert.equal(await pg.evaluate(() => !!document.querySelector("locker-install").shadowRoot.querySelector(".pointer.bottom")), true);
      assert.ok(logs.some((l) => /Manifest looks complete/.test(l)), logs.join("\n"));
      assert.ok(!logs.some((l) => /^(error|pageerror)/.test(l)), logs.join("\n"));
      await shot(pg, "2-iphone-safari-required");
      await ctx.close();
    });

    await t.test("iPhone Safari 26: the ⋯ button first; dark mode", async () => {
      site.tag = 'data-why="Your place in line lives on your home screen." data-continue="yes" data-notifications="yes"';
      const { pg, ctx } = await open(browser, IPHONE, { ua: UA.safari26, dark: true });
      const text = await ui(pg);
      assert.match(text, /bottom right/);
      assert.match(text, /Your place in line lives on your home screen/);
      assert.match(text, /iOS 16\.4/);
      await shot(pg, "3-iphone-safari26-dark");
      // "Continue in browser" shows the app, for this tab.
      await pg.locator("locker-install").getByRole("button", { name: "Continue in browser" }).click();
      assert.equal(await appVisible(pg), true);
      site.tag = "";
      await ctx.close();
    });

    await t.test("?install=skip shows the app (for testing), standalone shows the app, /_locker pages are never covered", async () => {
      for (const [opt, label] of [[{ path: "/?install=skip" }, "skip"], [{ standalone: true }, "standalone"], [{ path: "/_locker/login" }, "locker path"], [{ path: "/api/x" }, "api path"]]) {
        const { pg, ctx } = await open(browser, IPHONE, opt);
        assert.equal(await appVisible(pg), true, label);
        assert.equal(await pg.evaluate(() => !!document.querySelector("locker-install .gate, locker-install")?.shadowRoot?.querySelector(".gate")), false, label);
        if (label === "standalone") await shot(pg, "4-iphone-standalone");
        await ctx.close();
      }
    });

    await t.test("Android Chrome, required: menu steps, then our Install button once Chrome allows it", async () => {
      const { pg, ctx } = await open(browser, PIXEL);
      assert.match(await ui(pg), /Install app/);
      await shot(pg, "5a-android-required-menu");
      await pg.evaluate(() => {
        const e = new Event("beforeinstallprompt", { cancelable: true });
        e.prompt = () => (window.__prompted = true);
        e.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(e);
      });
      const btn = pg.locator("locker-install").getByRole("button", { name: "Install Lunch Line" });
      await btn.waitFor();
      await shot(pg, "5b-android-required-button");
      await btn.click();
      assert.equal(await pg.evaluate(() => window.__prompted), true, "Chrome's real install sheet was asked for");
      await pg.waitForTimeout(100);
      assert.match(await ui(pg), /Installed\. Open Lunch Line from your home screen/);
      await shot(pg, "5c-android-installed");
      await ctx.close();
    });

    await t.test("Instagram's in-app browser: open in Safari first, with a copy-link button", async () => {
      const { pg, ctx } = await open(browser, IPHONE, { ua: UA.instagram });
      const text = await ui(pg);
      assert.match(text, /Open it in your browser/);
      assert.match(text, /Open in Safari/);
      assert.match(text, /Copy link/);
      await shot(pg, "6-instagram-required");
      await ctx.close();
    });

    await t.test("WhatsApp on Android: an Open in Chrome button", async () => {
      const { pg, ctx } = await open(browser, PIXEL, { ua: UA.whatsappAndroid });
      assert.match(await pg.evaluate(() => document.querySelector("locker-install").shadowRoot.querySelector('[data-act="chrome"]').getAttribute("href")), /^intent:\/\/localhost:\d+\/#Intent;scheme=https;package=com\.android\.chrome;end$/);
      await ctx.close();
    });

    await t.test("nudge: not on first paint, a card after the delay, Not now hides it, steps sheet on Install", async () => {
      Object.assign(site, { env: { LOCKER_INSTALL: "nudge" }, tag: 'data-delay="1"' });
      const { pg, ctx } = await open(browser, IPHONE);
      assert.equal(await ui(pg), null, "never on first paint");
      assert.equal(await appVisible(pg), true);
      await pg.locator("locker-install").getByRole("button", { name: "Not now" }).waitFor({ timeout: 5000 });
      assert.match(await ui(pg), /Install Lunch Line/);
      await shot(pg, "7a-iphone-nudge");
      await pg.locator("locker-install").getByRole("button", { name: "Install", exact: true }).click();
      assert.match(await ui(pg), /Add to Home Screen/);
      assert.equal(await pg.evaluate(() => document.querySelector("locker-install").shadowRoot.activeElement?.id), "li-s", "focus moves into the sheet");
      await shot(pg, "7b-iphone-nudge-sheet");
      await pg.keyboard.press("Escape");
      assert.match(await ui(pg), /Not now/);
      await pg.locator("locker-install").getByRole("button", { name: "Not now" }).click();
      assert.equal(await ui(pg), null);
      await pg.reload();
      await pg.waitForTimeout(2000);
      assert.equal(await ui(pg), null, "dismissed for 7 days");
      await ctx.close();
    });

    await t.test("nudge on Android Chrome: Install calls Chrome's prompt directly", async () => {
      const { pg, ctx } = await open(browser, PIXEL);
      await pg.evaluate(() => {
        const e = new Event("beforeinstallprompt", { cancelable: true });
        e.prompt = () => (window.__prompted = true);
        e.userChoice = Promise.resolve({ outcome: "dismissed" });
        window.dispatchEvent(e);
      });
      await pg.locator("locker-install").getByRole("button", { name: "Not now" }).waitFor({ timeout: 5000 });
      await shot(pg, "8-android-nudge");
      await pg.locator("locker-install").getByRole("button", { name: "Install", exact: true }).click();
      assert.equal(await pg.evaluate(() => window.__prompted), true);
      await ctx.close();
    });

    await t.test("off (no setting, no data-mode): nothing at all", async () => {
      Object.assign(site, { env: {}, tag: "" });
      const { pg, ctx } = await open(browser, IPHONE);
      await pg.waitForTimeout(500);
      assert.equal(await ui(pg), null);
      await ctx.close();
    });

    await t.test("data-mode on the tag works without the server setting; .env wins over it", async () => {
      Object.assign(site, { env: {}, tag: 'data-mode="required"' });
      let { pg, ctx } = await open(browser, IPHONE);
      assert.equal(await appVisible(pg), false);
      await ctx.close();
      site.env = { LOCKER_INSTALL: "off" };
      ({ pg, ctx } = await open(browser, IPHONE));
      assert.equal(await appVisible(pg), true);
      await ctx.close();
    });

    await t.test("dev check: the console says exactly what the manifest is missing", async () => {
      Object.assign(site, { env: { LOCKER_INSTALL: "nudge" }, tag: "", manifest: { name: "Lunch Line", display: "browser", icons: [{ src: "/icon-192.png", sizes: "192x192" }] } });
      const { pg, ctx, logs } = await open(browser, IPHONE);
      await pg.waitForTimeout(300);
      const warn = logs.find((l) => /still needs/.test(l)) ?? "";
      for (const want of ["short_name", "start_url", "scope", '"display": "standalone"', "512x512", "maskable", "screenshots"]) assert.ok(warn.includes(want), `mentions ${want}:\n${warn}`);
      site.manifest = null;
      await ctx.close();
    });

    await t.test("detect(): iPad that says it's a Mac, Chrome on iPhone, Samsung Internet", async () => {
      const { pg, ctx } = await open(browser, { viewport: { width: 800, height: 600 } });
      const d = (userAgent, maxTouchPoints) => pg.evaluate(([userAgent, maxTouchPoints]) => window.LockerInstall.detect({ userAgent, maxTouchPoints }, () => false), [userAgent, maxTouchPoints]);
      assert.deepEqual((({ mobile, ios, ipad }) => ({ mobile, ios, ipad }))(await d(UA.ipadAsMac, 5)), { mobile: true, ios: true, ipad: true });
      assert.equal((await d(UA.ipadAsMac, 0)).mobile, false, "a real Mac");
      assert.equal((await d(UA.chromeIos, 5)).browser, "chrome");
      assert.equal((await d(UA.chromeIos, 5)).inApp, false);
      assert.equal((await d(UA.samsung, 5)).browser, "samsung");
      assert.equal((await d(UA.instagram, 5)).inApp, true);
      await ctx.close();
    });
  } finally {
    await browser.close();
    server.close();
  }
});

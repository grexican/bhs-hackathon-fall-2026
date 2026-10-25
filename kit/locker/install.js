// "Add to Home Screen" for any page: helps phone users install the app (its own icon, no address bar),
// and can require it. Desktop is never touched. No packages, works in plain HTML and React.
//
//   <script src="/locker/install.js" data-mode="nudge"></script>     (in <head>, no defer, for "required")
//
// Modes:  off       nothing (the default)
//         nudge     a small "Install" card at the bottom, after the 2nd visit or 30 s; "Not now" hides it 7 days
//         required  on a phone that hasn't installed it, an install page shows instead of the app
// The mode comes from, first to last: LockerInstall.init({ mode }), the LOCKER_INSTALL setting in .env
// (served by locker/install.mjs), then data-mode on the tag.
// Other tag options: data-why="One line: why it's an app" · data-continue="yes" (a "Continue in browser" link
// on the install page) · data-delay="30" (nudge seconds) · data-notifications="yes" (mention the iOS 16.4 rule).
// Testing on your own phone (dev only, anyone can use them): ?install=skip (this tab), ?install=preview
// (show it even on a laptop), ?install=reset (forget "Not now" and visits).
(() => {
  if (window.LockerInstall) return;
  const KEY = "locker-install:";
  const DAY = 86_400_000;
  const script = document.currentScript;
  const store = (s, k, v) => {
    try {
      if (v === undefined) return s.getItem(KEY + k);
      if (v === null) s.removeItem(KEY + k);
      else s.setItem(KEY + k, String(v));
    } catch {} // private mode: storage can be missing; then the nudge just forgets
  };

  // ---------- Which phone, which browser, already installed? ----------
  function detect(nav = navigator, mm = (q) => window.matchMedia(q).matches) {
    const ua = nav.userAgent || "";
    const touch = (nav.maxTouchPoints || 0) > 0;
    const ipadAsMac = /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1; // iPadOS Safari says it's a Mac
    const ios = /iPhone|iPad|iPod/.test(ua) || ipadAsMac;
    const android = /Android/i.test(ua);
    // The same rules as the hub's sign-in page, plus a few more apps. "; wv)" = an Android app's web view.
    // On iOS, an app's own web view has no "Safari/" in it (real Safari, Chrome and Firefox all do).
    const inApp = /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|musical_ly|BytedanceWebview|Line\/|LinkedInApp|WhatsApp|Pinterest|Twitter|GSA\/|Gmail|Discord|; wv\)/i.test(ua) || (ios && !/Safari\//.test(ua));
    const browser = ios
      ? /CriOS/.test(ua) ? "chrome" : /FxiOS/.test(ua) ? "firefox" : /EdgiOS/.test(ua) ? "edge" : "safari"
      : /SamsungBrowser/.test(ua) ? "samsung" : /Firefox/.test(ua) ? "firefox" : /EdgA/.test(ua) ? "edge" : /OPR\//.test(ua) ? "opera" : "chrome";
    const osv = ua.match(/OS (\d+)_(\d+)/);
    const safari = Number((ua.match(/Version\/(\d+)/) || [])[1] || 0); // Safari 26+ keeps the iOS version in the UA at 18
    const installed = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some((m) => mm(`(display-mode: ${m})`)) || nav.standalone === true;
    return {
      mobile: (ios || android) && (touch || /Mobile|iPhone/.test(ua)),
      ios, android, ipad: /iPad/.test(ua) || ipadAsMac, inApp, browser, installed,
      iosVersion: osv ? Number(osv[1]) + Number(osv[2]) / 100 : 0,
      safariVersion: safari,
    };
  }

  // ---------- Settings ----------
  const MODES = ["off", "nudge", "required"];
  const attr = (n) => script?.getAttribute(`data-${n}`) ?? undefined;
  const env = window.__LOCKER_INSTALL__ || {};
  const fromTag = {
    mode: attr("mode"), why: attr("why"), allowContinue: attr("continue") === "yes" || attr("continue") === "true",
    delay: attr("delay") ? Number(attr("delay")) : undefined, notifications: attr("notifications") === "yes",
  };
  let opts = {};
  let device;
  let bip = null; // Chrome's saved "beforeinstallprompt" event: calling .prompt() shows the real install sheet
  let installedNow = false;
  let host, root, ui = {};
  let manifest = null;

  const isDev = () => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$/.test(location.hostname);
  // Never on the sign-in round trip, the API, or kit files: only the app's own pages.
  const skippedPath = () => /^\/(_locker|api|health|locker)(\/|$)/.test(location.pathname);

  // ---------- Chrome / Android install events (listen right away: the event fires only once) ----------
  window.addEventListener("beforeinstallprompt", (e) => {
    if (opts.mode === "off" || !(device || detect()).mobile) return; // desktop and "off": leave Chrome's own install icon alone
    e.preventDefault(); // we show our own button instead of Chrome's small bar
    bip = e;
    render();
  });
  window.addEventListener("appinstalled", () => {
    installedNow = true;
    bip = null;
    render();
  });

  // ---------- The manifest: name, icon, colors, and (in dev) what's missing ----------
  let manifestOnce;
  const loadManifest = () => (manifestOnce ??= readManifest());
  async function readManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    try {
      const res = await fetch(link.href, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`${link.getAttribute("href")} answered ${res.status}`);
      const m = await res.json();
      m.__base = res.url;
      return m;
    } catch (err) {
      console.warn(`[install] Couldn't read the manifest: ${err.message}`);
      return null;
    }
  }

  async function checkManifest(m) {
    const miss = [];
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) miss.push('a <link rel="manifest" href="/manifest.json"> in <head>');
    if (link && !m) miss.push("a manifest file that loads and is valid JSON");
    if (m) {
      if (!m.name) miss.push('"name"');
      if (!m.short_name) miss.push('"short_name" (12 characters or fewer: it shows under the icon)');
      else if (m.short_name.length > 12) miss.push(`a shorter "short_name" ("${m.short_name}" is ${m.short_name.length} characters; phones cut it at about 12)`);
      if (!m.start_url) miss.push('"start_url": "/"');
      if (!m.scope) miss.push('"scope": "/"');
      if (!["standalone", "fullscreen", "minimal-ui"].includes(m.display)) miss.push('"display": "standalone"');
      if (!m.theme_color) miss.push('"theme_color"');
      if (!m.background_color) miss.push('"background_color"');
      const icons = m.icons || [];
      const has = (size) => icons.some((i) => String(i.sizes || "").split(/\s+/).includes(size));
      if (!has("192x192")) miss.push("an icon at 192x192 (PNG)");
      if (!has("512x512")) miss.push("an icon at 512x512 (PNG)");
      if (!icons.some((i) => /maskable/.test(i.purpose || ""))) miss.push('a "maskable" icon (purpose: "maskable", the logo inside the middle 80%)');
      const shots = m.screenshots || [];
      if (!shots.length) miss.push('"screenshots" (Android shows a bigger install sheet with them: one with "form_factor": "narrow", one "wide")');
      else {
        if (!shots.some((s) => s.form_factor === "narrow")) miss.push('a screenshot with "form_factor": "narrow" (the phone one)');
        if (!shots.some((s) => s.form_factor === "wide")) miss.push('a screenshot with "form_factor": "wide" (the laptop one)');
      }
      // Check that each icon and screenshot file is really there.
      await Promise.all(
        [...icons, ...shots].filter((f) => f.src).map(async (f) => {
          const url = new URL(f.src, m.__base).href;
          const ok = await fetch(url, { method: "HEAD" }).then((r) => r.ok, () => false);
          if (!ok) miss.push(`the file ${f.src} (listed in the manifest, but it doesn't load)`);
        }),
      );
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) miss.push('<link rel="apple-touch-icon" href="/icon-192.png"> (the iPhone home-screen icon)');
    if (!document.querySelector('meta[name="theme-color"]')) miss.push('<meta name="theme-color" content="..."> in <head>');
    if (miss.length) console.warn(`[install] To install well, the app still needs:\n  - ${miss.join("\n  - ")}\n(the make-it-an-app skill has a manifest to copy)`);
    else console.info("[install] Manifest looks complete.");
  }

  // ---------- Colors: the app's own theme color, kept readable ----------
  const lum = (hex) => {
    const m = String(hex || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  function accentVars() {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = dark ? 0.012 : 0.93; // about the luminance of the sheet's own background
    const c = manifest?.theme_color || document.querySelector('meta[name="theme-color"]')?.content;
    const l = lum(c);
    if (l === null || contrast(l, bg) < 3) return ""; // too close to the background: keep the built-in ink
    return `--accent:${c};--on-accent:${l > 0.4 ? "#0d0f14" : "#ffffff"};`;
  }

  // ---------- Pictures of the real buttons ----------
  const svg = (body, label) => `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>${label ? `<span class="sr">${label}</span>` : ""}`;
  const G = {
    share: svg('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
    more: svg('<circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/>'),
    kebab: svg('<circle cx="12" cy="5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="19" r="1.9" fill="currentColor"/>'),
    burger: svg('<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
    add: svg('<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
    copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" fill="none" stroke="currentColor" stroke-width="1.9"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v16m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const chip = (g, text) => `<span class="chip">${g}<b>${text}</b></span>`;
  const mark = (g, name) => `<span class="chip only">${g}<span class="sr">${name}</span></span>`; // a symbol button: just its picture
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- The steps for this exact phone ----------
  // Returns { steps: [html], pointer: "bottom" | "bottom-right" | "top-right" | null, button: bool, note }
  function plan(d, name) {
    const n = `<b>${esc(name)}</b>`;
    if (d.inApp) {
      const target = d.ios ? "Safari" : "Chrome";
      return {
        kind: "inapp",
        steps: [
          `This app's built-in browser can't install apps. Open the page in <b>${target}</b> first: tap ${mark(d.ios ? G.more : G.kebab, "More")} or ${chip(G.share, "Share")}, then <b>Open in ${d.ios ? "Safari" : "browser"}</b>.`,
          `No button for that? Copy the link and paste it into ${target}.`,
        ],
        pointer: null,
      };
    }
    if (d.ios) {
      const add = `Scroll down, tap ${chip(G.add, "Add to Home Screen")}`;
      const done = `Tap <b>Add</b>. ${n} is on your home screen: open it from there.`;
      if (d.browser === "safari" && d.ipad) return { kind: "ios", steps: [`Tap ${chip(G.share, "Share")} at the top of the screen, next to the address.`, add, done], pointer: "top-right" };
      if (d.browser === "safari" && d.safariVersion >= 26)
        return { kind: "ios", steps: [`Tap ${mark(G.more, "More")} at the bottom right, next to the address.`, `Tap ${chip(G.share, "Share")}`, add, done], pointer: "bottom-right" };
      if (d.browser === "safari") return { kind: "ios", steps: [`Tap ${chip(G.share, "Share")} in the bar at the bottom of the screen.`, add, done], pointer: "bottom" };
      if (d.browser === "chrome") return { kind: "ios", steps: [`Tap ${chip(G.share, "Share")} at the top right, in the address bar.`, add, done], pointer: "top-right" };
      return { kind: "ios", steps: [`Tap ${chip(G.burger, "the menu")}, then ${chip(G.share, "Share")}`, add, done, `Not there? Open this page in Safari and try again.`], pointer: null };
    }
    // Android
    const after = `Tap <b>Install</b>. Then open ${n} from your home screen.`;
    if (d.browser === "samsung") return { kind: "android", steps: [`Tap ${chip(G.burger, "Menu")} at the bottom right.`, `Tap <b>Add page to</b>, then <b>Home screen</b>.`, after], pointer: "bottom-right" };
    if (d.browser === "firefox") return { kind: "android", steps: [`Tap ${mark(G.kebab, "More")} at the top right.`, `Tap <b>Add app to Home screen</b> (or <b>Install</b>).`, after], pointer: "top-right" };
    if (d.browser === "edge") return { kind: "android", steps: [`Tap ${mark(G.more, "More")} at the bottom.`, `Tap <b>Add to phone</b>.`, after], pointer: "bottom" };
    return { kind: "android", steps: [`Tap ${mark(G.kebab, "More")} at the top right.`, `Tap <b>Install app</b> (or <b>Add to Home screen</b>).`, after], pointer: "top-right" };
  }

  // ---------- Styles (inside a shadow root, so they can't touch the app and the app can't touch them) ----------
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .ui { --ink: #12151b; --muted: #555c6b; --paper: #ffffff; --wash: #eef1f6; --line: #d8dde6; --accent: var(--ink); --on-accent: #fff;
      color: var(--ink); font: 17px/1.45 ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      -webkit-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }
    @supports (font: -apple-system-body) { .ui { font: -apple-system-body; font-family: ui-rounded, system-ui, -apple-system, sans-serif; } }
    @media (prefers-color-scheme: dark) {
      .ui { --ink: #eef1f6; --muted: #a3aab8; --paper: #1b1e25; --wash: #13151a; --line: #2e333d; --accent: var(--ink); --on-accent: #12151b; }
    }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .glyph { width: 1.15em; height: 1.15em; flex: none; vertical-align: -0.2em; }
    .chip { display: inline-flex; align-items: center; gap: .3em; padding: .05em .5em .05em .4em; border-radius: .6em;
      background: var(--wash); border: 1px solid var(--line); max-width: 100%; }
    .chip { line-height: 1.35; vertical-align: .05em; margin: .1em 0; }
    .chip b { font-weight: 650; }
    .chip.only { padding: .05em .45em; min-height: 1.5em; }
    .chip .glyph { vertical-align: 0; }
    button, a.btn { font: inherit; cursor: pointer; border-radius: 999px; min-height: 48px; padding: .6em 1.3em; border: 0; text-decoration: none;
      display: inline-flex; align-items: center; justify-content: center; gap: .45em; }
    .primary { background: var(--accent); color: var(--on-accent); font-weight: 700; }
    .quiet { background: transparent; color: var(--muted); font-weight: 600; }
    .ghost { background: var(--wash); color: var(--ink); font-weight: 650; border: 1px solid var(--line); }
    button:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    [tabindex="-1"]:focus { outline: none; } /* headings get focus only so screen readers start there */
    .icon { width: min(4.6em, 30vw); height: min(4.6em, 30vw); border-radius: 22.5%; flex: none; object-fit: cover; background: var(--accent); color: var(--on-accent);
      display: grid; place-items: center; font-weight: 800; font-size: 1em; box-shadow: 0 .6em 1.6em -0.6em rgba(10,14,25,.45), 0 0 0 1px rgba(127,127,127,.18); }
    .icon span { font-size: 2em; }
    ol.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: .25em; counter-reset: s; text-align: left; }
    ol.steps li { counter-increment: s; display: grid; grid-template-columns: 2em 1fr; gap: .7em; align-items: start; padding: .7em 0; border-top: 1px solid var(--line); }
    ol.steps li:first-child { border-top: 0; }
    ol.steps li::before { content: counter(s); width: 2em; height: 2em; border-radius: 50%; display: grid; place-items: center;
      font-weight: 750; font-size: .85em; margin-top: .05em; background: var(--accent); color: var(--on-accent); }
    ol.steps li > span { line-height: 1.6; }

    /* The install page (required) */
    .gate { position: fixed; inset: 0; z-index: 2147483646; overflow-y: auto; background: var(--wash);
      padding: max(2.2em, env(safe-area-inset-top)) 1.25em max(6.5em, calc(env(safe-area-inset-bottom) + 6em)); }
    .gate .col { max-width: 26em; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.4em; justify-items: center; text-align: center; }
    .gate .col > * { max-width: 100%; }
    .gate h1 { overflow-wrap: anywhere; margin: .2em 0 0; font-size: 1.75em; line-height: 1.15; letter-spacing: -0.015em; font-weight: 800; }
    .gate .tag { margin: -.9em 0 0; color: var(--muted); max-width: 22em; }
    .card { width: 100%; background: var(--paper); border: 1px solid var(--line); border-radius: 1.4em; padding: 1.1em 1.2em .5em; text-align: left; }
    .card h2 { margin: 0 0 .3em; font-size: 1.05em; font-weight: 750; }
    .why { margin: 0; color: var(--muted); font-size: .9em; max-width: 24em; }
    .row { display: flex; flex-wrap: wrap; gap: .6em; justify-content: center; }
    .done { font-weight: 650; }

    /* The arrow at the real button */
    .pointer { position: fixed; z-index: 2147483647; color: var(--accent); width: 48px; height: 48px; padding: 8px; border-radius: 50%; pointer-events: none;
      background: var(--paper); box-shadow: 0 4px 14px rgba(0,0,0,.22); }
    .pointer svg { width: 100%; height: 100%; display: block; }
    .pointer.bottom { left: calc(50% - 24px); bottom: max(.4em, env(safe-area-inset-bottom)); }
    .pointer.bottom-right { right: .9em; bottom: max(.4em, env(safe-area-inset-bottom)); }
    .pointer.top-right { right: .9em; top: max(.3em, env(safe-area-inset-top)); transform: rotate(180deg); }
    @media (prefers-reduced-motion: no-preference) {
      .pointer.bottom, .pointer.bottom-right { animation: bob 1.3s ease-in-out infinite; }
      .pointer.top-right { animation: bobup 1.3s ease-in-out infinite; }
      @keyframes bob { 50% { translate: 0 .35em; } }
      @keyframes bobup { 50% { translate: 0 -.35em; } }
      .nudge { animation: rise .32s cubic-bezier(.2,.8,.2,1); }
      @keyframes rise { from { translate: 0 120%; } }
    }

    /* The nudge card */
    .nudge { position: fixed; z-index: 2147483646; left: max(.75em, env(safe-area-inset-left)); right: max(.75em, env(safe-area-inset-right));
      bottom: max(.75em, env(safe-area-inset-bottom)); margin: 0 auto; max-width: 26em; background: var(--paper); border: 1px solid var(--line);
      border-radius: 1.4em; padding: 1em; display: grid; grid-template-columns: auto 1fr; gap: .85em 1em; align-items: center;
      box-shadow: 0 1.2em 2.4em -1em rgba(10,14,25,.45); }
    .nudge .icon { width: 3.2em; height: 3.2em; }
    .nudge .icon span { font-size: 1.4em; }
    .nudge p { margin: 0; }
    .nudge .t { font-weight: 750; }
    .nudge .s { color: var(--muted); font-size: .9em; }
    .nudge .row { grid-column: 1 / -1; justify-content: flex-end; }

    /* The steps sheet (from the nudge) */
    .scrim { position: fixed; inset: 0; z-index: 2147483646; background: rgba(8,10,16,.5); display: flex; align-items: flex-end; justify-content: center; }
    .sheet { width: 100%; max-width: 30em; max-height: 92vh; overflow-y: auto; background: var(--paper); border-radius: 1.4em 1.4em 0 0;
      padding: 1.2em 1.2em max(4em, calc(env(safe-area-inset-bottom) + 3.6em)); /* room for the arrow */ display: grid; gap: .8em; }
    .sheet header { display: flex; align-items: center; gap: .8em; }
    .sheet header .icon { width: 2.8em; height: 2.8em; }
    .sheet header .icon span { font-size: 1.2em; }
    .sheet h2 { margin: 0; font-size: 1.2em; flex: 1; font-weight: 750; }
    .x { min-height: 44px; width: 44px; padding: 0; background: var(--wash); color: var(--ink); }
  `;

  // ---------- Building the screens ----------
  function iconHtml(name) {
    const icons = (manifest?.icons || []).filter((i) => !/maskable/.test(i.purpose || "") || /any/.test(i.purpose || ""));
    const best = icons.sort((a, b) => parseInt(b.sizes) - parseInt(a.sizes))[0];
    const src = best ? new URL(best.src, manifest.__base).href : document.querySelector('link[rel="apple-touch-icon"]')?.href;
    return src ? `<img class="icon" src="${esc(src)}" alt="">` : `<div class="icon" aria-hidden="true"><span>${esc((name || "?").trim()[0]?.toUpperCase())}</span></div>`;
  }
  const appName = () => manifest?.short_name || manifest?.name || document.title || "this app";
  const fullName = () => manifest?.name || manifest?.short_name || document.title || "this app";

  function stepsHtml(p) {
    const iosOld = device.ios && device.iosVersion && device.iosVersion < 16.4 && !(device.safariVersion >= 26);
    let note = "";
    if (device.ios && (opts.notifications || iosOld)) note = `<p class="why">${iosOld ? "This iPhone needs an update (iOS 16.4 or newer) for notifications." : "Notifications need iOS 16.4 or newer, and work only from the home-screen app."}</p>`;
    const install = bip && !installedNow ? `<div class="row" style="margin:.4em 0 .8em"><button class="primary" data-act="prompt" type="button">Install ${esc(appName())}</button></div><p class="why" style="margin-bottom:.6em">Or use the browser menu:</p>` : "";
    const copy = p.kind === "inapp" ? `<div class="row" style="margin:.2em 0 .9em">${device.android ? `<a class="btn primary" data-act="chrome" href="${esc(chromeIntent())}">Open in Chrome</a>` : ""}<button class="ghost" data-act="copy" type="button">${G.copy}<span data-copy>Copy link</span></button></div>` : "";
    const already = p.kind === "android" && !bip ? `<p class="why" style="margin:.3em 0 .8em">Already installed? Open it from your home screen.</p>` : "";
    return `${install}<ol class="steps">${p.steps.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>${copy}${already}${note}`;
  }

  function chromeIntent() {
    return `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  function mount() {
    if (host) return;
    host = document.createElement("locker-install");
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style><div class="ui" part="ui"></div>`;
    (document.body && opts.mode !== "required" ? document.body : document.documentElement).appendChild(host);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
  }

  function setUi(html) {
    mount();
    const box = root.querySelector(".ui");
    box.setAttribute("style", accentVars());
    box.innerHTML = html;
  }

  // ---------- Required: the install page ----------
  function renderGate() {
    const name = fullName();
    const p = plan(device, appName());
    const tagline = manifest?.description ? `<p class="tag">${esc(manifest.description)}</p>` : "";
    const body = installedNow
      ? `<p class="done">Installed. Open ${esc(appName())} from your home screen.</p>`
      : stepsHtml(p);
    const why = opts.why ? `<p class="why">${esc(opts.why)}</p>` : "";
    const cont = opts.allowContinue ? `<button class="quiet" data-act="continue" type="button">Continue in browser</button>` : "";
    const pointer = !installedNow && !(bip && p.kind === "android") && p.pointer ? `<div class="pointer ${p.pointer}" aria-hidden="true">${G.arrow}</div>` : "";
    setUi(`<div class="gate" role="dialog" aria-modal="true" aria-labelledby="li-title">
      <div class="col">
        ${iconHtml(name)}
        <h1 id="li-title" tabindex="-1">${esc(name)}</h1>
        ${tagline}
        <section class="card" aria-labelledby="li-how"><h2 id="li-how">${p.kind === "inapp" ? "Open it in your browser" : "Add it to your home screen"}</h2>${body}</section>
        ${why}${cont}
      </div></div>${pointer}`);
    focusFirst("#li-title");
  }

  // ---------- Nudge: the small card, and the steps sheet ----------
  let nudgeShown = false, sheetOpen = false;
  function renderNudge() {
    if (installedNow) return hide();
    if (sheetOpen) return renderSheet();
    if (!nudgeShown) return;
    const name = appName();
    const sub = device.inApp ? "Open it in your browser to install it." : "Get it on your home screen, like any other app.";
    setUi(`<section class="nudge" role="dialog" aria-modal="false" aria-labelledby="li-n">
      ${iconHtml(name)}
      <div><p class="t" id="li-n">Install ${esc(name)}</p><p class="s">${sub}</p></div>
      <div class="row"><button class="quiet" data-act="dismiss" type="button">Not now</button><button class="primary" data-act="install" type="button">Install</button></div>
    </section>`);
  }
  function renderSheet() {
    const p = plan(device, appName());
    setUi(`<div class="scrim" data-act="close-if-scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="li-s">
      <header>${iconHtml(appName())}<h2 id="li-s" tabindex="-1">${p.kind === "inapp" ? "Open it in your browser" : `Install ${esc(appName())}`}</h2>
      <button class="x" data-act="close" type="button" aria-label="Close">${G.close}</button></header>
      ${stepsHtml(p)}
    </div></div>${p.pointer ? `<div class="pointer ${p.pointer}" aria-hidden="true">${G.arrow}</div>` : ""}`);
    focusFirst("#li-s");
  }

  function focusFirst(sel) {
    requestAnimationFrame(() => root?.querySelector(sel)?.focus({ preventScroll: true }));
  }

  // ---------- Buttons and keys ----------
  async function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "close-if-scrim" && e.target !== el) return;
    if (act === "prompt" || (act === "install" && bip)) {
      await promptNow();
    } else if (act === "install") {
      sheetOpen = true;
      renderSheet();
    } else if (act === "dismiss") {
      store(localStorage, "dismissed", Date.now());
      hide();
    } else if (act === "close" || act === "close-if-scrim") {
      sheetOpen = false;
      renderNudge();
      requestAnimationFrame(() => root.querySelector('[data-act="install"]')?.focus());
    } else if (act === "continue") {
      store(sessionStorage, "skip", 1);
      unlock();
    } else if (act === "copy") {
      const label = el.querySelector("[data-copy]");
      const ok = await navigator.clipboard?.writeText(location.href).then(() => true, () => false);
      if (!ok) window.prompt("Copy this link:", location.href); // older in-app browsers block the clipboard
      if (label) label.textContent = ok ? "Copied" : "Copy link";
    }
  }
  // Shows Chrome's real install sheet. The saved event works only once.
  async function promptNow() {
    const ev = bip;
    if (!ev) return;
    bip = null;
    ev.prompt();
    const choice = await ev.userChoice.catch(() => ({}));
    if (choice?.outcome === "accepted") installedNow = true;
    render();
  }

  function onKey(e) {
    if (e.key === "Escape" && sheetOpen) {
      sheetOpen = false;
      renderNudge();
      requestAnimationFrame(() => root.querySelector('[data-act="install"]')?.focus());
      return;
    }
    if (e.key !== "Tab") return;
    // Keep keyboard focus inside the install page or the open sheet.
    const trap = root.querySelector(".gate, .sheet");
    if (!trap) return;
    const items = [...trap.querySelectorAll("button, a[href], [tabindex]")].filter((x) => !x.disabled);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = root.activeElement;
    if (e.shiftKey && (active === first || !trap.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- Locking and unlocking the app (required mode) ----------
  const HIDE_ID = "locker-install-hide";
  function lock() {
    document.documentElement.setAttribute("data-locker-install", "gate");
    if (!document.getElementById(HIDE_ID)) {
      const s = document.createElement("style");
      s.id = HIDE_ID;
      s.textContent = 'html[data-locker-install="gate"] > body { display: none !important; } html[data-locker-install="gate"] { overflow: hidden; }';
      (document.head || document.documentElement).appendChild(s);
    }
  }
  function unlock() {
    document.documentElement.removeAttribute("data-locker-install");
    hide();
  }
  function hide() {
    host?.remove();
    host = root = null;
    nudgeShown = sheetOpen = false;
  }

  function render() {
    if (!device || opts.mode === "off") return;
    if (opts.mode === "required" && document.documentElement.getAttribute("data-locker-install") === "gate") return renderGate();
    if (opts.mode === "nudge") return renderNudge();
  }

  // ---------- Start ----------
  let timer;
  function init(options = {}) {
    const q = new URLSearchParams(location.search).get("install");
    if (q === "reset") ["dismissed", "visits"].forEach((k) => store(localStorage, k, null)), store(sessionStorage, "skip", null), store(sessionStorage, "counted", null);
    if (q === "skip") store(sessionStorage, "skip", 1);
    const preview = q === "preview";
    const pick = (k) => options[k] ?? env[k] ?? fromTag[k];
    opts = { mode: pick("mode") || "off", why: pick("why"), allowContinue: !!pick("allowContinue"), delay: pick("delay") ?? 30, notifications: !!pick("notifications") };
    if (!MODES.includes(opts.mode)) {
      console.warn(`[install] Unknown mode "${opts.mode}". Use off, nudge or required.`);
      opts.mode = "off";
    }
    clearTimeout(timer);
    hide();
    document.documentElement.removeAttribute("data-locker-install");
    device = detect();
    if (preview) Object.assign(device, { mobile: true, installed: false }, device.ios || device.android ? {} : { ios: true, browser: "safari", safariVersion: 18 });
    if (opts.mode === "off") return api;
    if (isDev()) whenReady(() => loadManifest().then(checkManifest));
    if (!device.mobile || device.installed || skippedPath()) return api; // laptops and installed apps: nothing, ever
    if (opts.mode === "required" && !store(sessionStorage, "skip")) {
      lock(); // hide the app now, before it paints
      renderGate();
      whenReady(async () => {
        manifest = await loadManifest();
        render();
      });
      return api;
    }
    if (opts.mode === "nudge" || opts.mode === "required") {
      if (opts.mode === "required") opts.mode = "nudge"; // "Continue in browser" or ?install=skip: still offer it, quietly
      const dismissed = Number(store(localStorage, "dismissed") || 0);
      if (!preview && Date.now() - dismissed < 7 * DAY) return api;
      if (!store(sessionStorage, "counted")) {
        store(sessionStorage, "counted", 1);
        store(localStorage, "visits", Number(store(localStorage, "visits") || 0) + 1);
      }
      const visits = Number(store(localStorage, "visits") || 1);
      // Never on first paint: on a 2nd visit after a short beat, otherwise after `delay` seconds.
      const wait = preview ? 600 : visits >= 2 ? 4000 : opts.delay * 1000;
      whenReady(async () => {
        manifest = await loadManifest();
        timer = setTimeout(() => {
          nudgeShown = true;
          render();
        }, wait);
      });
    }
    return api;
  }

  function whenReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  const api = {
    init,
    /** Opens the install steps now (e.g. from your own "Install" button). Does nothing on a laptop or once installed. */
    show() {
      if (!device?.mobile || device.installed) return false;
      if (bip) return promptNow(), true;
      nudgeShown = sheetOpen = true;
      loadManifest().then((m) => { manifest = m; renderSheet(); });
      return true;
    },
    /** What the script sees: { mobile, ios, android, inApp, browser, installed, canPrompt, mode }. */
    state: () => ({ ...(device || detect()), canPrompt: !!bip, mode: opts.mode }),
    detect,
  };
  window.LockerInstall = api;
  if (!script?.hasAttribute("data-manual")) init();
})();

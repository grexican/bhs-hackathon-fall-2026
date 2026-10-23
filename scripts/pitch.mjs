#!/usr/bin/env node
// Builds a Demo Day deck from apps/<codename>/docs/pitch.json: the agent writes the words and
// picks the moments, this script takes the pictures and renders the slides.
//
//   npm run pitch -- shots <codename> [--url http://localhost:4817]   screenshots from the running app
//   npm run pitch -- build <codename> [--publish]                       apps/<codename>/pitch/index.html
//   npm run pitch -- look <codename>                                    a picture of every slide (pitch/look/)
//   npm run pitch -- check <codename>                                   just the checks
//
// The deck is ONE file (pictures, styles and the presenter inlined): it opens with a
// double-click, works with no Wi-Fi, and --publish also copies it to public/pitch.html so
// it ships with the app. Slide kinds and the pitch.json shape: .claude/skills/pitch/SKILL.md.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const KINDS = {
  title: ["title"],
  big: ["big"],
  shot: ["title", "shots"],
  demo: ["title"],
  quote: ["quote", "who"],
  numbers: ["items", "source"],
  changes: ["rounds"],
  compare: ["before", "after"],
  ask: ["title", "ask"],
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// **word** turns the accent color on. Everything else is plain text.
export const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<mark>$1</mark>");

function appPaths(codename) {
  const dir = path.join(ROOT, "apps", codename);
  return {
    dir,
    spec: path.join(dir, "docs", "pitch.json"),
    out: path.join(dir, "pitch"),
    shots: path.join(dir, "pitch", "shots"),
    manifest: path.join(dir, "pitch", "shots", "shots.json"),
  };
}

function readSpec(p) {
  if (!fs.existsSync(p.spec)) throw new Error(`No ${path.relative(ROOT, p.spec)} yet. /pitch writes it.`);
  try {
    return JSON.parse(fs.readFileSync(p.spec, "utf8"));
  } catch (err) {
    throw new Error(`${path.relative(ROOT, p.spec)} is not valid JSON: ${err.message}`);
  }
}

function appUrl(spec, dir) {
  if (spec.url) return spec.url;
  const env = path.join(dir, ".env");
  if (!fs.existsSync(env)) return "";
  const m = fs.readFileSync(env, "utf8").match(/^APP_URL=(.+)$/m);
  return m ? m[1].trim() : "";
}

// Problems that make the deck wrong (errors) or weaker (warnings). Same list for check and build.
export function checkSpec(spec, manifest = {}) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(spec.slides) || !spec.slides.length) errors.push("`slides` is empty.");
  const shotIds = new Set((spec.shots ?? []).map((s) => s.id));
  (spec.slides ?? []).forEach((s, i) => {
    const at = `slide ${i + 1} (${s.kind ?? "no kind"})`;
    if (!KINDS[s.kind]) return errors.push(`${at}: unknown kind. Use one of: ${Object.keys(KINDS).join(", ")}.`);
    for (const f of KINDS[s.kind]) if (s[f] === undefined || s[f] === "" || (Array.isArray(s[f]) && !s[f].length)) errors.push(`${at}: needs \`${f}\`.`);
    if (!s.say) warnings.push(`${at}: no \`say\`. Write what you'll say, so the notes and the timing are real.`);
    for (const id of [...(s.shots ?? []), ...(s.backup ?? [])]) {
      if (!shotIds.has(id)) errors.push(`${at}: shot "${id}" is not in \`shots\`.`);
      else if (!manifest[id]) warnings.push(`${at}: shot "${id}" not taken yet. Run: npm run pitch -- shots <codename>`);
    }
    if (s.kind === "shot" && (s.shots?.length ?? 0) > 3) errors.push(`${at}: 3 screenshots at most. One is usually best.`);
  });
  const kinds = (spec.slides ?? []).map((s) => s.kind);
  if (!kinds.includes("demo")) warnings.push("No `demo` slide. The live demo is the moment people remember.");
  if (!kinds.includes("ask")) warnings.push("No `ask` slide. End with what you want from this room, and the link.");
  const minutes = Number(spec.minutes ?? 2);
  if (kinds.length > minutes * 3 + 2) warnings.push(`${kinds.length} slides for ${minutes} min is a lot. Cut slides, not the demo.`);
  for (const sh of spec.shots ?? []) if (!sh.goal) warnings.push(`shot "${sh.id}": no \`goal\`. Say what the picture must prove.`);
  return { errors, warnings };
}

// ---------- shots ----------

async function runStep(page, step, base) {
  if (step.goto) await page.goto(new URL(step.goto, base).href, { waitUntil: "networkidle", timeout: 30000 });
  else if (step.click) await page.locator(step.click).first().click({ timeout: 10000 });
  else if (step.fill) await page.locator(step.fill[0]).first().fill(step.fill[1], { timeout: 10000 });
  else if (step.press) await page.keyboard.press(step.press);
  else if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ timeout: 30000 });
  else if (step.wait) await page.waitForTimeout(step.wait);
  else if (step.scroll) await page.mouse.wheel(0, step.scroll);
}

async function shots(codename, args) {
  const p = appPaths(codename);
  const spec = readSpec(p);
  const list = spec.shots ?? [];
  if (!list.length) return console.log("No `shots` in pitch.json. Add one per moment you want on a slide.");
  const i = args.indexOf("--url");
  const base = i >= 0 ? args[i + 1] : spec.local || appUrl(spec, p.dir);
  if (!base) throw new Error("Where is the app? Start it and pass --url http://localhost:<port>, or set `local` in pitch.json.");

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is missing. Run `npm run setup` once.");
  }
  fs.mkdirSync(p.shots, { recursive: true });
  const browser = await chromium.launch();
  const manifest = {};
  const missing = [];
  const notes = [];
  for (const sh of list) {
    const phone = (sh.device ?? "phone") !== "desktop";
    const context = await browser.newContext(
      phone
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    );
    const page = await context.newPage();
    page.on("pageerror", (err) => notes.push(`${sh.id}: page error: ${err.message}`));
    try {
      await page.goto(new URL(sh.path ?? "/", base).href, { waitUntil: "networkidle", timeout: 30000 });
      for (const step of sh.steps ?? []) await runStep(page, step, base);
      // `expect` is the proof that the picture shows the right screen, not just *a* screen.
      if (sh.expect) await page.getByText(sh.expect, { exact: false }).first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(sh.settle ?? 600);
      const file = path.join(p.shots, `${sh.id}.jpg`);
      const buf = await page.screenshot({ path: file, type: "jpeg", quality: 86 });
      manifest[sh.id] = { file: `${sh.id}.jpg`, device: phone ? "phone" : "desktop", url: page.url(), sha1: crypto.createHash("sha1").update(buf).digest("hex"), goal: sh.goal ?? "" };
      console.log(`✓ ${sh.id}  ${path.relative(ROOT, file)}`);
    } catch (err) {
      missing.push(`${sh.id}: ${err.message.split("\n")[0]}`);
      console.log(`✗ ${sh.id}  ${err.message.split("\n")[0]}`);
    }
    await context.close();
  }
  await browser.close();

  const seen = {};
  for (const [id, m] of Object.entries(manifest)) {
    if (seen[m.sha1]) missing.push(`${id} is the same picture as ${seen[m.sha1]}. A step didn't do what you meant.`);
    seen[m.sha1] = id;
  }
  fs.writeFileSync(p.manifest, JSON.stringify(manifest, null, 2) + "\n");
  for (const n of [...new Set(notes)]) console.log(`  note: ${n}`);
  if (missing.length) {
    console.log(`\n${missing.length} shot(s) need a look:`);
    for (const m of missing) console.log(`  ${m}`);
    process.exitCode = 1;
  }
  console.log("\nNow LOOK at each picture: does it prove its goal? Then: npm run pitch -- build " + codename);
}

// ---------- build ----------

function brandVars(dir) {
  const file = path.join(dir, "brand", "tokens.css");
  if (!fs.existsSync(file)) return { imports: "", vars: {} };
  const css = fs.readFileSync(file, "utf8");
  const get = (name) => (css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`)) || [])[1]?.trim();
  const vars = {
    bg: get("color-bg"), ink: get("color-ink"), accent: get("color-accent"), muted: get("color-muted"),
    display: get("font-display") || get("font-heading"), body: get("font-body"),
  };
  const imports = (css.match(/@import[^;]+;/g) ?? []).join("\n");
  return { imports, vars };
}

// Dark text on a light accent, light text on a dark one.
export function inkFor(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? "#15130b" : "#ffffff";
}

function themeCss(spec, dir) {
  const { imports, vars } = brandVars(dir);
  const t = { ...vars, ...(spec.theme ?? {}) };
  const map = { bg: "--bg", panel: "--panel", ink: "--ink", muted: "--muted", accent: "--accent", accentInk: "--accent-ink" };
  const lines = Object.entries(map).filter(([k]) => t[k]).map(([k, v]) => `${v}: ${t[k]};`);
  if (t.accent && !t.accentInk && inkFor(t.accent)) lines.push(`--accent-ink: ${inkFor(t.accent)};`);
  if (t.display) lines.push(`--display: ${t.display}, ui-sans-serif, system-ui, sans-serif;`);
  if (t.body) lines.push(`--body: ${t.body}, ui-sans-serif, system-ui, sans-serif;`);
  return `${imports}\n:root { ${lines.join(" ")} }`;
}

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml", webp: "image/webp" }[ext] ?? "application/octet-stream";
  return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
}

function qrSvg(url, outDir) {
  if (!/^https?:\/\/[^\s"'`$\\]+$/.test(url ?? "")) return "";
  const cache = path.join(outDir, "qr.svg");
  const stamp = `<!-- ${url} -->`;
  if (fs.existsSync(cache) && fs.readFileSync(cache, "utf8").startsWith(stamp)) return fs.readFileSync(cache, "utf8");
  const tmp = path.join(outDir, "qr-tmp.svg");
  // One command string: Windows needs a shell to run npx, and the url was checked above.
  const r = spawnSync(`npx -y qrcode -o "${tmp}" -t svg "${url}"`, { shell: true, stdio: "ignore", timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    console.log("  note: couldn't make the QR code (offline?). The link still shows on the last slide.");
    return "";
  }
  const svg = stamp + fs.readFileSync(tmp, "utf8").replace(/<\?xml[^>]*>/, "");
  fs.rmSync(tmp);
  fs.writeFileSync(cache, svg);
  return svg;
}

function shotHtml(id, ctx) {
  const m = ctx.manifest[id];
  const file = m && path.join(ctx.p.shots, m.file);
  if (!m || !fs.existsSync(file)) return `<div class="phone"><div style="display:grid;place-items:center;height:100%;color:var(--muted);font:20px var(--mono)">missing: ${esc(id)}</div></div>`;
  const src = dataUri(file);
  const alt = esc(ctx.goals[id] || id);
  if (m.device === "desktop") {
    const host = (() => { try { return new URL(ctx.url || m.url).host; } catch { return ""; } })();
    return `<div class="browser"><div class="bar"><i></i><i></i><i></i><span>${esc(host)}</span></div><img src="${src}" alt="${alt}"></div>`;
  }
  return `<div class="phone"><img src="${src}" alt="${alt}"></div>`;
}

const eyebrow = (s) => (s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : "");
const list = (items) => (items ?? []).map((x) => `<li>${rich(x)}</li>`).join("");

export function slideHtml(s, ctx) {
  switch (s.kind) {
    case "title":
      return `${ctx.logo ? `<img class="logo" src="${ctx.logo}" alt="">` : ""}${eyebrow(s)}<h1>${rich(s.title)}</h1>${s.line ? `<p class="lede">${rich(s.line)}</p>` : ""}`;
    case "big":
      return `${eyebrow(s)}<h1>${rich(s.big)}</h1>${s.small ? `<p class="lede">${rich(s.small)}</p>` : ""}`;
    case "shot": {
      const n = s.shots.length;
      const shotsBlock = `<div class="shots n${n}">${s.shots.map((id) => shotHtml(id, ctx)).join("")}</div>`;
      return `<div class="copy">${eyebrow(s)}<h2>${rich(s.title)}</h2>${s.caption ? `<p class="lede">${rich(s.caption)}</p>` : ""}${s.points ? `<ul>${list(s.points)}</ul>` : ""}</div>${shotsBlock}`;
    }
    case "demo":
      return `<div class="live">LIVE DEMO</div><h2>${rich(s.title)}</h2>${s.steps ? `<ol>${list(s.steps)}</ol>` : ""}${
        ctx.url ? `<a class="go" href="${esc(ctx.url)}" target="_blank" rel="noopener" data-open-app>Open the app ↗ <small>D</small></a>` : ""
      }${s.backup?.length ? `<div class="backup">${s.backup.map((id) => (ctx.manifest[id] ? `<img src="${dataUri(path.join(ctx.p.shots, ctx.manifest[id].file))}" alt="">` : "")).join("")}</div>` : ""}`;
    case "quote":
      return `${eyebrow(s)}<blockquote>${rich(s.quote)}</blockquote><div class="who">${esc(s.who)}</div>`;
    case "numbers":
      return `${eyebrow(s)}${s.title ? `<h2>${rich(s.title)}</h2>` : ""}<div class="stats">${s.items.map((x) => `<div class="stat"><b>${esc(x.value)}</b><span>${rich(x.label)}</span></div>`).join("")}</div><div class="source">Source: ${esc(s.source)}</div>`;
    case "changes":
      return `${eyebrow(s)}<h2>${rich(s.title ?? "What testers did, what we changed")}</h2><div class="rounds"><div class="round-head"><span>${esc(s.sawLabel ?? "We watched")}</span><span>${esc(s.changedLabel ?? "So we changed")}</span></div>${s.rounds
        .map((r) => `<div class="round"><div class="saw">${rich(r.saw)}</div><div class="arrow">→</div><div class="changed">${rich(r.changed)}</div></div>`)
        .join("")}</div>`;
    case "compare":
      return `${eyebrow(s)}${s.title ? `<h2>${rich(s.title)}</h2>` : ""}<div class="compare"><div class="before"><h3>${esc(s.before.label ?? "Today")}</h3><ul>${list(s.before.items)}</ul></div><div class="after"><h3>${esc(s.after.label ?? ctx.name)}</h3><ul>${list(s.after.items)}</ul></div></div>`;
    case "ask":
      return `<div class="copy">${eyebrow(s)}<h2>${rich(s.title)}</h2><p class="lede">${rich(s.ask)}</p>${s.next ? `<p class="lede" style="color:var(--muted);font-size:32px">${rich(s.next)}</p>` : ""}</div>${
        ctx.url ? `<div class="qr">${ctx.qr ? `<div class="code">${ctx.qr}</div>` : ""}<div class="url">${esc(ctx.url.replace(/^https?:\/\//, ""))}</div></div>` : ""
      }`;
    default:
      return "";
  }
}

const notesHtml = (s) => (s.say ? `<div class="notes">${esc(s.say).replace(/\n/g, "<br>")}</div>` : "");

export function renderDeck(spec, ctx) {
  const css = fs.readFileSync(path.join(ROOT, "kit", "pitch", "deck.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "kit", "pitch", "deck.js"), "utf8");
  const slides = spec.slides
    .map((s, i) => {
      const wide = s.kind === "shot" && s.shots.length === 1 && ctx.manifest[s.shots[0]]?.device === "desktop" ? " wide" : "";
      const title = s.title || s.big || s.quote || s.kind;
      return `<section class="slide k-${s.kind}${wide}" data-n="${i}" data-title="${esc(String(title).replace(/\*\*/g, "").slice(0, 70))}">${slideHtml(s, ctx)}${notesHtml(s)}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${esc(spec.lang ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.name)}: pitch</title>
<style>${css}
${ctx.theme}</style>
</head>
<body class="boot" data-app-url="${esc(ctx.url)}">
<main class="stage">
${slides}
</main>
<div class="progress"><i></i></div>
<div class="count"></div>
<div class="hint">→ next · F full screen · P presenter · N notes · D open the app</div>
<aside class="notes-overlay"><div class="label">Notes</div><div class="body"></div></aside>
<div class="presenter-view"><div class="top"><span class="where"></span><span class="clock">0:00</span></div><div class="pnotes"></div><div class="pnext"></div><div class="buttons"><button class="pprev">← Back</button><button class="pgo">Next →</button><button class="papp">Open the app (D)</button></div></div>
<script>${js}</script>
</body>
</html>
`;
}

function readManifest(p) {
  return fs.existsSync(p.manifest) ? JSON.parse(fs.readFileSync(p.manifest, "utf8")) : {};
}

function report({ errors, warnings }) {
  for (const e of errors) console.log(`✗ ${e}`);
  for (const w of warnings) console.log(`– ${w}`);
  if (!errors.length && !warnings.length) console.log("✓ pitch.json looks good");
}

function findLogo(dir, spec) {
  const candidates = [spec.logo && path.join(dir, spec.logo), path.join(dir, "brand", "logo.png"), path.join(dir, "brand", "logo.svg"), path.join(dir, "brand", "logo-1.png"), path.join(dir, "public", "icon.svg"), path.join(dir, "public", "icon-512.png")];
  const hit = candidates.find((f) => f && fs.existsSync(f));
  return hit ? dataUri(hit) : "";
}

function build(codename, args) {
  const p = appPaths(codename);
  const spec = readSpec(p);
  const manifest = readManifest(p);
  const result = checkSpec(spec, manifest);
  report(result);
  if (result.errors.length) {
    process.exitCode = 1;
    return console.log("\nFix the ✗ lines in docs/pitch.json, then build again.");
  }
  fs.mkdirSync(p.out, { recursive: true });
  const url = appUrl(spec, p.dir);
  const ctx = {
    p, manifest, url,
    name: spec.name ?? codename,
    goals: Object.fromEntries((spec.shots ?? []).map((s) => [s.id, s.goal])),
    theme: themeCss(spec, p.dir),
    logo: spec.logo === false ? "" : findLogo(p.dir, spec),
    qr: spec.slides.some((s) => s.kind === "ask") ? qrSvg(url, p.out) : "",
  };
  const html = renderDeck(spec, ctx);
  const file = path.join(p.out, "index.html");
  fs.writeFileSync(file, html);
  console.log(`\n✓ ${path.relative(ROOT, file)}  (${spec.slides.length} slides, ${Math.round(html.length / 1024)} KB)`);
  if (args.includes("--publish")) {
    const pub = path.join(p.dir, "public");
    if (!fs.existsSync(pub)) console.log("  no public/ folder in this app: share the file instead.");
    else {
      fs.writeFileSync(path.join(pub, "pitch.html"), html);
      console.log(`✓ copied to public/pitch.html: after /ship it lives at ${url ? url.replace(/\/$/, "") : "<your app>"}/pitch.html`);
    }
  }
  console.log(`See every slide: npm run pitch -- look ${codename}. Present: double-click the file. Keys: → next · F full screen · P presenter window · N notes · D open the app.`);
}

// A picture of every slide, so the agent can SEE the deck the way the room will.
async function look(codename) {
  const p = appPaths(codename);
  const deck = path.join(p.out, "index.html");
  if (!fs.existsSync(deck)) throw new Error(`Build it first: npm run pitch -- build ${codename}`);
  const { chromium } = await import("playwright");
  const dir = path.join(p.out, "look");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(pathToFileURL(deck).href);
  const total = await page.locator(".slide").count();
  for (let i = 0; i < total; i++) {
    // Jump without the slide-in motion, so every picture is the settled slide.
    await page.evaluate((n) => { document.body.classList.add("boot"); location.hash = `#${n}`; }, i + 1);
    await page.waitForTimeout(150);
    const file = path.join(dir, `${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    console.log(`saved ${path.relative(ROOT, file)}`);
  }
  await browser.close();
  for (const e of errors) console.log(`✗ deck error: ${e}`);
  if (errors.length) process.exitCode = 1;
}

async function main() {
  const [cmd, codename, ...rest] = process.argv.slice(2);
  if (!["shots", "build", "look", "check"].includes(cmd) || !codename) {
    console.error("Usage: npm run pitch -- <shots|build|look|check> <codename> [--url <app url>] [--publish]");
    process.exit(2);
  }
  if (!fs.existsSync(path.join(ROOT, "apps", codename))) throw new Error(`No app called "${codename}" in apps/.`);
  if (cmd === "shots") await shots(codename, rest);
  else if (cmd === "build") build(codename, rest);
  else if (cmd === "look") await look(codename);
  else {
    const p = appPaths(codename);
    const result = checkSpec(readSpec(p), readManifest(p));
    report(result);
    if (result.errors.length) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}

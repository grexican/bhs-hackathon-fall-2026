#!/usr/bin/env node
// Side-by-side demo builds: one idea, two builders, two worktrees, two random ports.
//
//   npm run demo:new -- "a flashcard app for Spanish verbs" [--name Ana]
//   npm run demo:list
//   npm run demo:status -- <slug>
//   npm run demo:up -- <slug>          start both dev servers
//   npm run demo:reveal -- [slug]      start servers + open the comparison page
//   npm run demo:down -- <slug|--all>  stop servers
//   npm run demo:clean -- <slug|--all> stop servers, remove worktrees + branches
//
// Layout: builds/<slug>/{demo.json, brief.md, bare/, full/, logs/}
// bare/ and full/ are git worktrees on empty (orphan) branches demo/<slug>-bare and
// demo/<slug>-full, so every build starts from nothing and can be kept or thrown away.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort, isListening } from "./port.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILDS = path.join(ROOT, "builds");
const REVEAL_STATE = path.join(BUILDS, ".reveal.json");
const SIDES = ["bare", "full"];
const IS_WIN = process.platform === "win32";

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    flags[key] = next && !next.startsWith("--") ? rest[++i] : true;
  } else positional.push(rest[i]);
}

const git = (args, cwd = ROOT) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const demoDir = (slug) => path.join(BUILDS, slug);
const demoFile = (slug) => path.join(demoDir(slug), "demo.json");

function readDemo(slug) {
  if (!slug) die("Which demo? Run `npm run demo:list` to see slugs.");
  if (!fs.existsSync(demoFile(slug))) die(`No demo named "${slug}". Run \`npm run demo:list\`.`);
  return JSON.parse(fs.readFileSync(demoFile(slug), "utf8"));
}

function writeDemo(demo) {
  fs.writeFileSync(demoFile(demo.slug), `${JSON.stringify(demo, null, 2)}\n`);
}

function allDemos() {
  if (!fs.existsSync(BUILDS)) return [];
  return fs
    .readdirSync(BUILDS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(demoFile(d.name)))
    .map((d) => readDemo(d.name))
    .sort((a, b) => b.created.localeCompare(a.created));
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function slugify(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["a", "an", "the", "for", "of", "and", "to", "that", "with", "app", "me", "make", "build"].includes(w))
    .slice(0, 4);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${words.join("-") || "idea"}-${suffix}`;
}

// A side is "done" when its builder has written DEMO.md in its worktree.
function sideState(demo, side) {
  const dir = path.join(demoDir(demo.slug), side);
  const marker = path.join(dir, "DEMO.md");
  return {
    done: fs.existsSync(marker),
    hasPackage: fs.existsSync(path.join(dir, "package.json")),
    files: fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== ".git").length : 0,
  };
}

async function cmdNew() {
  const idea = positional.join(" ").trim();
  if (!idea) die('Give the idea in quotes: npm run demo:new -- "a game where…"');
  fs.mkdirSync(BUILDS, { recursive: true });
  const slug = slugify(idea);
  const dir = demoDir(slug);
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });

  const taken = new Set(allDemos().flatMap((d) => SIDES.map((s) => d[s].port)));
  const demo = { slug, idea, student: flags.name || null, created: new Date().toISOString() };
  for (const side of SIDES) {
    const branch = `demo/${slug}-${side}`;
    const wt = path.join(dir, side);
    git(["worktree", "add", "--orphan", "-b", branch, wt]);
    const port = await freePort(taken);
    taken.add(port);
    demo[side] = { branch, path: path.relative(ROOT, wt).replaceAll("\\", "/"), port, url: `http://localhost:${port}` };
  }
  writeDemo(demo);
  fs.writeFileSync(
    path.join(dir, "brief.md"),
    `# ${idea}\n\nStudent: ${demo.student ?? "(first name)"}\n\n## The one-line idea\n\n${idea}\n\n## Interview\n\n<!-- Q/A pairs go here as they are answered -->\n`,
  );
  console.log(JSON.stringify(demo, null, 2));
}

function cmdList() {
  const demos = allDemos();
  if (!demos.length) return console.log("No demos yet. Start one with /demo.");
  for (const d of demos) {
    const s = SIDES.map((side) => `${side}:${sideState(d, side).done ? "done" : "building"}@${d[side].port}`).join("  ");
    console.log(`${d.slug.padEnd(36)} ${s}   "${d.idea.slice(0, 50)}"`);
  }
}

async function cmdStatus() {
  const demo = readDemo(positional[0]);
  const out = { slug: demo.slug, idea: demo.idea };
  for (const side of SIDES) {
    out[side] = { ...demo[side], ...sideState(demo, side), running: await isListening(demo[side].port) };
  }
  console.log(JSON.stringify(out, null, 2));
}

function logStream(slug, name) {
  return fs.openSync(path.join(demoDir(slug), "logs", `${name}.log`), "a");
}

// npm is a .cmd shim on Windows and needs a shell; node itself must not go through one,
// because its install path usually contains a space.
function spawnDetached(command, args, { cwd, env, log }) {
  const viaShell = IS_WIN && command === "npm";
  const child = spawn(viaShell ? [command, ...args].join(" ") : command, viaShell ? [] : args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    shell: viaShell,
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  return child.pid;
}

async function waitFor(port, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    if (await isListening(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Picks how to run a build: its own dev script, its start script, or a plain static server.
function runPlan(dir, port) {
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const script = pkg.scripts?.dev ? "dev" : pkg.scripts?.start ? "start" : null;
    if (script) return { install: !fs.existsSync(path.join(dir, "node_modules")), cmd: "npm", args: ["run", script, "--", "--port", String(port)] };
  }
  const staticRoot = ["dist", "build", "public", "."].map((d) => path.join(dir, d)).find((d) => fs.existsSync(path.join(d, "index.html")));
  if (staticRoot) return { cmd: process.execPath, args: [path.join(ROOT, "scripts", "demo.mjs"), "serve-static", staticRoot, String(port)] };
  return null;
}

async function startSide(demo, side) {
  const info = demo[side];
  if (await isListening(info.port)) return `${side}: already running on ${info.url}`;
  const dir = path.join(ROOT, info.path);
  const plan = runPlan(dir, info.port);
  if (!plan) return `${side}: nothing to run yet (no package.json dev/start script, no index.html)`;
  const log = logStream(demo.slug, side);
  if (plan.install) {
    console.log(`${side}: installing dependencies…`);
    execFileSync(IS_WIN ? "npm install --no-audit --no-fund" : "npm", IS_WIN ? [] : ["install", "--no-audit", "--no-fund"], { cwd: dir, stdio: ["ignore", log, log], shell: IS_WIN });
  }
  const pid = spawnDetached(plan.cmd, plan.args, { cwd: dir, env: { PORT: String(info.port), BROWSER: "none" }, log });
  demo[side].pid = pid;
  writeDemo(demo);
  const up = await waitFor(info.port, 60);
  return up ? `${side}: ${info.url}` : `${side}: did not answer on ${info.port} within 60s — see builds/${demo.slug}/logs/${side}.log`;
}

async function cmdUp(slug = positional[0]) {
  const demo = readDemo(slug);
  for (const side of SIDES) console.log(await startSide(demo, side));
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (IS_WIN) execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM");
  } catch {
    // already gone
  }
}

function cmdDown(target = positional[0] ?? (flags.all ? "--all" : undefined)) {
  const demos = target === "--all" || flags.all ? allDemos() : [readDemo(target)];
  for (const demo of demos) {
    for (const side of SIDES) {
      killTree(demo[side].pid);
      delete demo[side].pid;
    }
    writeDemo(demo);
    console.log(`stopped ${demo.slug}`);
  }
  if (target === "--all" || flags.all) stopReveal();
}

function cmdClean() {
  const all = flags.all || positional[0] === "--all";
  const demos = all ? allDemos() : [readDemo(positional[0])];
  cmdDown(all ? "--all" : positional[0]);
  for (const demo of demos) {
    for (const side of SIDES) {
      try {
        git(["worktree", "remove", "--force", path.join(ROOT, demo[side].path)]);
      } catch {}
      try {
        git(["branch", "-D", demo[side].branch]);
      } catch {}
    }
    fs.rmSync(demoDir(demo.slug), { recursive: true, force: true });
    console.log(`removed ${demo.slug}`);
  }
  git(["worktree", "prune"]);
}

function stopReveal() {
  if (!fs.existsSync(REVEAL_STATE)) return;
  killTree(JSON.parse(fs.readFileSync(REVEAL_STATE, "utf8")).pid);
  fs.rmSync(REVEAL_STATE, { force: true });
}

function openBrowser(url) {
  if (flags["no-open"]) return;
  if (IS_WIN) spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

async function cmdReveal() {
  const slug = positional[0];
  if (slug) await cmdUp(slug);
  let state = fs.existsSync(REVEAL_STATE) ? JSON.parse(fs.readFileSync(REVEAL_STATE, "utf8")) : null;
  if (!state || !(await isListening(state.port))) {
    const port = await freePort();
    fs.mkdirSync(BUILDS, { recursive: true });
    const log = fs.openSync(path.join(BUILDS, ".reveal.log"), "a");
    const pid = spawnDetached(process.execPath, [path.join(ROOT, "scripts", "demo.mjs"), "serve-reveal", String(port)], { cwd: ROOT, log });
    state = { port, pid };
    fs.writeFileSync(REVEAL_STATE, JSON.stringify(state));
    await waitFor(port, 10);
  }
  const url = `http://localhost:${state.port}${slug ? `/d/${slug}` : "/"}`;
  console.log(`reveal: ${url}`);
  openBrowser(url);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".glb": "model/gltf-binary" };

function serveStatic(root, port) {
  http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = path.join(root, urlPath);
      if (!file.startsWith(root)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) return res.writeHead(404).end("not found");
      res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function serveReveal(port) {
  const page = fs.readFileSync(path.join(ROOT, "scripts", "reveal.html"), "utf8");
  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/api/demos") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(allDemos().map((d) => ({ ...d, bareDone: sideState(d, "bare").done, fullDone: sideState(d, "full").done }))));
      }
      const m = url.pathname.match(/^\/api\/demo\/([\w-]+)$/);
      if (m) {
        const demo = readDemo(m[1]);
        const brief = fs.existsSync(path.join(demoDir(demo.slug), "brief.md")) ? fs.readFileSync(path.join(demoDir(demo.slug), "brief.md"), "utf8") : "";
        const body = { ...demo, brief };
        for (const side of SIDES) body[side] = { ...demo[side], ...sideState(demo, side), running: await isListening(demo[side].port) };
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(body));
      }
      const start = url.pathname.match(/^\/api\/up\/([\w-]+)$/);
      if (start && req.method === "POST") {
        const demo = readDemo(start[1]);
        const results = [];
        for (const side of SIDES) results.push(await startSide(demo, side));
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(results));
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page.replace("__TITLE__", esc("Two builds, one idea")));
    })
    .listen(port);
}

const commands = {
  new: cmdNew,
  list: cmdList,
  status: cmdStatus,
  up: () => cmdUp(),
  down: () => cmdDown(),
  clean: cmdClean,
  reveal: cmdReveal,
  "serve-static": () => serveStatic(path.resolve(positional[0]), Number(positional[1])),
  "serve-reveal": () => serveReveal(Number(positional[0])),
};

if (!commands[cmd]) {
  console.log("Usage: node scripts/demo.mjs <new|list|status|up|reveal|down|clean> …");
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();

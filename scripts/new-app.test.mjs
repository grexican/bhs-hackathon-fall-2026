// Tests scripts/new-app.mjs and the starter app it copies (kit/app-template): the files, the first
// commit, and that the app really runs: /health, the SQLite example surviving a restart, files from public/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OTEL_PACKAGES } from "./locker.mjs";
import { freePort } from "./port.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "new-app.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "new-app-kit-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const newApp = (...args) =>
  execFileSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, LOCKER_KIT_ROOT: root }, encoding: "utf8" });

/** Starts the app's production command (node server.js) and waits until /health answers. */
async function boot(dir, env) {
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.js"], { cwd: dir, env: { ...process.env, ...env }, stdio: "pipe" });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const base = `http://127.0.0.1:${env.PORT}`;
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(`${base}/health`).then((r) => r.ok, () => false);
    if (ok) return { base, stop: () => new Promise((r) => { child.once("exit", r); child.kill(); }) };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`the starter app didn't start:\n${out}`);
}

test("new-app copies the starter app, fills in the name, and commits it (without .env)", () => {
  const out = newApp("lunch-line", "--name", 'Lunch & "Line"');
  assert.match(out, /npm run dev/);
  const dir = path.join(root, "apps", "lunch-line");
  for (const f of ["server.js", "db.js", "package.json", "public/index.html", "public/app.js", "public/style.css", "locker/otel.mjs", "locker/vault.mjs", "locker/gate.mjs", "AGENTS.md", "docs/idea.md"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} exists`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  assert.equal(pkg.name, "lunch-line");
  assert.equal(pkg.description, 'Lunch & "Line"');
  assert.equal(pkg.scripts.start, "node server.js");
  assert.match(pkg.scripts.dev, /--import \.\/locker\/otel\.mjs/);
  // The request-logging packages are there from day one, so the first deploy doesn't change package.json.
  assert.deepEqual(pkg.dependencies, OTEL_PACKAGES);
  assert.doesNotMatch(out, /made from the codename/, "no name hint when --name was given");
  assert.match(newApp("name-hint"), /The app is called "Name Hint" \(made from the codename\)[\s\S]*--name/);
  assert.match(fs.readFileSync(path.join(dir, "public/index.html"), "utf8"), /<title>Lunch &amp; &quot;Line&quot;<\/title>/);
  for (const f of ["server.js", "package.json", "public/index.html"]) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), "utf8"), /\{\{/);
  assert.match(fs.readFileSync(path.join(dir, ".env"), "utf8"), /^PORT=\d{4}$/m);
  const tracked = execFileSync("git", ["ls-files"], { cwd: dir, encoding: "utf8" });
  assert.match(tracked, /server\.js/);
  assert.doesNotMatch(tracked, /^\.env$/m, ".env is never committed");
});

test("the starter app runs: /health, saved data survives a restart, public files, no peeking outside", async () => {
  const dir = path.join(root, "apps", "lunch-line");
  const env = { PORT: String(await freePort()), DATABASE_PATH: path.join(root, "volume", "app.db") };
  let app = await boot(dir, env);
  assert.equal(await (await fetch(`${app.base}/health`)).text(), "ok");
  assert.deepEqual(await (await fetch(`${app.base}/api/taps`)).json(), { count: 0 });
  const saved = await fetch(`${app.base}/api/taps`, { method: "POST" });
  assert.equal(saved.status, 201);
  assert.deepEqual(await saved.json(), { count: 1 });
  await app.stop();

  app = await boot(dir, env);
  assert.deepEqual(await (await fetch(`${app.base}/api/taps`)).json(), { count: 1 }, "the database is the file at DATABASE_PATH");
  assert.ok(fs.existsSync(env.DATABASE_PATH));
  const home = await fetch(`${app.base}/`);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /Tap me/);
  assert.equal((await fetch(`${app.base}/..%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${app.base}/api/nope`)).status, 404);
  // A route with a blank in it: "GET /api/taps/:id".
  const one = await (await fetch(`${app.base}/api/taps/1`)).json();
  assert.equal(one.id, 1);
  assert.equal((await fetch(`${app.base}/api/taps/99`)).status, 404);
  assert.equal((await fetch(`${app.base}/api/taps/1/extra`)).status, 404);
  await app.stop();
});

test("the Feedback button: simulated offline, forwarded to the hub with the app secret when connected", async () => {
  const dir = path.join(root, "apps", "lunch-line");
  const html = fs.readFileSync(path.join(dir, "public/index.html"), "utf8");
  assert.match(html, /<!-- <script src="\/locker\/feedback\.js" defer><\/script> -->/, "off by default, one line to turn on");

  // Offline: saved next to the database and printed, nothing leaves the laptop.
  const volume = path.join(root, "fb-volume");
  let app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: path.join(volume, "app.db"), LOCKER_URL: "", LOCKER_APP_SECRET: "" });
  const widget = await fetch(`${app.base}/locker/feedback.js`);
  assert.match(widget.headers.get("content-type"), /javascript/);
  assert.match(await widget.text(), /\/api\/feedback/);
  const sim = await fetch(`${app.base}/api/feedback`, { method: "POST", body: JSON.stringify({ message: "Too many taps", rating: 4 }) });
  assert.equal(sim.status, 201);
  assert.deepEqual(await sim.json(), { ok: true, simulated: true });
  assert.match(fs.readFileSync(path.join(volume, "feedback.jsonl"), "utf8"), /"message":"Too many taps","rating":4/);
  assert.equal((await fetch(`${app.base}/api/feedback`, { method: "POST", body: "{}" })).status, 400);
  await app.stop();

  // Connected: the app's server forwards it to the hub with its secret (the browser never sees it).
  const seen = [];
  const hub = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, id: "1" }));
  });
  await new Promise((r) => hub.listen(0, "127.0.0.1", r));
  app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: path.join(volume, "app.db"), LOCKER_URL: `http://127.0.0.1:${hub.address().port}`, LOCKER_APP_SECRET: "app_secret_xyz" });
  const sent = await fetch(`${app.base}/api/feedback`, { method: "POST", body: JSON.stringify({ message: "Works!", page: "/", contact: "maya" }) });
  assert.equal(sent.status, 201);
  const reply = await sent.text();
  assert.doesNotMatch(reply, /app_secret_xyz/);
  assert.deepEqual(seen, [{ url: "/api/feedback", auth: "Bearer app_secret_xyz", body: { message: "Works!", page: "/", contact: "maya" } }]);
  await app.stop();
  hub.close();
});

test("the AI example: simulated before /connect, a friendly 503 when the budget is used up", async () => {
  const dir = path.join(root, "apps", "lunch-line");
  assert.ok(fs.existsSync(path.join(dir, "locker/ai/index.ts")));
  assert.ok(!fs.existsSync(path.join(dir, "locker/ai/cli.ts")), "the CLI stays in the kit");
  assert.match(fs.readFileSync(path.join(dir, "public/index.html"), "utf8"), /<!-- <script type="module" src="\/ask\.js"><\/script> -->/);
  const db = path.join(root, "ai-volume", "app.db");

  // No key yet: a labelled simulated answer, never a crash.
  let app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: db, OPENROUTER_API_KEY: "", AI_PROVIDER: "" });
  const sim = await fetch(`${app.base}/api/ask`, { method: "POST", body: JSON.stringify({ question: "hi" }) });
  assert.equal(sim.status, 200);
  const simJson = await sim.json();
  assert.equal(simJson.simulated, true);
  assert.match(simJson.note, /Connect your app first \(\/connect\)/);
  assert.equal((await fetch(`${app.base}/api/ask`, { method: "POST", body: "{}" })).status, 400);
  await app.stop();

  // With a key whose monthly limit is reached (OpenRouter's real 403, stubbed in the app process).
  const stub = path.join(root, "stub-openrouter.mjs");
  fs.writeFileSync(stub, `const real = globalThis.fetch;
globalThis.fetch = async (url, init) => String(url).includes("openrouter.ai")
  ? new Response(JSON.stringify({ error: { message: "Key limit exceeded (monthly limit). resets 2026-11-01T00:00:00.000Z.", code: 403, metadata: { limit_source: "openrouter_key_limit" } } }), { status: 403 })
  : real(url, init);`);
  app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: db, OPENROUTER_API_KEY: "sk-or-test-not-real", NODE_OPTIONS: `--import=${pathToFileURL(stub).href}` });
  const out = await fetch(`${app.base}/api/ask`, { method: "POST", body: JSON.stringify({ question: "hi" }) });
  assert.equal(out.status, 503);
  assert.deepEqual(await out.json(), { error: "This app's AI budget for the month is used up. Ask an organizer to raise it.", code: "AI_BUDGET_USED_UP" });
  assert.equal((await fetch(`${app.base}/health`)).status, 200, "the rest of the app keeps working");
  await app.stop();
});

test("school sign-in: off by default; with LOCKER_GATE=1 it sends people to sign in and the app knows who they are", async () => {
  const dir = path.join(root, "apps", "lunch-line");
  const db = path.join(root, "gate-volume", "app.db");
  let app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: db, LOCKER_GATE: "" });
  assert.deepEqual(await (await fetch(`${app.base}/api/me`)).json(), { user: null });
  assert.equal((await fetch(`${app.base}/`)).status, 200);
  await app.stop();

  // A tiny stand-in for the hub's token endpoint.
  const hub = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ user: { sub: "u1", email: "ana@example.org", name: "Ana", domain: "example.org" } }));
  });
  await new Promise((r) => hub.listen(0, "127.0.0.1", r));
  const hubUrl = `http://127.0.0.1:${hub.address().port}`;
  app = await boot(dir, { PORT: String(await freePort()), DATABASE_PATH: db, LOCKER_GATE: "1", LOCKER_URL: hubUrl, LOCKER_APP_ID: "app_1", LOCKER_APP_SECRET: "gate_secret", APP_URL: "" });
  assert.equal((await fetch(`${app.base}/health`)).status, 200, "the host's health check never needs sign-in");
  const first = await fetch(`${app.base}/api/me`, { redirect: "manual" });
  assert.equal(first.status, 302);
  const to = new URL(first.headers.get("location"));
  assert.equal(to.origin + to.pathname, `${hubUrl}/oauth/authorize`);
  const back = await fetch(`${app.base}/_locker/callback?code=c1&state=${encodeURIComponent(to.searchParams.get("state"))}`, { redirect: "manual" });
  assert.equal(back.status, 302);
  const cookie = back.headers.get("set-cookie").split(";")[0];
  const me = await (await fetch(`${app.base}/api/me`, { headers: { cookie } })).json();
  assert.deepEqual(me, { user: { sub: "u1", email: "ana@example.org", name: "Ana", domain: "example.org" } });
  await app.stop();
  hub.close();
});

test("school sign-in on a laptop: LOCKER_GATE_USER acts signed in without the hub, and is refused on Railway", async () => {
  const dir = path.join(root, "apps", "lunch-line");
  const db = path.join(root, "gate-sim-volume", "app.db");
  const base = { DATABASE_PATH: db, LOCKER_GATE: "1", LOCKER_URL: "http://127.0.0.1:9", LOCKER_APP_ID: "app_1", LOCKER_APP_SECRET: "s", APP_URL: "" };
  let app = await boot(dir, { ...base, PORT: String(await freePort()), LOCKER_GATE_USER: "Ana Garcia <ana@example.org>" });
  const page = await fetch(`${app.base}/`, { redirect: "manual" });
  assert.equal(page.status, 200, "no trip to the hub");
  assert.deepEqual(await (await fetch(`${app.base}/api/me`)).json(), { user: { sub: "sim:ana@example.org", email: "ana@example.org", name: "Ana Garcia", domain: "example.org", simulated: true } });
  await app.stop();
  app = await boot(dir, { ...base, PORT: String(await freePort()), LOCKER_GATE_USER: "Ana <ana@example.org>", RAILWAY_ENVIRONMENT: "production" });
  const refused = await fetch(`${app.base}/api/me`);
  assert.equal(refused.status, 500);
  assert.match(await refused.text(), /only for your laptop/);
  await app.stop();
});

test("the Feedback button is small, bottom-left by default, and restyled with CSS variables", () => {
  const js = fs.readFileSync(path.join(root, "apps", "lunch-line", "locker", "feedback.js"), "utf8");
  for (const v of ["--fb-ink", "--fb-paper", "--fb-accent", "--fb-font", "--fb-left", "--fb-bottom"]) assert.ok(js.includes(`var(${v}`), v);
  assert.match(js, /left: var\(--fb-left, max\(12px, env\(safe-area-inset-left\)\)\)/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("--bare makes just the folder, for a scaffolder", () => {
  newApp("bare-app", "--bare");
  const dir = path.join(root, "apps", "bare-app");
  assert.ok(fs.existsSync(path.join(dir, "AGENTS.md")));
  assert.ok(!fs.existsSync(path.join(dir, "server.js")));
  assert.ok(!fs.existsSync(path.join(dir, ".env")));
});

test("an existing folder or a bad codename is refused", () => {
  assert.throws(() => newApp("lunch-line"), /already exists/);
  assert.throws(() => newApp("Not OK"), /won't work as a codename/);
});

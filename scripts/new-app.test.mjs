// Tests scripts/new-app.mjs and the starter app it copies (kit/app-template): the files, the first
// commit, and that the app really runs: /health, the SQLite example surviving a restart, files from public/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
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
  for (const f of ["server.js", "db.js", "package.json", "public/index.html", "public/app.js", "public/style.css", "locker/otel.mjs", "AGENTS.md", "docs/idea.md"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} exists`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  assert.equal(pkg.name, "lunch-line");
  assert.equal(pkg.description, 'Lunch & "Line"');
  assert.equal(pkg.scripts.start, "node server.js");
  assert.match(pkg.scripts.dev, /--import \.\/locker\/otel\.mjs/);
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

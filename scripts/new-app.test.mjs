// Tests scripts/new-app.mjs and the starter app it copies (kit/app-template): the files, the first
// commit, and that the app really runs: /health, the SQLite example surviving a restart, files from public/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
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

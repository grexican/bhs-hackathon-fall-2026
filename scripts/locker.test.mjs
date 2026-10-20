// End-to-end test of scripts/locker.mjs against a tiny mock of the hub (docs: the hub contract v1).
// Runs the real script as a child process in a throwaway kit folder. No network, no real Railway.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeEnv, readEnv } from "./locker.mjs";
import { RW_TOKEN, TOKEN, startMockHub } from "./locker-mock-hub.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "locker.mjs");
let mock;
let kit;
let projects;

before(async () => {
  mock = await startMockHub();
  ({ kit, projects } = mock);
});

after(() => mock.close());

function run(args, extraEnv = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: mock.env(extraEnv) }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout + stderr }));
  });
}

test("mergeEnv updates keys in place and keeps everything else", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "env-")), ".env");
  fs.writeFileSync(f, "# keep me\nA=1\nB=2\n");
  mergeEnv(f, { B: "3", C: "4" });
  assert.equal(fs.readFileSync(f, "utf8"), "# keep me\nA=1\nB=3\nC=4\n");
  assert.deepEqual(readEnv(f), { A: "1", B: "3", C: "4" });
});

test("commands explain a missing connection instead of crashing", async () => {
  const r = await run(["status"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /isn't connected/);
});

test("an unreachable hub says so plainly", async () => {
  const r = await run(["connect"], { LOCKER_URL: "http://127.0.0.1:9" });
  assert.equal(r.code, 1);
  assert.match(r.out, /Can't reach the hub/);
});

test("connect: device flow saves the token to the kit .env without printing it", async () => {
  const r = await run(["connect"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /K Q 7 - 4 P X/);
  assert.match(r.out, /Connected as Ana/);
  assert.doesNotMatch(r.out, new RegExp(TOKEN));
  const env = readEnv(path.join(kit, ".env"));
  assert.equal(env.LOCKER_TOKEN, TOKEN);
  assert.equal(env.OPENROUTER_API_KEY, "sk-or-root", "unrelated lines kept");
  assert.match(fs.readFileSync(path.join(kit, ".env"), "utf8"), /# my notes/);
});

test("project: needs the app folder first", async () => {
  const r = await run(["project", "lunch-line"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /npm run new-app -- lunch-line/);
});

test("project: creates it, waits for provisioning, writes the app .env", async () => {
  const dir = path.join(kit, "apps", "lunch-line");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ".env"), "MY_SETTING=keep\nOPENROUTER_API_KEY=old\n");
  const r = await run(["project", "lunch-line", "--name", "Lunch Line", "--pitch", "Skip the queue"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /https:\/\/lunch-line-production\.up\.railway\.app/);
  assert.match(r.out, /railway\.com\/invite\/abc/);
  assert.doesNotMatch(r.out, new RegExp(RW_TOKEN));
  assert.equal(projects.get("lunch-line").body.pitch, "Skip the queue");
  const env = readEnv(path.join(dir, ".env"));
  assert.equal(env.MY_SETTING, "keep");
  assert.equal(env.OPENROUTER_API_KEY, "or-app-key");
  assert.equal(env.RAILWAY_SERVICE_ID, "svc-123");
  assert.equal(env.DATABASE_PATH, "/data/app.db");
  assert.equal(env.APP_URL, "https://lunch-line-production.up.railway.app");
});

test("project: re-running on your own project just refreshes it", async () => {
  const r = await run(["project", "lunch-line"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /already have lunch-line/);
});

test("project: a setup that failed is retried by running the same command again", async () => {
  fs.mkdirSync(path.join(kit, "apps", "flaky-app"), { recursive: true });
  mock.flags.failProvision = true;
  const first = await run(["project", "flaky-app"]);
  mock.flags.failProvision = false;
  assert.equal(first.code, 1);
  assert.match(first.out, /Railway timed out/);
  const again = await run(["project", "flaky-app"]);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /Trying again/);
  assert.ok(projects.get("flaky-app").retried);
  assert.equal(readEnv(path.join(kit, "apps", "flaky-app", ".env")).RAILWAY_SERVICE_ID, "svc-123");
});

test("project: someone else's codename shows the hub's message", async () => {
  fs.mkdirSync(path.join(kit, "apps", "taken-app"), { recursive: true });
  const r = await run(["project", "taken-app"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /codename is taken/);
});

test("env and status read the hub", async () => {
  fs.rmSync(path.join(kit, "apps", "lunch-line", ".env"));
  const e = await run(["env", "lunch-line"]);
  assert.equal(e.code, 0, e.out);
  assert.equal(readEnv(path.join(kit, "apps", "lunch-line", ".env")).RAILWAY_TOKEN, RW_TOKEN);
  const s = await run(["status"]);
  assert.equal(s.code, 0, s.out);
  assert.match(s.out, /Connected as Ana/);
  assert.match(s.out, /Lunch Line \(lunch-line\): ready/);
});

test("deploy: runs railway up with the project token, never shows it", async () => {
  const dir = path.join(kit, "apps", "lunch-line");
  const none = await run(["deploy", "lunch-line"]);
  assert.equal(none.code, 1);
  assert.match(none.out, /nothing to run/);
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  const r = await run(["deploy", "lunch-line"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /railway up --service svc-123 --detach/);
  assert.match(r.out, /token present/);
  assert.doesNotMatch(r.out, new RegExp(RW_TOKEN));
  assert.match(r.out, /lunch-line-production\.up\.railway\.app/);
  // Request logging rides along: the file and the packages (the hub's start command loads them).
  assert.ok(fs.existsSync(path.join(dir, "locker", "otel.mjs")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).dependencies["@opentelemetry/sdk-node"], "^0.223.0");
  assert.match(r.out, /no "start" script/);
});

test("deploy: LOCKER_OTEL=0 leaves the app alone", async () => {
  const dir = path.join(kit, "apps", "otel-off");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(kit, "apps", "lunch-line", ".env"), path.join(dir, ".env"));
  mergeEnv(path.join(dir, ".env"), { LOCKER_OTEL: "0" });
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  const r = await run(["deploy", "otel-off"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(!fs.existsSync(path.join(dir, "locker", "otel.mjs")));
  assert.equal(fs.readFileSync(path.join(dir, "package.json"), "utf8"), "{}");
});

test("logs: --errors and --find become one Railway filter", async () => {
  const { logFlags } = await import("./locker.mjs");
  assert.deepEqual(logFlags({ errors: true }), ["--filter", '"@level:error"']);
  assert.deepEqual(logFlags({ build: true, find: 'POST "/order" $(x)' }), ["--build", "--filter", '"POST  /order   (x)"']);
  assert.deepEqual(logFlags({}), []);
});

test("request logging prints one line per request and per outgoing call, without query strings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "otel-"));
  fs.mkdirSync(path.join(dir, "locker"));
  fs.copyFileSync(path.join(path.dirname(SCRIPT), "..", "kit", "locker", "otel.mjs"), path.join(dir, "locker", "otel.mjs"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  fs.writeFileSync(
    path.join(dir, "server.js"),
    `import http from "node:http";
const s = http.createServer((req, res) => { res.statusCode = req.url.startsWith("/bad") ? 500 : 200; res.end("x"); });
s.listen(0, async () => {
  const base = "http://127.0.0.1:" + s.address().port;
  for (const p of ["/ok?token=secret", "/bad", "/health"]) await fetch(base + p).then((r) => r.text());
  setTimeout(() => process.exit(0), 100);
});`,
  );
  const out = await new Promise((resolve) =>
    execFile(process.execPath, ["server.js"], { cwd: dir, env: { ...process.env, NODE_OPTIONS: "--import=./locker/otel.mjs", npm_lifecycle_event: "" } }, (err, stdout, stderr) => resolve(stdout + stderr)),
  );
  const lines = out.trim().split("\n").map((l) => JSON.parse(l));
  assert.match(lines[0].message, /Request logging on \(built-in\)/);
  const incoming = lines.filter((l) => l.kind === "request").map((l) => `${l.level} ${l.target} ${l.status}`);
  assert.deepEqual(incoming, ["info /ok 200", "error /bad 500"], "health checks stay quiet");
  assert.equal(lines.filter((l) => l.kind === "outgoing").length, 3);
  assert.doesNotMatch(out, /secret/);
});

test('deploy: "Deploy failed" with exit 0 still counts as a failure', async () => {
  const r = await run(["deploy", "lunch-line"], { FAKE_RAILWAY_FAIL: "1" });
  assert.equal(r.code, 1);
  assert.match(r.out, /didn't go through/);
});

test("project: a codename owned by someone else points to join or a new name", async () => {
  const r = await run(["project", "taken-app"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /belongs to someone else/);
  assert.match(r.out, /locker:join -- taken-app/);
});

test("project: a teammate (not owner) is sent to join", async () => {
  fs.mkdirSync(path.join(kit, "apps", "team-app"), { recursive: true });
  const r = await run(["project", "team-app"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /teammate on team-app/);
});

test("join: a non-member is told to ask the owner", async () => {
  const r = await run(["join", "taken-app"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Ask its owner to add you/);
  assert.match(r.out, /\/p\/taken-app/);
});

test("join: a member without the code is told to /bring-my-app", async () => {
  fs.rmSync(path.join(kit, "apps", "team-app"), { recursive: true, force: true });
  const r = await run(["join", "team-app"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\/bring-my-app/);
  assert.ok(!fs.existsSync(path.join(kit, "apps", "team-app")), "no folder invented");
});

test("join: a member with the code gets the env bundle, and status shows roles", async () => {
  fs.mkdirSync(path.join(kit, "apps", "team-app"), { recursive: true });
  const r = await run(["join", "team-app"]);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, new RegExp(RW_TOKEN));
  assert.equal(readEnv(path.join(kit, "apps", "team-app", ".env")).RAILWAY_TOKEN, RW_TOKEN);
  const s = await run(["status"]);
  assert.match(s.out, /Team App \(team-app\): ready \[teammate\]/);
  assert.match(s.out, /Lunch Line \(lunch-line\): ready \[owner\]/);
});

test("project: builder-approval 403 is shown as-is plus what to do", async () => {
  mock.flags.approvalRequired = true;
  fs.mkdirSync(path.join(kit, "apps", "new-thing"), { recursive: true });
  const r = await run(["project", "new-thing"]);
  mock.flags.approvalRequired = false;
  assert.equal(r.code, 1);
  assert.match(r.out, /needs an organizer's OK/);
  assert.match(r.out, /Tell an organizer your school email\./);
});

test("set: pushes variables with the project token, updates .env, never shows the token", async () => {
  const r = await run(["set", "lunch-line", "LOCKER_GATE=1", "GREETING=hi there"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /railway variables --service svc-123 --set LOCKER_GATE=1 --set GREETING=hi there --skip-deploys/);
  assert.match(r.out, /token present/);
  assert.doesNotMatch(r.out, new RegExp(RW_TOKEN));
  assert.match(r.out, /Saved LOCKER_GATE, GREETING\. They apply on your next deploy \(npm run deploy -- lunch-line\)\./);
  const env = readEnv(path.join(kit, "apps", "lunch-line", ".env"));
  assert.equal(env.LOCKER_GATE, "1");
  assert.equal(env.GREETING, "hi there");
});

test("set: refuses settings that come from the hub", async () => {
  for (const key of ["RAILWAY_TOKEN", "OPENROUTER_API_KEY", "LOCKER_APP_SECRET", "LOCKER_APP_ID", "LOCKER_URL"]) {
    const r = await run(["set", "lunch-line", `${key}=x`]);
    assert.equal(r.code, 1);
    assert.match(r.out, /comes from the hub/);
  }
});

test("list: lists the app in the directory, explains what's missing, and can hide it", async () => {
  const missing = await run(["list", "lunch-line"]);
  assert.equal(missing.code, 1);
  assert.match(missing.out, /Add a tagline/);
  const r = await run(["list", "lunch-line", "--tagline", "See the line before you leave class", "--category", "School life", "--icon", "L", "--school-only"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /lunch-line is listed in Apps: L See the line before you leave class \(School life\)/);
  assert.equal(projects.get("lunch-line").listing.bhsOnly, true);
  const off = await run(["list", "lunch-line", "--off"]);
  assert.equal(off.code, 0, off.out);
  assert.match(off.out, /isn't listed in Apps anymore/);
  assert.equal(projects.get("lunch-line").listing.tagline, "See the line before you leave class", "fields left out are kept");
});

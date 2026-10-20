// End-to-end test of scripts/locker.mjs against a tiny mock of the hub (docs: the hub contract v1).
// Runs the real script as a child process in a throwaway kit folder. No network, no real Railway.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeEnv, readEnv } from "./locker.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "locker.mjs");
const TOKEN = "lkr_test_secret_token";
const RW_TOKEN = "rw_project_token_secret";
const projects = new Map([["taken-app", { owner: "someone-else" }]]);
let polls = 0;

const project = (codename, name) => ({
  codename,
  name,
  status: "ready",
  url: `https://${codename}-production.up.railway.app`,
  railway: { projectId: "p1", serviceId: "svc-123", environmentId: "e1", dashboardUrl: "https://railway.com/project/p1", inviteUrl: "https://railway.com/invite/abc" },
  ai: { monthlyLimitUsd: 5, usedUsd: 0.12 },
  costs: { railwayUsdThisMonth: 0.04, aiUsdThisMonth: 0.12, updatedAt: "2026-10-20T00:00:00Z" },
});

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, "http://x");

  if (req.method === "POST" && url.pathname === "/api/cli/start") {
    assert.ok(body.device, "device name sent");
    return send(200, { deviceId: "dev-1", code: "KQ7-4PX", url: "http://hub/connect?code=KQ7-4PX", interval: 0.02, expiresIn: 5 });
  }
  if (url.pathname === "/api/cli/poll") {
    polls++;
    return send(200, polls < 3 ? { status: "pending" } : { status: "approved", token: TOKEN, student: { email: "ana@bhsschools.org", name: "Ana" } });
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "Not signed in." });
  if (url.pathname === "/api/me") {
    const mine = [...projects.values()].filter((p) => p.owner === "ana").map((p) => p.project);
    return send(200, { student: { email: "ana@bhsschools.org", name: "Ana" }, projects: mine });
  }
  if (req.method === "POST" && url.pathname === "/api/projects") {
    if (!/^[a-z0-9-]{3,30}$/.test(body.codename)) return send(400, { error: "Bad codename." });
    if (projects.has(body.codename)) return send(409, { error: "That codename is taken. Pick another one." });
    // First answer is "provisioning", like the real hub while Railway spins up.
    projects.set(body.codename, { owner: "ana", project: project(body.codename, body.name), body });
    return send(201, { ...project(body.codename, body.name), status: "provisioning" });
  }
  const m = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(\/env)?$/);
  if (m) {
    const p = projects.get(m[1]);
    if (!p || p.owner !== "ana") return send(404, { error: "No such project." });
    if (!m[2]) return send(200, p.project);
    return send(200, {
      env: {
        RAILWAY_TOKEN: RW_TOKEN,
        RAILWAY_SERVICE_ID: "svc-123",
        OPENROUTER_API_KEY: "or-app-key",
        LOCKER_URL: "http://hub",
        LOCKER_APP_ID: "app_1",
        LOCKER_APP_SECRET: "app_secret",
        DATABASE_PATH: "/data/app.db",
      },
    });
  }
  send(404, { error: "Not found." });
});

let kit;
let bin;
let hub;

before(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  hub = `http://127.0.0.1:${server.address().port}`;
  kit = fs.mkdtempSync(path.join(os.tmpdir(), "locker-kit-"));
  fs.writeFileSync(path.join(kit, ".env"), "# my notes\nOPENROUTER_API_KEY=sk-or-root\n");
  // A fake `railway` that records how it was called and whether it got the token.
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "locker-bin-"));
  fs.writeFileSync(
    path.join(bin, "fake-railway.mjs"),
    `const fail = process.env.FAKE_RAILWAY_FAIL;
console.log("railway " + process.argv.slice(2).join(" "));
console.log("token " + (process.env.RAILWAY_TOKEN === "${RW_TOKEN}" ? "present" : "missing"));
if (fail) console.log("Deploy failed");`,
  );
  fs.writeFileSync(path.join(bin, "railway.cmd"), `@node "%~dp0fake-railway.mjs" %*\r\n`);
  fs.writeFileSync(path.join(bin, "railway"), `#!/bin/sh\nnode "$(dirname "$0")/fake-railway.mjs" "$@"\n`, { mode: 0o755 });
});

after(() => {
  server.close();
  fs.rmSync(kit, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

function run(args, extraEnv = {}) {
  const env = { ...process.env, LOCKER_URL: hub, LOCKER_KIT_ROOT: kit, LOCKER_NO_BROWSER: "1", LOCKER_POLL_MS: "10", PATH: `${bin}${path.delimiter}${process.env.PATH}`, ...extraEnv };
  delete env.LOCKER_TOKEN;
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout + stderr }));
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
});

test('deploy: "Deploy failed" with exit 0 still counts as a failure', async () => {
  const r = await run(["deploy", "lunch-line"], { FAKE_RAILWAY_FAIL: "1" });
  assert.equal(r.code, 1);
  assert.match(r.out, /didn't go through/);
});

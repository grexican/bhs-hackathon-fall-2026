// The sign-in gate (kit/locker/gate.mjs) with pretend requests: full, lazy and off.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { currentUser, gate, requireUser, signInUrl } from "../kit/locker/gate.mjs";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HUB = "https://locker.test";
const KEYS = ["LOCKER_GATE", "LOCKER_GATE_USER", "LOCKER_URL", "LOCKER_APP_ID", "LOCKER_APP_SECRET", "APP_URL", "RAILWAY_PUBLIC_DOMAIN", "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME"];

function setEnv(values) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, { LOCKER_URL: HUB, LOCKER_APP_ID: "app_1", LOCKER_APP_SECRET: "s3cret" }, values);
}
const req = (url, { method = "GET", headers = {} } = {}) => ({ url, method, headers: { host: "app.local", ...headers } });
function res() {
  return {
    statusCode: 200, headers: {}, body: undefined, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; this.ended = true; },
  };
}

// Signs in through a stand-in for the hub's token endpoint; returns the gate cookie.
async function signIn(user = { sub: "u1", email: "ana@bhsschools.org", name: "Ana", domain: "bhsschools.org" }) {
  const r1 = res();
  await gate(req(signInUrl("/my/list")), r1);
  const to = new URL(r1.headers.location);
  assert.equal(to.origin + to.pathname, `${HUB}/oauth/authorize`);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ user }), { status: 200 });
  try {
    const r2 = res();
    await gate(req(`/_locker/callback?code=c1&state=${encodeURIComponent(to.searchParams.get("state"))}`), r2);
    assert.equal(r2.headers.location, "/my/list", "back to the page they asked for");
    return r2.headers["set-cookie"].split(";")[0];
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("full (LOCKER_GATE=1): unchanged, every page sends a signed-out visitor to sign in", async () => {
  setEnv({ LOCKER_GATE: "1" });
  const r = res();
  assert.equal(await gate(req("/notes?x=1"), r), null);
  assert.equal(r.statusCode, 302);
  assert.match(r.headers.location, /^https:\/\/locker\.test\/oauth\/authorize\?client_id=app_1&redirect_uri=http%3A%2F%2Fapp\.local%2F_locker%2Fcallback&state=/);
  const icon = res();
  assert.equal(await gate(req("/favicon.ico"), icon), undefined, "icons stay public");
  assert.equal(icon.ended, false);
  const cookie = await signIn();
  assert.deepEqual(await gate(req("/notes", { headers: { cookie } }), res()), { sub: "u1", email: "ana@bhsschools.org", name: "Ana", domain: "bhsschools.org" });
  const out = res();
  await gate(req("/_locker/logout"), out);
  assert.equal(out.headers.location, "/");
  assert.match(out.headers["set-cookie"], /^bhs_gate=; Path=\/; Max-Age=0/);
});

test("full: missing hub settings answer 500 with what to do", async () => {
  setEnv({ LOCKER_GATE: "1", LOCKER_APP_ID: "" });
  const r = res();
  assert.equal(await gate(req("/"), r), null);
  assert.equal(r.statusCode, 500);
  assert.match(r.body, /LOCKER_GATE=1 but LOCKER_URL/);
});

test("lazy: public pages never redirect; the gate returns the user once signed in", async () => {
  setEnv({ LOCKER_GATE: "lazy" });
  const r = res();
  assert.equal(await gate(req("/"), r), undefined);
  assert.equal(r.ended, false, "nothing sent: the app answers");
  assert.equal(currentUser(req("/")), null);
  const cookie = await signIn();
  const user = await gate(req("/", { headers: { cookie } }), res());
  assert.equal(user.email, "ana@bhsschools.org");
  assert.deepEqual(currentUser(req("/", { headers: { cookie } })), user);
  assert.equal(currentUser(req("/", { headers: { cookie: `${cookie}x` } })), null, "a changed cookie doesn't count");
});

test("requireUser: a page (GET) goes to sign-in and comes back to the same page", async () => {
  setEnv({ LOCKER_GATE: "lazy" });
  const r = res();
  assert.equal(requireUser(req("/my/list?week=2", { headers: { "sec-fetch-mode": "navigate" } }), r), null);
  assert.equal(r.statusCode, 302);
  const state = new URL(r.headers.location).searchParams.get("state");
  const back = JSON.parse(Buffer.from(state.split(".")[0], "base64url").toString()).back;
  assert.equal(back, "/my/list?week=2");
  const cookie = await signIn();
  assert.equal(requireUser(req("/my", { headers: { cookie } }), res()).sub, "u1");
});

test("requireUser: a POST or a fetch() gets 401 JSON with a sign-in link back to the page it came from", () => {
  setEnv({ LOCKER_GATE: "lazy" });
  for (const r0 of [
    req("/api/save", { method: "POST", headers: { referer: "http://app.local/my/list?a=1" } }),
    req("/api/notes", { headers: { accept: "application/json", referer: "http://app.local/my/list?a=1" } }),
    req("/api/notes", { headers: { "sec-fetch-mode": "cors", referer: "http://app.local/my/list?a=1" } }),
  ]) {
    const r = res();
    assert.equal(requireUser(r0, r), null);
    assert.equal(r.statusCode, 401);
    assert.equal(r.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(r.body), { error: "sign_in_required", signIn: "/_locker/login?back=%2Fmy%2Flist%3Fa%3D1" });
  }
  const r = res();
  requireUser(req("/api/save", { method: "POST", headers: { referer: "https://evil.example/x" } }), r);
  assert.equal(JSON.parse(r.body).signIn, "/_locker/login?back=%2F", "another site's page is never the way back");
});

test("signInUrl and /_locker/login only go back to pages of this app", async () => {
  setEnv({ LOCKER_GATE: "lazy" });
  assert.equal(signInUrl("/my"), "/_locker/login?back=%2Fmy");
  assert.equal(signInUrl("https://evil.example"), "/_locker/login?back=%2F");
  assert.equal(signInUrl("//evil.example"), "/_locker/login?back=%2F");
  const cookie = await signIn();
  const r = res();
  await gate(req("/_locker/login?back=//evil.example", { headers: { cookie } }), r);
  assert.equal(r.headers.location, "/");
});

test("off: gate, currentUser and requireUser let everything through", async () => {
  setEnv({ LOCKER_GATE: "" });
  const r = res();
  assert.equal(await gate(req("/my"), r), undefined);
  assert.equal(currentUser(req("/my")), undefined);
  assert.equal(requireUser(req("/my", { method: "POST" }), r), undefined);
  assert.equal(r.ended, false);
});

test("laptop (LOCKER_GATE_USER): lazy can sign out of the test user and back in; refused on Railway", async () => {
  setEnv({ LOCKER_GATE: "lazy", LOCKER_GATE_USER: "Ana Garcia <ana@example.org>" });
  assert.equal((await gate(req("/"), res())).name, "Ana Garcia");
  const out = res();
  await gate(req("/_locker/logout"), out);
  const cookie = out.headers["set-cookie"].split(";")[0];
  assert.equal(await gate(req("/", { headers: { cookie } }), res()), undefined, "signed out: the public app");
  const r = res();
  assert.equal(requireUser(req("/my", { headers: { cookie } }), r), null);
  assert.equal(r.headers.location, "/_locker/login?back=%2Fmy", "no trip to the hub on the laptop");
  const back = res();
  await gate(req(r.headers.location, { headers: { cookie } }), back);
  assert.equal(back.headers.location, "/my");
  assert.match(back.headers["set-cookie"], /Max-Age=0/);

  setEnv({ LOCKER_GATE: "1", LOCKER_GATE_USER: "Ana <ana@example.org>" });
  assert.equal((await gate(req("/", { headers: { cookie } }), res())).email, "ana@example.org", "full mode ignores the signed-out cookie");

  setEnv({ LOCKER_GATE: "lazy", LOCKER_GATE_USER: "Ana <ana@example.org>", RAILWAY_ENVIRONMENT: "production" });
  const refused = res();
  assert.equal(await gate(req("/"), refused), null);
  assert.equal(refused.statusCode, 500);
  assert.equal(currentUser(req("/")), null);
});

test("static sites: LOCKER_GATE_PATHS needs sign-in only under those folders", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-static-"));
  fs.cpSync(path.join(KIT, "kit", "locker"), path.join(dir, "locker"), { recursive: true });
  fs.mkdirSync(path.join(dir, "site", "admin"), { recursive: true });
  fs.writeFileSync(path.join(dir, "site", "index.html"), "home");
  fs.writeFileSync(path.join(dir, "site", "admin", "index.html"), "admin");
  const port = await new Promise((r) => { const s = http.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  const env = { ...process.env, PORT: String(port), LOCKER_GATE: "lazy", LOCKER_GATE_PATHS: "/admin, my", LOCKER_URL: HUB, LOCKER_APP_ID: "app_1", LOCKER_APP_SECRET: "s", APP_URL: "", LOCKER_GATE_USER: "" };
  const child = spawn(process.execPath, ["locker/static.mjs", "site"], { cwd: dir, env, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((r) => child.stdout.once("data", r));
  try {
    const base = `http://127.0.0.1:${port}`;
    assert.equal(await (await fetch(`${base}/`)).text(), "home");
    assert.equal(await (await fetch(`${base}/administrator`)).text(), "home", "only the folder itself, not names that start the same");
    for (const p of ["/admin", "/admin/", "/my/stuff", "/x/../admin/", "/%61dmin/"]) {
      // A browser opening the page (fetch() would say it's a fetch, and get the 401 instead).
      const r = await new Promise((done) => http.get(`${base}${p}`, (m) => { m.resume(); done(m); }));
      assert.equal(r.statusCode, 302, p);
      assert.match(r.headers.location, /^https:\/\/locker\.test\/oauth\/authorize/, p);
    }
    assert.deepEqual(await (await fetch(`${base}/_locker/me`)).json(), { user: null });
  } finally {
    await new Promise((r) => { child.once("exit", r); child.kill(); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sign-in comes back to the address it started on, when that's one of the app's own", async () => {
  setEnv({ LOCKER_GATE: "1", APP_URL: "https://lunch.apps.example.org", RAILWAY_PUBLIC_DOMAIN: "lunch-production.up.railway.app" });
  const redirectFor = async (host) => {
    const r = res();
    await gate(req("/", { headers: { host } }), r);
    return new URL(r.headers.location).searchParams.get("redirect_uri");
  };
  // The friendly address's certificate may not exist yet: people on railway.app must stay there.
  assert.equal(await redirectFor("lunch-production.up.railway.app"), "https://lunch-production.up.railway.app/_locker/callback");
  assert.equal(await redirectFor("lunch.apps.example.org"), "https://lunch.apps.example.org/_locker/callback");
  // Anything else (a made-up Host header) never becomes the callback.
  assert.equal(await redirectFor("evil.example.com"), "https://lunch.apps.example.org/_locker/callback");
});

// Tests kit/locker/push.mjs: the offline simulator (logged to data/push.jsonl), the hub calls (app secret,
// user in the body), who a request counts as (signed-in sub or this device's id), the files it serves,
// the "Send a test" limit, and the fall back to simulated when the hub can't be reached.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { push, sendPush, subscribe } from "../kit/locker/push.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-"));
const SIM = { DATABASE_PATH: path.join(dir, "app.db") };
const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPk", auth: "xyz" } };
const DEVICE = "0123456789abcdef0123456789abcdef";

// A pretend hub that records what it was sent.
const seen = [];
let hubUrl;
const fakeHub = http.createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
  res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url === "/api/push/key") return res.end(JSON.stringify({ publicKey: "BHubKey" }));
  if (req.url === "/api/push/subscribe") return res.end(JSON.stringify({ ok: true, devices: 1 }));
  if (req.url === "/api/push/send") return res.end(JSON.stringify({ ok: true, sent: 1, devices: 1 }));
  res.end(JSON.stringify({ ok: true, removed: 1 }));
});
before(() => new Promise((r) => fakeHub.listen(0, () => ((hubUrl = `http://127.0.0.1:${fakeHub.address().port}`), r()))));
after(() => {
  fakeHub.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
const HUB = () => ({ ...SIM, LOCKER_URL: hubUrl, LOCKER_APP_SECRET: "lks_app_test" });

// Calls the route handler like a Node server would.
async function call(method, url, { body, user, env = SIM } = {}) {
  const req = Object.assign(
    (async function* () {
      if (body) yield JSON.stringify(body);
    })(),
    { method, url, headers: {} },
  );
  let out = "";
  const res = new (await import("node:stream")).Writable({ write: (c, _, done) => ((out += c), done()) });
  Object.assign(res, { status: 0, headers: {}, writeHead(s, h) { this.status = s; this.headers = h ?? {}; return this; } });
  const finished = new Promise((r) => res.on("finish", r));
  const origEnd = res.end.bind(res);
  res.end = (c) => origEnd(c);
  const handled = await push(req, res, user, env);
  if (handled) await finished;
  return { handled, status: res.status, headers: res.headers, text: out, json: () => JSON.parse(out) };
}

test("simulated: subscribe and send are logged on the laptop, labelled", async () => {
  assert.deepEqual(await subscribe("device:x", SUB, SIM), { ok: true, simulated: true });
  const r = await sendPush({ user: "device:x", title: "Order ready", body: "Table 4", url: "/orders/1" }, SIM);
  assert.equal(r.simulated, true);
  const log = fs.readFileSync(path.join(dir, "push.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(log.map((l) => l.kind), ["subscribe", "send"]);
  assert.equal(log[1].title, "Order ready");
  await assert.rejects(sendPush({ title: "no one" }, SIM), /who gets it/);
  await assert.rejects(sendPush({ user: "u1" }, SIM), /title/);
});

test("connected: the hub gets the app secret, the user and the subscription", async () => {
  seen.length = 0;
  assert.deepEqual(await subscribe({ sub: "sub-ana" }, SUB, HUB()), { ok: true, devices: 1 });
  assert.deepEqual(await sendPush({ users: [{ sub: "sub-ana" }, "sub-ben"], title: "Hi" }, HUB()), { ok: true, sent: 1, devices: 1 });
  assert.deepEqual(seen.map((s) => [s.url, s.auth]), [["/api/push/subscribe", "Bearer lks_app_test"], ["/api/push/send", "Bearer lks_app_test"]]);
  assert.deepEqual(seen[0].body, { user: "sub-ana", subscription: SUB });
  assert.deepEqual(seen[1].body.users, ["sub-ana", "sub-ben"]);
});

test("routes: a signed-in person counts by sub, otherwise by this device's id", async () => {
  seen.length = 0;
  const key = await call("GET", "/api/push/key", { env: HUB() });
  assert.deepEqual(key.json(), { publicKey: "BHubKey" });
  const signedIn = await call("POST", "/api/push/subscribe", { body: { subscription: SUB, device: DEVICE }, user: { sub: "sub-ana" }, env: HUB() });
  assert.equal(signedIn.status, 201);
  assert.equal(signedIn.json().user, "sub-ana", "the device id never overrides who is signed in");
  const anon = await call("POST", "/api/push/subscribe", { body: { subscription: SUB, device: DEVICE }, env: HUB() });
  assert.equal(anon.json().user, `device:${DEVICE}`);
  assert.equal((await call("POST", "/api/push/subscribe", { body: { subscription: SUB, device: "short" }, env: HUB() })).status, 400);
  assert.equal((await call("GET", "/api/other")).handled, false);
});

test("serves the browser helper and the service worker (never cached long)", async () => {
  const sw = await call("GET", "/push-sw.js");
  assert.match(sw.text, /addEventListener\("push"/);
  assert.equal(sw.headers["Cache-Control"], "no-cache");
  assert.match((await call("GET", "/locker/push.js")).text, /window\.lockerPush/);
});

test("'Send a test' goes only to the person who tapped, three a minute; simulated says so", async () => {
  const r = await call("POST", "/api/push/test", { body: { device: DEVICE } });
  assert.equal(r.json().simulated, true);
  assert.equal(r.json().message.title, "It works!");
  await call("POST", "/api/push/test", { body: { device: DEVICE } });
  await call("POST", "/api/push/test", { body: { device: DEVICE } });
  assert.equal((await call("POST", "/api/push/test", { body: { device: DEVICE } })).status, 429);
});

test("hub can't be reached: falls back to simulated instead of breaking the page", async () => {
  const down = { ...SIM, LOCKER_URL: "http://127.0.0.1:9", LOCKER_APP_SECRET: "x" };
  assert.equal((await sendPush({ user: "u1", title: "Hi" }, down)).simulated, true);
  assert.deepEqual((await call("GET", "/api/push/key", { env: down })).json(), { publicKey: null, simulated: true });
});

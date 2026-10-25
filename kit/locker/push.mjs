// Push notifications: a message that pops up on someone's phone or laptop, even when your app is closed.
// Standard Web Push. The incubator hub holds the keys and does the sending, so there's no extra account.
// Your server talks to the hub with the app's secret; the browser only ever talks to YOUR server.
//
// Add it to a Node server in one line, after the sign-in gate and before your own routes:
//   import { push } from "./locker/push.mjs";
//   if (await push(req, res, user)) return;   // answers /api/push/*, /locker/push.js and /push-sw.js
// Then put a button on a page (see the push-notifications skill):
//   <button type="button" data-push-button>Turn on notifications</button>
//   <script src="/locker/push.js" defer></script>
// And notify people from your server when something THEY asked about happens:
//   import { sendPush } from "./locker/push.mjs";
//   await sendPush({ user: user.sub, title: "Your order is ready", body: "Table 4", url: "/orders/12" });
//
// Who is `user`? The signed-in person's `sub` (school sign-in on), or, with nobody signed in, the
// device's own id ("device:…"): the page gets it back from lockerPush.turnOn() and can send it along.
// Not connected to the hub yet (no LOCKER_URL / LOCKER_APP_SECRET in .env), or the hub can't be reached?
// It's simulated: each notification is printed in the terminal and saved to data/push.jsonl, and the
// "Send a test" button shows a notification labelled "(simulated)" from the page itself.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILES = { "/locker/push.js": "push.js", "/push-sw.js": "push-sw.js" };
const DEVICE = /^[A-Za-z0-9_-]{16,64}$/;
const tests = new Map(); // "Send a test" taps per person in the last minute

const connected = (env) => Boolean(env.LOCKER_URL && env.LOCKER_APP_SECRET);
const idOf = (user) => (typeof user === "string" ? user : user?.sub);

function simLog(entry, env) {
  const file = path.join(path.dirname(env.DATABASE_PATH || "./data/app.db"), "push.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n");
}

// One call to the hub. A network failure (hub unreachable) comes back as null, so callers can simulate.
async function hub(route, body, env) {
  let res;
  try {
    res = await fetch(`${env.LOCKER_URL.replace(/\/+$/, "")}${route}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${env.LOCKER_APP_SECRET}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.warn(`[push] the hub can't be reached (${err.cause?.code ?? err.message}): simulating`);
    return null;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`push: ${json.error ?? `the hub answered ${res.status}`}`), { status: res.status });
  return json;
}

/** The hub's public key for the browser, or null when simulated. */
export async function publicKey(env = process.env) {
  if (!connected(env)) return null;
  return (await hub("/api/push/key", null, env))?.publicKey ?? null;
}

/** Saves a browser's PushSubscription for one person (their `sub`, or your own id for them). */
export async function subscribe(user, subscription, env = process.env) {
  const id = idOf(user);
  if (!id) throw new Error("push: pass the person (the signed-in user, or your id for them) first.");
  if (connected(env) && subscription?.endpoint) {
    const r = await hub("/api/push/subscribe", { user: id, subscription }, env);
    if (r) return { ok: true, devices: r.devices };
  }
  simLog({ kind: "subscribe", user: id }, env);
  console.log(`[push, simulated] ${id} turned on notifications`);
  return { ok: true, simulated: true };
}

/** Stops notifications to one device (`endpoint`), or to every device of that person. */
export async function unsubscribe(user, endpoint, env = process.env) {
  const id = idOf(user);
  if (!id) throw new Error("push: pass the person first.");
  if (connected(env)) {
    const r = await hub("/api/push/unsubscribe", { user: id, endpoint }, env);
    if (r) return r;
  }
  simLog({ kind: "unsubscribe", user: id }, env);
  return { ok: true, simulated: true };
}

/**
 * Notifies people: `user` (one) or `users` (a list, up to 100), `title` (required, short), `body`,
 * `url` (a page of your app to open on tap, like "/orders/12"), `tag` (a newer one with the same tag
 * replaces the old one), `icon` ("/icon-192.png"). 500 a day per app. → { ok, sent, devices } or { simulated }.
 */
export async function sendPush({ user, users, title, body, url, tag, icon } = {}, env = process.env) {
  const ids = (users ?? [user]).map(idOf).filter(Boolean);
  if (!ids.length) throw new Error("push: say who gets it: { user } or { users: [...] }.");
  if (!String(title ?? "").trim()) throw new Error("push: `title` is required.");
  const message = { title, body, url, tag, icon };
  if (connected(env)) {
    const r = await hub("/api/push/send", { users: ids, ...message }, env);
    if (r) return r;
  }
  simLog({ kind: "send", users: ids, ...message }, env);
  console.log(`[push, simulated] to ${ids.join(", ")}: ${title}${body ? ` — ${body}` : ""}${url ? ` (opens ${url})` : ""}`);
  return { ok: true, simulated: true, sent: 0, devices: 0 };
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8000) throw Object.assign(new Error("That's too long."), { status: 413 });
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw Object.assign(new Error("Send JSON."), { status: 400 });
  }
}

// The signed-in person, or this device's own id (made by the page, kept in its localStorage).
function whoFor(user, body) {
  if (user?.sub) return user.sub;
  if (DEVICE.test(String(body.device ?? ""))) return `device:${body.device}`;
  throw Object.assign(new Error("Sign in first, or send this device's id."), { status: 400 });
}

/** Answers the push routes. Returns true when it handled the request, false otherwise. */
export async function push(req, res, user, env = process.env) {
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "GET" && FILES[url]) {
    // The service worker is never cached long, so a fix reaches phones on the next visit.
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": url === "/push-sw.js" ? "no-cache" : "public, max-age=300" });
    fs.createReadStream(path.join(HERE, FILES[url])).pipe(res);
    return true;
  }
  if (!url.startsWith("/api/push/")) return false;
  try {
    if (req.method === "GET" && url === "/api/push/key") {
      const key = await publicKey(env);
      send(res, 200, key ? { publicKey: key } : { publicKey: null, simulated: true });
      return true;
    }
    if (req.method !== "POST") return false;
    const body = await readJson(req);
    const who = whoFor(user, body);
    if (url === "/api/push/subscribe") send(res, 201, { ...(await subscribe(who, body.subscription, env)), user: who });
    else if (url === "/api/push/unsubscribe") send(res, 200, await unsubscribe(who, body.endpoint, env));
    else if (url === "/api/push/test") {
      // Only ever to the person who tapped, a few times a minute.
      const now = Date.now();
      const recent = (tests.get(who) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= 3) return send(res, 429, { error: "That's a few tests already. Wait a minute." }), true;
      tests.set(who, [...recent, now]);
      const message = { title: "It works!", body: "Notifications are on. You'll get one when something you asked about happens.", url: "/", tag: "push-test" };
      send(res, 200, { ...(await sendPush({ user: who, ...message }, env)), message });
    } else return false;
  } catch (err) {
    console.error(`[push] ${err.message}`);
    send(res, err.status && err.status < 500 ? err.status : 502, { error: err.status && err.status < 500 ? err.message.replace(/^push: /, "") : "Couldn't reach the notification service right now. Try again in a moment." });
  }
  return true;
}

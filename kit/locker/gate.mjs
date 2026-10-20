// BHS sign-in gate: put "Sign in with BHS" in front of a whole app with one setting.
// With LOCKER_GATE=1 every page needs a school Google account (signed in through BHS Locker).
// Without it, nothing changes. Copy this file into your app (the deploy only uploads the app
// folder); /ship and /connect do that for you. No packages needed.
//
//   import { gate } from "./locker/gate.mjs";
//   http.createServer(async (req, res) => {
//     const user = await gate(req, res);   // null = the gate already answered (redirect / login)
//     if (user === null) return;
//     // user is { sub, email, name, domain } when the gate is on, or undefined when it's off
//   });
//
// On your laptop: LOCKER_GATE_USER="Ana Garcia <ana@example.org>" in the app's .env makes the gate act
// signed in as that person, without the hub (so you can see the signed-in app). `npm run locker:set --
// <codename> LOCKER_GATE=1` adds a test user for you. It's refused on the server (Railway).
//
// Express: app.use(async (req, res, next) => { const u = await gate(req, res); if (u !== null) { req.user = u; next(); } });
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "bhs_gate";
const DAY = 24 * 60 * 60;

const on = () => process.env.LOCKER_GATE === "1";
const env = (k) => process.env[k] ?? "";

const sign = (value) => createHmac("sha256", env("LOCKER_APP_SECRET")).update(value).digest("base64url");
function seal(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${sign(body)}`;
}
function open(token) {
  const [body, mac] = String(token ?? "").split(".");
  if (!body || !mac) return null;
  const a = Buffer.from(sign(body));
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const obj = JSON.parse(Buffer.from(body, "base64url").toString());
  return obj.exp > Date.now() / 1000 ? obj : null;
}

const cookies = (req) => Object.fromEntries((req.headers.cookie ?? "").split(/;\s*/).filter(Boolean).map((c) => [c.slice(0, c.indexOf("=")), decodeURIComponent(c.slice(c.indexOf("=") + 1))]));

function origin(req) {
  if (env("APP_URL") && !/localhost|127\.0\.0\.1/.test(req.headers.host ?? "")) return env("APP_URL").replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? (req.socket?.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

function redirect(res, to, setCookie) {
  res.statusCode = 302;
  res.setHeader("Location", to);
  if (setCookie) res.setHeader("Set-Cookie", setCookie);
  res.end();
  return null;
}

/** "Ana Garcia <ana@example.org>", "ana@example.org" or "Ana Garcia" → a pretend signed-in user. */
export function simUser(value) {
  const m = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  let name = (m ? m[1] : value).trim();
  let email = m ? m[2].trim() : "";
  if (!m && name.includes("@")) [email, name] = [name, name.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
  if (!email) email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "test"}@example.org`;
  return { sub: `sim:${email}`, email, name: name || email, domain: email.split("@")[1], simulated: true };
}

/** Returns the signed-in user, undefined when the gate is off, or null when it sent a response. */
export async function gate(req, res) {
  if (!on()) return undefined;
  if (env("LOCKER_GATE_USER")) {
    if (env("RAILWAY_ENVIRONMENT") || env("RAILWAY_ENVIRONMENT_NAME")) {
      res.statusCode = 500;
      res.end("LOCKER_GATE_USER is only for your laptop. Remove it from the app's settings on the server.");
      return null;
    }
    if (new URL(req.url, "http://x").pathname === "/_locker/logout") return redirect(res, "/");
    return simUser(env("LOCKER_GATE_USER"));
  }
  if (!env("LOCKER_APP_ID") || !env("LOCKER_APP_SECRET") || !env("LOCKER_URL")) {
    res.statusCode = 500;
    res.end("LOCKER_GATE=1 but LOCKER_URL / LOCKER_APP_ID / LOCKER_APP_SECRET are missing. Run /connect.");
    return null;
  }
  const url = new URL(req.url, origin(req));
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const callback = `${origin(req)}/_locker/callback`;

  if (url.pathname === "/_locker/logout") {
    return redirect(res, "/", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  }

  if (url.pathname === "/_locker/callback") {
    const state = open(url.searchParams.get("state"));
    if (!state) return redirect(res, "/");
    const r = await fetch(`${env("LOCKER_URL")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env("LOCKER_APP_ID"), client_secret: env("LOCKER_APP_SECRET"), code: url.searchParams.get("code"), redirect_uri: callback }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.user) {
      res.statusCode = 403;
      res.end(`Sign-in didn't work: ${body.error_description ?? body.error ?? r.status}`);
      return null;
    }
    const token = seal({ ...body.user, exp: Math.floor(Date.now() / 1000) + 7 * DAY });
    return redirect(res, state.back || "/", `${COOKIE}=${token}; Path=/; Max-Age=${7 * DAY}; HttpOnly; SameSite=Lax${secure}`);
  }

  const user = open(cookies(req)[COOKIE]);
  if (user) {
    const { exp, ...who } = user;
    return who;
  }

  // Not signed in: off to BHS Locker, then back to the page they wanted.
  const state = seal({ back: url.pathname + url.search, n: randomBytes(8).toString("hex"), exp: Math.floor(Date.now() / 1000) + 600 });
  const to = new URL(`${env("LOCKER_URL")}/oauth/authorize`);
  to.search = new URLSearchParams({ client_id: env("LOCKER_APP_ID"), redirect_uri: callback, state }).toString();
  return redirect(res, to.toString());
}

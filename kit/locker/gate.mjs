// BHS sign-in gate: "Sign in with BHS" (through BHS Locker) for your app, with one setting.
//   LOCKER_GATE=1     every page needs sign-in.
//   LOCKER_GATE=lazy  the app is public; you choose which pages need sign-in (requireUser).
//   not set (or 0)    off: nothing changes, nobody is signed in.
// Copy this file into your app (the deploy only uploads the app folder); /ship and /connect do that
// for you. No packages needed.
//
//   import { gate, requireUser, signInUrl } from "./locker/gate.mjs";
//   http.createServer(async (req, res) => {
//     const user = await gate(req, res);   // null = the gate already answered (redirect / login)
//     if (user === null) return;
//     // user is { sub, email, name, domain } when someone is signed in, or undefined when nobody is
//     // (gate off, or LOCKER_GATE=lazy and not signed in yet)
//     if (url.pathname.startsWith("/my")) {      // with lazy: only these pages need sign-in
//       const u = requireUser(req, res);          // null = sent them to sign in; stop here
//       if (u === null) return;                  // (undefined: the gate is off, so there is no user to check)
//     }
//   });
//
// "Sign in" button: <a href="${signInUrl("/my")}">Sign in</a>. "Sign out": <a href="/_locker/logout">.
// Who can sign in is set on the hub: "school" apps only let in school accounts; "everyone" apps also
// let in parents and guests. So don't assume the user is a student: user.domain tells you.
//
// On your laptop: LOCKER_GATE_USER="Ana Garcia <ana@example.org>" in the app's .env makes the gate act
// signed in as that person, without the hub (so you can see the signed-in app). `npm run locker:set --
// <codename> LOCKER_GATE=1` (or =lazy) adds a test user for you. It's refused on the server (Railway).
// With lazy, "Sign out" on the laptop shows the signed-out app until you sign in again.
//
// Express: app.use(async (req, res, next) => { const u = await gate(req, res); if (u !== null) { req.user = u; next(); } });
//   Pages that need sign-in: const signedIn = (req, res, next) => { const u = requireUser(req, res); if (u !== null) { req.user = u; next(); } };
//   app.get("/my", signedIn, (req, res) => ...)
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "bhs_gate";
const SIM_OUT = "bhs_gate_sim_out"; // laptop only: "signed out" of the pretend user (lazy)
const DAY = 24 * 60 * 60;

const env = (k) => process.env[k] ?? "";
const mode = () => (env("LOCKER_GATE") === "1" ? "full" : env("LOCKER_GATE") === "lazy" ? "lazy" : "off");

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

// The address sign-in comes back to: the one this request arrived on, when that's one of the app's own
// addresses: its friendly APP_URL, or its *.up.railway.app one. A brand-new friendly address can take a while
// to get its security certificate; meanwhile people use the railway.app one, and sign-in must stay there.
// (Railway only routes a *.up.railway.app name to the service that owns it, and the hub checks every callback
// against the app's registered addresses anyway.) Any other Host header falls back to APP_URL.
function origin(req) {
  const host = String(req.headers.host ?? "").toLowerCase();
  const own = [env("RAILWAY_PUBLIC_DOMAIN"), env("APP_URL") && new URL(env("APP_URL")).host].filter(Boolean).map((h) => h.toLowerCase());
  if (own.includes(host) || /^[a-z0-9-]+\.up\.railway\.app$/.test(host)) return `https://${host}`;
  if (env("APP_URL") && !/localhost|127\.0\.0\.1/.test(host)) return env("APP_URL").replace(/\/$/, "");
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

// Only go back to a page of this app ("/my/list"), never to another site.
const local = (path) => (typeof path === "string" && /^\/(?![/\\])/.test(path) ? path : "/");
const onRailway = () => Boolean(env("RAILWAY_ENVIRONMENT") || env("RAILWAY_ENVIRONMENT_NAME"));

/** "Ana Garcia <ana@example.org>", "ana@example.org" or "Ana Garcia" → a pretend signed-in user. */
export function simUser(value) {
  const m = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  let name = (m ? m[1] : value).trim();
  let email = m ? m[2].trim() : "";
  if (!m && name.includes("@")) [email, name] = [name, name.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
  if (!email) email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "test"}@example.org`;
  return { sub: `sim:${email}`, email, name: name || email, domain: email.split("@")[1], simulated: true };
}

// The app's icon and manifest stay public, so phones can show it on the home screen and the hub's Apps
// page can fetch it ("Use my app's icon"). Put icons at these addresses (in public/) to use this.
export const PUBLIC_ICONS = /^\/(manifest\.webmanifest|manifest\.json|favicon\.(ico|png|svg)|apple-touch-icon(-precomposed)?\.png|icon(-\d+)?\.(png|svg)|icons\/[\w.-]+\.(png|svg|webp))$/;

/** The address for a "Sign in" link: signs in, then comes back to `returnTo` (a page of this app). */
export function signInUrl(returnTo = "/") {
  return `/_locker/login?back=${encodeURIComponent(local(returnTo))}`;
}

/** Who is signed in: the user, null when nobody is, undefined when the gate is off. Never answers the request. */
export function currentUser(req) {
  if (mode() === "off") return undefined;
  if (env("LOCKER_GATE_USER")) {
    if (onRailway()) return null; // the pretend user never counts on the server
    return mode() === "lazy" && cookies(req)[SIM_OUT] === "1" ? null : simUser(env("LOCKER_GATE_USER"));
  }
  const user = open(cookies(req)[COOKIE]);
  if (!user) return null;
  const { exp, ...who } = user;
  return who;
}

// Can sign-in work here? If not, it answers 500 with what to fix and returns false.
function ready(res) {
  if (env("LOCKER_GATE_USER")) {
    if (!onRailway()) return true;
    res.statusCode = 500;
    res.end("LOCKER_GATE_USER is only for your laptop. Remove it from the app's settings on the server.");
    return false;
  }
  if (env("LOCKER_APP_ID") && env("LOCKER_APP_SECRET") && env("LOCKER_URL")) return true;
  res.statusCode = 500;
  res.end(`LOCKER_GATE=${env("LOCKER_GATE")} but LOCKER_URL / LOCKER_APP_ID / LOCKER_APP_SECRET are missing. Run /connect.`);
  return false;
}

// Off to BHS Locker, then back to `back`. On the laptop: straight back, signed in as the test user.
function startSignIn(req, res, back) {
  if (env("LOCKER_GATE_USER")) return redirect(res, signInUrl(back));
  const callback = `${origin(req)}/_locker/callback`;
  const state = seal({ back: local(back), n: randomBytes(8).toString("hex"), exp: Math.floor(Date.now() / 1000) + 600 });
  const to = new URL(`${env("LOCKER_URL")}/oauth/authorize`);
  to.search = new URLSearchParams({ client_id: env("LOCKER_APP_ID"), redirect_uri: callback, state }).toString();
  return redirect(res, to.toString());
}

/**
 * For a page that needs sign-in. Returns the user, or null after sending them to sign in (stop there).
 * A page (GET) goes to sign-in and comes back to the same page. A form POST or a fetch() gets
 * 401 { error: "sign_in_required", signIn } instead: send the person to `signIn`.
 * Gate off: returns undefined and lets everyone through.
 */
export function requireUser(req, res) {
  if (mode() === "off") return undefined;
  if (!ready(res)) return null;
  const user = currentUser(req);
  if (user) return user;
  const url = new URL(req.url, "http://x");
  const fetchMode = req.headers["sec-fetch-mode"];
  const isPage = (req.method === "GET" || req.method === "HEAD") && !/application\/json/.test(req.headers.accept ?? "") && (!fetchMode || fetchMode === "navigate");
  if (isPage) return startSignIn(req, res, url.pathname + url.search);
  let back = "/";
  try {
    const ref = new URL(req.headers.referer);
    if (ref.host === req.headers.host) back = ref.pathname + ref.search;
  } catch {}
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "sign_in_required", signIn: signInUrl(back) }));
  return null;
}

/**
 * Call it first for every request. Returns the signed-in user; undefined when nobody is signed in and
 * that's fine (gate off, lazy, or a public icon); or null when it sent a response (stop there).
 */
export async function gate(req, res) {
  if (mode() === "off") return undefined;
  if (req.method === "GET" && PUBLIC_ICONS.test(new URL(req.url, "http://x").pathname)) return undefined;
  if (!ready(res)) return null;
  const url = new URL(req.url, origin(req));
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const back = local(url.searchParams.get("back"));

  if (env("LOCKER_GATE_USER")) {
    if (url.pathname === "/_locker/logout") return redirect(res, "/", `${SIM_OUT}=1; Path=/; HttpOnly; SameSite=Lax`);
    if (url.pathname === "/_locker/login") return redirect(res, back, `${SIM_OUT}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return currentUser(req) ?? undefined;
  }

  if (url.pathname === "/_locker/logout") {
    return redirect(res, "/", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  }

  if (url.pathname === "/_locker/login") {
    return currentUser(req) ? redirect(res, back) : startSignIn(req, res, back);
  }

  if (url.pathname === "/_locker/callback") {
    const state = open(url.searchParams.get("state"));
    if (!state) return redirect(res, "/");
    const r = await fetch(`${env("LOCKER_URL")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env("LOCKER_APP_ID"), client_secret: env("LOCKER_APP_SECRET"), code: url.searchParams.get("code"), redirect_uri: `${origin(req)}/_locker/callback` }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.user) {
      res.statusCode = 403;
      res.end(`Sign-in didn't work: ${body.error_description ?? body.error ?? r.status}`);
      return null;
    }
    const token = seal({ ...body.user, exp: Math.floor(Date.now() / 1000) + 7 * DAY });
    return redirect(res, local(state.back), `${COOKIE}=${token}; Path=/; Max-Age=${7 * DAY}; HttpOnly; SameSite=Lax${secure}`);
  }

  const user = currentUser(req);
  if (user) return user;
  if (mode() === "lazy") return undefined; // a public page; requireUser() decides where sign-in is needed

  // Not signed in: off to BHS Locker, then back to the page they wanted.
  return startSignIn(req, res, url.pathname + url.search);
}

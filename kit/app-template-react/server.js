// The app's server: answers the browser, talks to the database and the AI, and serves the React page.
// `npm run dev`: the page comes from Vite, live (changes show instantly; the server restarts when you save this file).
// Online (`npm run build`, then `npm start`): the page is the built files in dist/.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";
import { feedback } from "./locker/feedback.mjs";
import { push } from "./locker/push.mjs";
import { install } from "./locker/install.mjs";
import { gate } from "./locker/gate.mjs";
import { AiBudgetError, ask } from "./locker/ai/index.ts";

const PORT = Number(process.env.PORT) || 3000; // the kit puts a free port in .env; online, the host sets it
const DIST = path.resolve("dist");
const DEV = process.argv.includes("--dev");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

// Sends a JavaScript object back as JSON.
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Reads the JSON the page sent (up to 100 KB: notes and form data, not files; uploads use save-files).
async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw Object.assign(new Error("Too long"), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

// The app's own API. Add a route here for each thing the page needs to load or save.
// `user` is whoever is signed in when the school sign-in is on (see the bottom of this file), else undefined.
// A `:name` in the address is a blank to fill in: "GET /api/taps/:id" answers /api/taps/7, with params.id = "7".
const routes = {
  // How many times has anyone tapped the button? (An example: replace it with your app's data.)
  "GET /api/taps": (req, res) => {
    const { count } = db.prepare("select count(*) as count from taps").get();
    sendJson(res, 200, { count });
  },

  // Someone tapped: save it, then send back the new total.
  "POST /api/taps": (req, res) => {
    db.prepare("insert into taps default values").run();
    const { count } = db.prepare("select count(*) as count from taps").get();
    sendJson(res, 201, { count });
  },

  // One tap, by its number: /api/taps/1, /api/taps/2… (an example of a route with a blank in it).
  "GET /api/taps/:id": (req, res, user, params) => {
    const tap = db.prepare("select id, at from taps where id = ?").get(Number(params.id));
    if (!tap) return sendJson(res, 404, { error: "No tap with that number." });
    sendJson(res, 200, tap);
  },

  // Who's using the app: { user: { name, email, sub } } with the school sign-in on, else { user: null }.
  "GET /api/me": (req, res, user) => sendJson(res, 200, { user: user ?? null }),

  // Asks the AI one question (the "Ask the AI" box, src/components/AskBox.tsx). The AI key stays here on the server.
  "POST /api/ask": async (req, res) => {
    const { question } = await readJson(req);
    if (!String(question ?? "").trim()) return sendJson(res, 400, { error: "Ask something first." });
  try {
      const { text, simulated } = await ask("fast", String(question).slice(0, 500), { system: "Answer in two or three short sentences.", maxTokens: 300 });
      // No AI key yet (before /connect), the kit answers with a labelled simulated reply instead of failing.
      sendJson(res, 200, { answer: text, simulated, ...(simulated && { note: "That answer is simulated. Connect your app first (/connect) to use real AI." }) });
    } catch (err) {
      // The app's AI money for the month is used up: say so kindly instead of breaking the page.
      if (err instanceof AiBudgetError) return sendJson(res, 503, { error: err.message, code: err.code });
      throw err;
    }
  },
};

// Finds the route for a request, filling in the blanks: "GET /api/taps/:id" + /api/taps/7 → params { id: "7" }.
function findRoute(method, url) {
  for (const [key, handler] of Object.entries(routes)) {
    const [routeMethod, pattern] = key.split(" ");
    if (routeMethod !== method) continue;
    const names = [];
    const regex = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, name) => (names.push(name), "([^/]+)")) + "$");
    const found = url.match(regex);
    if (found) return { handler, params: Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(found[i + 1])])) };
  }
  return null;
}

// Online: anything that isn't an API route is a built file from dist/ (index.html for every page of the app).
function serveFile(req, res) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) return sendJson(res, 503, { error: "The page isn't built yet. Run npm run build (the deploy does it for you)." });
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(DIST + path.sep)) return sendJson(res, 403, { error: "Not allowed" }); // no peeking outside dist/
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  // Built files have a fingerprint in their name, so the browser can keep them; index.html is always fresh.
  const cache = file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}

// On this laptop (npm run dev) the page comes from Vite, which shares this server's port.
let vite;

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  try {
    // The host checks this to know the app is up. Keep it first, before the sign-in.
    if (url === "/health") return res.end("ok");
    // "Add to Home Screen" on phones: off until you set LOCKER_INSTALL=nudge (or required). See make-it-an-app.
    if (install(req, res)) return;

    // Sign-in gate: OFF until you set LOCKER_GATE (npm run locker:set -- <codename> LOCKER_GATE=1;
    // it goes in .env too, to try it here). =1: every page needs sign-in. =lazy: the app is public and
    // only pages that call requireUser(req, res) need it (see the top of locker/gate.mjs).
    // `user` is { sub, email, name, domain } of whoever is signed in, or undefined.
    const user = await gate(req, res);
    if (user === null) return; // the gate already answered (sent them to sign in)

    // The tester "Feedback" button (POST /api/feedback, sent on to the hub). Turn the button on in index.html.
    if (await feedback(req, res)) return;

    // Notifications: the "Turn on notifications" button's routes (/api/push/*) and its service worker. Send one
    // from your own routes with sendPush({ user: user.sub, title, body, url }) (push-notifications skill).
    if (await push(req, res, user)) return;

    const route = findRoute(req.method, url);
    if (route) return await route.handler(req, res, user, route.params);
    if (url.startsWith("/api/")) return sendJson(res, 404, { error: "No such API route" });
    if (vite) return vite.middlewares(req, res, () => sendJson(res, 404, { error: "Not found" }));
    serveFile(req, res);
  } catch (err) {
    // One line in the terminal (and the online logs) with the real error; a short one for the browser.
    console.error(JSON.stringify({ level: "error", message: `${req.method} ${url}: ${err.message}`, stack: err.stack }));
    if (!res.headersSent) sendJson(res, err.status ?? 500, { error: err.status ? err.message : "Something went wrong on the server." });
  }
});

if (DEV) {
  const { createServer } = await import("vite");
  // "native" loads vite.config.ts with Node itself (no temp file), so `node --watch` doesn't restart in a loop.
  vite = await createServer({ configLoader: "native", server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
}
server.listen(PORT, () => console.log(`Your app is running: open http://localhost:${PORT}`));

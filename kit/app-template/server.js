// The app's server: answers the browser, talks to the database and the AI, and serves the files in public/.
// No packages needed. Start it with `npm run dev` (restarts when you save a file).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";
import { feedback } from "./locker/feedback.mjs";
import { gate } from "./locker/gate.mjs";
import { AiBudgetError, ask } from "./locker/ai/index.ts";

const PORT = Number(process.env.PORT) || 3000; // the kit puts a free port in .env; online, the host sets it
const PUBLIC = path.resolve("public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

// Sends a JavaScript object back as JSON.
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Reads the JSON the page sent (small requests only).
async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw Object.assign(new Error("Too long"), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

// The app's own API. Add a route here for each thing the page needs to load or save.
// `user` is whoever is signed in when the school sign-in is on (see the bottom of this file), else undefined.
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

  // Who's using the app: { user: { name, email, sub } } with the school sign-in on, else { user: null }.
  "GET /api/me": (req, res, user) => sendJson(res, 200, { user: user ?? null }),

  // Asks the AI one question (the "Ask the AI" box, public/ask.js). The AI key stays here on the server.
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

// Anything that isn't an API route is a file from public/ (index.html for the home page).
function serveFile(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(PUBLIC + path.sep)) return sendJson(res, 403, { error: "Not allowed" }); // no peeking outside public/
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = req.url.split("?")[0];
    try {
      // The host checks this to know the app is up. Keep it first, before the sign-in.
      if (url === "/health") return res.end("ok");

      // School sign-in for the whole app: OFF until you set LOCKER_GATE=1
      // (npm run locker:set -- <codename> LOCKER_GATE=1, and LOCKER_GATE=1 in .env to try it here).
      // When it's on, `user` is { sub, email, name } of whoever is signed in.
      const user = await gate(req, res);
      if (user === null) return; // the gate already answered (sent them to sign in)

      // The tester "Feedback" button (POST /api/feedback, sent on to the hub). Turn the button on in public/index.html.
      if (await feedback(req, res)) return;

      const route = routes[`${req.method} ${url}`];
      if (route) return await route(req, res, user);
      if (url.startsWith("/api/")) return sendJson(res, 404, { error: "No such API route" });
      serveFile(req, res);
    } catch (err) {
      // One line in the terminal (and the online logs) with the real error; a short one for the browser.
      console.error(JSON.stringify({ level: "error", message: `${req.method} ${url}: ${err.message}`, stack: err.stack }));
      if (!res.headersSent) sendJson(res, err.status ?? 500, { error: err.status ? err.message : "Something went wrong on the server." });
    }
  })
  .listen(PORT, () => console.log(`Your app is running: open http://localhost:${PORT}`));

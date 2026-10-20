// The app's server: answers the browser, talks to the database, and serves the files in public/.
// No packages needed. Start it with `npm run dev` (restarts when you save a file).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";

const PORT = Number(process.env.PORT) || 3000; // the kit puts a free port in .env; online, the host sets it
const PUBLIC = path.resolve("public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

// Sends a JavaScript object back as JSON.
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// The app's own API. Add a route here for each thing the page needs to load or save.
const routes = {
  // The host checks this to know the app is up. Keep it.
  "GET /health": (req, res) => res.end("ok"),

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
  .createServer((req, res) => {
    const route = routes[`${req.method} ${req.url.split("?")[0]}`];
    try {
      if (route) return route(req, res);
      if (req.url.startsWith("/api/")) return sendJson(res, 404, { error: "No such API route" });
      serveFile(req, res);
    } catch (err) {
      // Show the real error in the terminal (and in the online logs), and a short one to the browser.
      console.error(err);
      sendJson(res, 500, { error: err.message });
    }
  })
  .listen(PORT, () => console.log(`Your app is running: open http://localhost:${PORT}`));

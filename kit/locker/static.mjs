// A tiny web server for static sites (plain HTML/CSS/JS, or a built `dist/` folder), so they
// deploy to Railway like any app, with the optional BHS sign-in gate in front.
//   "scripts": { "start": "node locker/static.mjs dist" }
// Serves index.html for unknown paths (single-page apps), /health for Railway, no packages needed.
// Sign-in: LOCKER_GATE=1 puts it in front of every page. LOCKER_GATE=lazy keeps the site public except
// the folders in LOCKER_GATE_PATHS (like "/admin,/my"), which need sign-in. Pages can ask who is
// signed in with fetch("/_locker/me") → { user } (null when nobody is), and link to
// "/_locker/login?back=/my" (sign in) or "/_locker/logout" (sign out).
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, posix, resolve } from "node:path";
import { currentUser, gate, requireUser } from "./gate.mjs";
import { feedback } from "./feedback.mjs";

const root = resolve(process.argv[2] || ".");
const PRIVATE = (process.env.LOCKER_GATE_PATHS ?? "").split(",").map((p) => `/${p.trim()}`.replace(/^\/+/, "/").replace(/\/+$/, "")).filter(Boolean);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".mp3": "audio/mpeg" };

http
  .createServer(async (req, res) => {
    if (req.url === "/health") return res.end("ok");
    if (await feedback(req, res)) return; // the "Feedback" button: <script src="/locker/feedback.js" defer></script>
    if ((await gate(req, res)) === null) return;
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/_locker/me") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ user: currentUser(req) ?? null }));
    const clean = posix.normalize(path.replaceAll("\\", "/"));
    if (PRIVATE.some((p) => clean === p || clean.startsWith(`${p}/`)) && requireUser(req, res) === null) return;
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) file = join(root, "index.html"); // single-page app fallback
    if (!existsSync(file)) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  })
  .listen(Number(process.env.PORT || 3000), () => console.log(`Serving ${root} on port ${process.env.PORT || 3000}`));

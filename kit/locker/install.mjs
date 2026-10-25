// The "Add to Home Screen" helper's server side: serves locker/install.js to the page, with the app's
// LOCKER_INSTALL setting (off | nudge | required) baked in, so you can switch it in .env without editing code.
//
// Add it to a Node server in one line, before the sign-in gate (it's a public file, like /health):
//   import { install } from "./locker/install.mjs";
//   if (install(req, res)) return;            // answers GET /locker/install.js
// Then on the page, in <head>:  <script src="/locker/install.js"></script>
// (or data-mode="nudge" on that tag; LOCKER_INSTALL in .env wins when both are set). See make-it-an-app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "install.js");
const MODES = ["off", "nudge", "required"];

/** The settings the page gets from .env. Unknown values are ignored (with a warning) so a typo can't lock anyone out. */
export function installSettings(env = process.env) {
  const mode = String(env.LOCKER_INSTALL ?? "").trim().toLowerCase();
  if (!mode) return {};
  if (!MODES.includes(mode)) {
    console.warn(`[install] LOCKER_INSTALL="${env.LOCKER_INSTALL}" isn't off, nudge or required. Ignoring it.`);
    return {};
  }
  return { mode };
}

/** Answers GET /locker/install.js. Returns true when it handled the request, false otherwise. */
export function install(req, res, env = process.env) {
  if (req.method !== "GET" || (req.url ?? "").split("?")[0] !== "/locker/install.js") return false;
  const body = `window.__LOCKER_INSTALL__ = ${JSON.stringify(installSettings(env))};\n${fs.readFileSync(SCRIPT, "utf8")}`;
  // Short cache: when you change LOCKER_INSTALL, phones pick it up within a minute.
  res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=60" });
  res.end(body);
  return true;
}

// The "Feedback" button's server side. Testers type into the button's sheet (feedback.js); the page
// posts to YOUR server's /api/feedback, and this file passes it on to the incubator hub with the app's
// secret, so the secret never reaches a browser. The team reads it on the hub's project page, or in
// the kit with: npm run locker:feedback -- <codename>
//
// Add it to a Node server in one line, before your own routes:
//   import { feedback } from "./locker/feedback.mjs";
//   if (await feedback(req, res)) return;      // answers POST /api/feedback and GET /locker/feedback.js
// Then put the button on a page:  <script src="/locker/feedback.js" defer></script>
//
// Not connected to the hub yet (no LOCKER_URL / LOCKER_APP_SECRET in .env)? It's simulated: each
// message is printed in the terminal and saved to data/feedback.jsonl, so it works offline too.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WIDGET = path.join(path.dirname(fileURLToPath(import.meta.url)), "feedback.js");
const MAX_BODY = 8000;
const PER_MINUTE = 5; // per visitor, so one person can't use up the app's 200 a day
const recent = new Map();

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(Object.assign(new Error("That's too long."), { status: 413 }));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

// True when this visitor sent more than PER_MINUTE in the last minute.
function tooMany(req) {
  const who = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  const now = Date.now();
  const times = (recent.get(who) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(who, times);
  return times.length > PER_MINUTE;
}

/** Sends one piece of feedback to the hub, or to the simulator when the app isn't connected yet. */
export async function sendFeedback({ message, page, contact, rating } = {}, env = process.env) {
  const body = {
    message: String(message ?? "").trim().slice(0, 2000),
    page: page ? String(page).slice(0, 300) : undefined,
    contact: contact ? String(contact).trim().slice(0, 120) : undefined,
    rating: rating ? Number(rating) : undefined,
  };
  if (!body.message) throw Object.assign(new Error("Write something first."), { status: 400 });
  if (!env.LOCKER_URL || !env.LOCKER_APP_SECRET) {
    const file = path.join(path.dirname(env.DATABASE_PATH || "./data/app.db"), "feedback.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ ...body, at: new Date().toISOString() }) + "\n");
    console.log(`[feedback, simulated] ${body.rating ? `${body.rating}/5 ` : ""}${body.message}`);
    return { ok: true, simulated: true };
  }
  const res = await fetch(`${env.LOCKER_URL.replace(/\/+$/, "")}/api/feedback`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LOCKER_APP_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `The hub answered ${res.status}`), { status: res.status === 400 || res.status === 429 ? res.status : 502 });
  return { ok: true };
}

/** Answers the feedback routes. Returns true when it handled the request, false otherwise. */
export async function feedback(req, res) {
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "GET" && url === "/locker/feedback.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" });
    fs.createReadStream(WIDGET).pipe(res);
    return true;
  }
  if (req.method !== "POST" || url !== "/api/feedback") return false;
  try {
    if (tooMany(req)) {
      send(res, 429, { error: "Thanks! That's a lot at once. Try again in a minute." });
      return true;
    }
    let input;
    try {
      input = JSON.parse((await readBody(req)) || "{}");
    } catch (err) {
      if (err.status) throw err;
      send(res, 400, { error: "Send the feedback as JSON." });
      return true;
    }
    send(res, 201, await sendFeedback(input));
  } catch (err) {
    // The real reason goes to the terminal / app logs; the tester gets a short message.
    console.error(`[feedback] ${err.message}`);
    send(res, err.status ?? 500, { error: err.status && err.status < 500 ? err.message : "Couldn't send it right now. Try again in a moment." });
  }
  return true;
}

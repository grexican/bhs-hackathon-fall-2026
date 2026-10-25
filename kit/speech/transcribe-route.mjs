// The server half of the "cloud" speech engine: the page records audio and sends the bytes here,
// this sends them to the AI with the app's own key (the key never reaches the browser).
//
// Add it to server.js in two lines (the AI kit is already in every starter app at locker/ai/):
//   import { transcribe } from "./locker/ai/index.ts";
//   import { transcribeRoute } from "./locker/transcribe-route.mjs";
//   if (await transcribeRoute(req, res, { transcribe, user })) return;   // next to the feedback line
//
// It answers POST /api/transcribe?language=es (body: the recording) with { text, simulated }.
// Limits: 10 MB (about 2 minutes; the page's recorder stops itself at 2 minutes) and 10 clips a minute per person.

const MAX_BYTES = 10 * 1024 * 1024;
const recent = new Map();

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Reads the recording, stopping early when it's bigger than the limit.
async function readAudio(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("That recording is too long. Keep it under 2 minutes."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// True when this person sent more than `perMinute` clips in the last minute (so one person can't spend the app's AI budget).
function tooMany(req, user, perMinute) {
  const who = user?.sub ?? String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  const now = Date.now();
  const times = (recent.get(who) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(who, times);
  return times.length > perMinute;
}

/** Answers POST /api/transcribe. Returns true when it handled the request, false otherwise. */
export async function transcribeRoute(req, res, { transcribe, user, maxBytes = MAX_BYTES, perMinute = 10 } = {}) {
  const url = new URL(req.url ?? "/", "http://x");
  if (req.method !== "POST" || url.pathname !== "/api/transcribe") return false;
  try {
    if (tooMany(req, user, perMinute)) return send(res, 429, { error: "That's a lot of talking at once. Wait a minute and try again." }), true;
    const audio = await readAudio(req, maxBytes);
    if (audio.length < 1000) return send(res, 400, { error: "No sound came through. Hold the button while you speak." }), true;
    const result = await transcribe(audio, {
      language: url.searchParams.get("language") ?? undefined,
      quality: url.searchParams.get("quality") === "best" ? "best" : "fast",
      mimeType: String(req.headers["content-type"] ?? ""),
    });
    send(res, 200, {
      text: result.text,
      simulated: result.simulated,
      ...(result.simulated && { note: "That transcript is simulated. Connect your app first (/connect) to use real speech to text." }),
    });
  } catch (err) {
    // The app's AI money for the month is used up: say so kindly instead of breaking the page.
    if (err.code === "AI_BUDGET_USED_UP") return send(res, 503, { error: err.message, code: err.code }), true;
    console.error(`[transcribe] ${err.message}`);
    send(res, err.status ?? 502, { error: err.status && err.status < 500 ? err.message : "Couldn't turn that into text right now. Try again in a moment." });
  }
  return true;
}

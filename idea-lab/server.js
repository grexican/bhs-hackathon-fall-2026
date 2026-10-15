// BHS Hackathon idea lab: a student types an app idea, answers 4 quick questions, and gets a
// clickable prototype at an unlisted /s/<uuid> page. Linked only from the sign-up form.
// It switches itself off after the hackathon weekend (CLOSES_AT); showcases stay viewable.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { initDb, createShowcase, getShowcase, counts, listShowcases, listExamples } from "./lib/db.js";
import { renderExamples } from "./lib/examples.js";
import { renderAdmin } from "./lib/admin.js";
import { runResearch, answer, retryBuild, SLOTS } from "./lib/flow.js";
import { renderShowcase } from "./lib/showcase.js";
import { APP_CSP } from "./lib/csp.js";
import { bus } from "./lib/events.js";

export const CONFIG = {
  closesAt: new Date(process.env.CLOSES_AT || "2026-10-26T00:00:00+01:00"),
  signupUrl: process.env.SIGNUP_URL || "https://forms.gle/REPLACE",
  perIpPerHour: Number(process.env.PER_IP_PER_HOUR || 6),
  buildsPerDay: Number(process.env.BUILDS_PER_DAY || 300),
  publicUrl: process.env.PUBLIC_URL || "",
};

const isClosed = () => Date.now() >= +CONFIG.closesAt;
const ipHash = (c) =>
  createHash("sha256")
    .update((c.req.header("x-forwarded-for") ?? "local").split(",")[0].trim() + (process.env.IP_SALT ?? "bhs"))
    .digest("hex")
    .slice(0, 16);

const app = new Hono();

// Security headers for our own pages. The generated prototype has its own, stricter route below.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  if (!c.req.path.endsWith("/app")) c.header("X-Frame-Options", "DENY");
});

app.get("/healthz", (c) => c.text("ok"));

// Public list of the Idea Lab's own example prototypes, for students who don't know what to build.
// It only reads finished pages, so it stays up after the lab closes.
app.get("/examples", async (c) => c.html(renderExamples(await listExamples(), CONFIG)));

// Organizer list of every idea. Exists only when ADMIN_KEY is set, and only at /admin/<that key>.
app.get("/admin/:key", async (c) => {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 16 || c.req.param("key") !== key) return c.text("Not found", 404);
  c.header("Cache-Control", "no-store");
  return c.html(renderAdmin(await listShowcases()));
});

// Public config the page needs: is it open, where to sign up.
app.get("/api/config", (c) =>
  c.json({ open: !isClosed(), closesAt: CONFIG.closesAt.toISOString(), signupUrl: CONFIG.signupUrl, questions: SLOTS.length }),
);

// Everything that spends AI credits goes through this gate.
app.use("/api/session/*", async (c, next) => {
  if (c.req.method !== "GET" && isClosed()) return c.json({ error: "The idea lab is closed. The hackathon is over, thanks for building!" }, 410);
  await next();
});
app.post("/api/session", async (c) => {
  if (isClosed()) return c.json({ error: "The idea lab is closed. The hackathon is over, thanks for building!" }, 410);
  const body = await c.req.json().catch(() => ({}));
  const idea = String(body.idea ?? "").trim().slice(0, 2000); // detail helps: a specific idea gets a better build
  const firstName = String(body.firstName ?? "").trim().slice(0, 40);
  if (idea.length < 8) return c.json({ error: "Tell me a bit more: one sentence about the app you want." }, 400);
  const hash = ipHash(c);
  const { ipLastHour, buildsToday } = await counts(hash);
  if (ipLastHour >= CONFIG.perIpPerHour) return c.json({ error: "That's a lot of ideas in one hour. Try again a little later." }, 429);
  if (buildsToday >= CONFIG.buildsPerDay) return c.json({ error: "The idea lab hit today's limit. Try again tomorrow." }, 429);

  const id = randomUUID();
  await createShowcase({ id, idea, first_name: firstName, ip_hash: hash, transcript: [{ role: "user", kind: "idea", text: idea }] });
  try {
    const question = await runResearch(id);
    const row = await getShowcase(id);
    return c.json({ id, research: row.research, question, step: 0 });
  } catch (err) {
    console.error(`[session ${id}]`, err);
    return c.json({ error: "The AI didn't answer. Give it another try in a moment." }, 502);
  }
});

app.post("/api/session/:id/answer", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.status !== "interview") return c.json({ error: "This one is already building." }, 409);
  const body = await c.req.json().catch(() => ({}));
  const text = String(body.answer ?? "").trim().slice(0, 600);
  if (!text) return c.json({ error: "Pick an option or type your own answer." }, 400);
  try {
    const question = await answer(row.id, text);
    return c.json(question ? { question, step: row.step + 1 } : { building: true });
  } catch (err) {
    console.error(`[answer ${row.id}]`, err);
    return c.json({ error: "The AI didn't answer. Try sending that again." }, 502);
  }
});

// A failed build keeps every answer, so it can be rebuilt without redoing the interview.
app.post("/api/session/:id/retry", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.status !== "failed") return c.json({ error: "Only a failed build can be retried." }, 409);
  await retryBuild(row.id);
  return c.json({ building: true });
});

// Polled while the prototype builds.
app.get("/api/session/:id", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({
    status: row.status,
    spec: row.spec,
    url: row.status === "ready" ? `/s/${row.id}` : null,
    error: row.status === "failed" ? "The build didn't finish." : null,
    // Enough to redraw the chat after a refresh of /c/<id>.
    idea: row.idea,
    firstName: row.first_name,
    step: row.step,
    research: row.research,
    transcript: row.transcript,
    log: row.log ?? [],
  });
});

// Live build progress as server-sent events: replays the stored log, then streams new lines
// (plus short-lived "Writing code: N lines" ticks) until the build is ready or failed.
app.get("/api/session/:id/events", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  return streamSSE(c, async (stream) => {
    const queue = [];
    let wake = null;
    const onEvent = (e) => {
      queue.push(e);
      wake?.();
    };
    bus.on(row.id, onEvent);
    stream.onAbort(() => bus.off(row.id, onEvent));
    try {
      for (const e of row.log ?? []) await stream.writeSSE({ event: "progress", data: JSON.stringify(e) });
      // The build may already be over (or may finish between the read above and subscribing).
      const now = await getShowcase(row.id);
      if (now.status !== "building") {
        await stream.writeSSE({ event: "status", data: JSON.stringify({ status: now.status, url: now.status === "ready" ? `/s/${row.id}` : null }) });
        return;
      }
      const deadline = Date.now() + 10 * 60_000;
      while (Date.now() < deadline && !stream.aborted) {
        if (!queue.length) {
          // Wake on the next event, or every 15s to send a keep-alive through proxies.
          await new Promise((r) => { wake = r; setTimeout(r, 15_000); });
          wake = null;
          if (!queue.length) {
            await stream.writeSSE({ event: "ping", data: "{}" });
            continue;
          }
        }
        const e = queue.shift();
        await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
        if (e.type === "status" && e.status !== "building") return;
      }
    } finally {
      bus.off(row.id, onEvent);
    }
  });
});

// Each chat has its own address, so a refresh lands back in it. Same page as /, the script restores it.
const indexHtml = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");
app.get("/c/:id", (c) => c.html(indexHtml));

// The showcase page (unlisted: only reachable by its UUID).
app.get("/s/:id", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row || row.status !== "ready") return c.html(notFound(), 404);
  return c.html(renderShowcase(row, CONFIG));
});

// Screenshots from the build's browser test. The desktop one doubles as the link-preview image.
app.get("/s/:id/shot/:kind{(mobile|desktop)\\.jpg}", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  const kind = c.req.param("kind").replace(".jpg", "");
  const b64 = row?.status === "ready" ? row.shots?.[kind] : null;
  if (!b64) return c.text("Not found", 404);
  c.header("Content-Type", "image/jpeg");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(Buffer.from(b64, "base64"));
});

// The raw prototype, shown inside a sandboxed iframe (no same-origin, so its script can't touch us).
app.get("/s/:id/app", async (c) => {
  const row = await getShowcase(c.req.param("id"));
  if (!row?.html) return c.text("Not found", 404);
  c.header("Content-Security-Policy", APP_CSP);
  return c.html(row.html);
});

// no-cache = "check with us first", so a deploy reaches open tabs instead of an old cached app.js.
app.use("/*", serveStatic({ root: "./public", onFound: (_path, c) => c.header("Cache-Control", "no-cache") }));

function notFound() {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title>
<body style="font-family:system-ui;padding:40px;max-width:480px;margin:auto"><h1>Nothing here</h1><p>This prototype doesn't exist, or it's still being built.</p><p><a href="/">Try your own idea</a></p></body>`;
}

await initDb();
const port = Number(process.env.PORT || 4321);
serve({ fetch: app.fetch, port }, () => console.log(`idea lab on http://localhost:${port} (closes ${CONFIG.closesAt.toISOString()})`));

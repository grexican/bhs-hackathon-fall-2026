// Request logs for your app, one line each, in the Railway logs (npm run locker:logs -- <codename>).
// Every page load and every call your app makes (to the AI, to an API) becomes one line:
//   {"level":"info","message":"GET /api/menu 200 34ms",...}    {"level":"error","message":"POST /order 500 12ms",...}
// Crashes get their full error printed too. Nothing to change in your code: `npm run deploy` copies
// this file in, and the server starts your app with it. On your laptop:
// node --import ./locker/otel.mjs server.js. LOCKER_OTEL=0 turns it off.
//
// With the OpenTelemetry packages installed (the deploy adds them) this is real OpenTelemetry:
// set OTEL_EXPORTER_OTLP_ENDPOINT later and the same traces go to any tracing service instead.
// Without them (e.g. on your laptop before npm install) a tiny built-in logger prints the same lines.
import { channel } from "node:diagnostics_channel";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const quiet = new Set(["/health", "/healthz", "/favicon.ico"]);
const SLOW_MS = 1000;

/** Prints one JSON line. Railway reads "level" and "message" and keeps the rest as fields you can filter on. */
function line(level, message, fields = {}) {
  let text = JSON.stringify({ level, message, ...fields });
  // Secrets the app is using right now (locker/vault.mjs registers them) never reach the logs.
  for (const s of globalThis.__lockerSecrets ?? []) text = text.replaceAll(JSON.stringify(s).slice(1, -1), "[redacted]");
  process.stdout.write(text + "\n");
}

function requestLine({ kind, method, target, status, ms, error, traceId }) {
  const failed = Boolean(error) || status >= 500;
  const level = failed ? "error" : status >= 400 || ms >= SLOW_MS ? "warn" : "info";
  const arrow = kind === "out" ? "→ " : "";
  const message = `${arrow}${method} ${target} ${status || (error ? "failed" : "")} ${Math.round(ms)}ms${error ? ` ${error}` : ""}`.replace(/\s+/g, " ").trim();
  line(level, message, { kind: kind === "out" ? "outgoing" : "request", method, target, status, duration_ms: Math.round(ms), trace_id: traceId, ...(error ? { error } : {}) });
}

// Never show secrets: query strings can carry tokens, so only the path is logged.
const pathOnly = (url = "") => String(url).split("?")[0] || "/";

function crashes() {
  // Watches only: the app still crashes (and Railway restarts it) exactly as it would without this file.
  process.on("uncaughtExceptionMonitor", (err) => line("error", `Crash: ${err?.message ?? err}`, { kind: "crash", stack: err?.stack }));
}

/** Real OpenTelemetry, with a console exporter that prints our one-line format. */
async function startOpenTelemetry() {
  const [{ NodeSDK }, { HttpInstrumentation }, { UndiciInstrumentation }, { SimpleSpanProcessor }] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/instrumentation-http"),
    import("@opentelemetry/instrumentation-undici"),
    import("@opentelemetry/sdk-trace-base"),
  ]);
  const exporter = {
    export(spans, done) {
      for (const s of spans) {
        const a = s.attributes;
        const ms = s.duration[0] * 1e3 + s.duration[1] / 1e6;
        const status = Number(a["http.response.status_code"] ?? a["http.status_code"] ?? 0);
        const method = a["http.request.method"] ?? a["http.method"] ?? "";
        const server = s.kind === 1; // SpanKind.SERVER
        const target = server ? pathOnly(a["url.path"] ?? a["http.target"]) : `${a["server.address"] ?? a["net.peer.name"] ?? ""}${pathOnly(a["url.path"] ?? "")}`;
        if (server && quiet.has(target)) continue;
        const error = s.status?.code === 2 ? s.status.message || s.events?.find((e) => e.name === "exception")?.attributes?.["exception.message"] || "error" : undefined;
        requestLine({ kind: server ? "in" : "out", method, target, status, ms, error: status ? undefined : error, traceId: s.spanContext().traceId });
      }
      done({ code: 0 });
    },
    shutdown: async () => {},
  };
  // An OTLP endpoint means "send traces to a real tracing service": let the SDK read the OTEL_* settings.
  const toService = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || process.env.RAILWAY_SERVICE_NAME || "app",
    ...(toService ? {} : { spanProcessors: [new SimpleSpanProcessor(exporter)] }),
    instrumentations: [new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => quiet.has(pathOnly(req.url)) }), new UndiciInstrumentation()],
  });
  sdk.start();
  // ES-module apps never require("http"), so load it once here and the instrumentation patches it.
  createRequire(import.meta.url)("node:http");
  createRequire(import.meta.url)("node:https");
  process.once("SIGTERM", () => sdk.shutdown().catch(() => {}));
  return toService ? "opentelemetry (otlp)" : "opentelemetry";
}

/** No packages: Node's built-in diagnostics channels give us every request and every fetch(). */
function startBuiltin() {
  const started = new WeakMap();
  channel("http.server.request.start").subscribe(({ request }) => started.set(request, performance.now()));
  channel("http.server.response.finish").subscribe(({ request, response }) => {
    const target = pathOnly(request.url);
    if (quiet.has(target)) return;
    requestLine({ kind: "in", method: request.method, target, status: response.statusCode, ms: performance.now() - (started.get(request) ?? performance.now()), traceId: randomBytes(16).toString("hex") });
  });
  const out = new WeakMap();
  const where = (r) => `${String(r.origin ?? "").replace(/^https?:\/\//, "")}${pathOnly(r.path)}`;
  channel("undici:request:create").subscribe(({ request }) => out.set(request, performance.now()));
  channel("undici:request:headers").subscribe(({ request, response }) =>
    requestLine({ kind: "out", method: request.method, target: where(request), status: response.statusCode, ms: performance.now() - (out.get(request) ?? performance.now()) }),
  );
  channel("undici:request:error").subscribe(({ request, error }) =>
    requestLine({ kind: "out", method: request.method, target: where(request), status: 0, ms: performance.now() - (out.get(request) ?? performance.now()), error: error?.message ?? String(error) }),
  );
  return "built-in";
}

// NODE_OPTIONS also reaches npm itself and build scripts (npm ci, npm run build): only servers need this.
const tool = /[\\/](npm|npx|pnpm|yarn|corepack)(-cli)?(\.c?js)?$/i.test(process.argv[1] ?? "");
const script = process.env.npm_lifecycle_event;
const server = !tool && (!script || /^(start|dev|serve|preview)/.test(script));

if (server && process.env.LOCKER_OTEL !== "0" && !globalThis.__lockerOtel) {
  globalThis.__lockerOtel = true;
  crashes();
  let mode;
  try {
    mode = await startOpenTelemetry();
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND") line("warn", `OpenTelemetry didn't start (${err?.message}); using the built-in request log`);
    mode = startBuiltin();
  }
  if (process.env.LOCKER_OTEL_QUIET !== "1") line("info", `Request logging on (${mode}). Read it with: npm run locker:logs`, { kind: "otel" });
}

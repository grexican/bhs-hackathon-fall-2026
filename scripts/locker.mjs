#!/usr/bin/env node
// Talks to the incubator hub (the Locker): connect this laptop, create a project (hosting + AI key), fetch its
// settings, and deploy. Plain Node 22, no packages. scripts/locker-mcp.mjs serves the same work as AI tools.
//   npm run locker:connect
//   npm run locker:project -- <codename> [--name "Lunch Line"] [--pitch "..."] [--idea-url <link>]
//   npm run locker:join -- <codename>      (teammate: fetch the settings for a project you were added to)
//   npm run locker:set -- <codename> KEY=VALUE [KEY=VALUE...]   (app settings on the server, no redeploy)
//   npm run locker:env -- <codename>
//   npm run locker:status -- [codename]
//   npm run locker:logs -- <codename> [--build] [--errors] [--find "text"]
//   npm run deploy -- <codename>
// LOCKER_URL (env or kit .env) overrides the hub address. Tokens are written to .env files, never printed.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODENAME, titleCase } from "./new-app.mjs";

const DEFAULT_URL = "https://locker.bhslabs.org";
// LOCKER_KIT_ROOT lets the tests point at a throwaway folder instead of the real kit.
export const ROOT = process.env.LOCKER_KIT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_ENV = path.join(ROOT, ".env");
const appDir = (codename) => path.join(ROOT, "apps", codename);

// ---------- .env files ----------

export function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** Sets KEY=value lines in place; every other line (comments, unrelated keys) is kept as is. */
export function mergeEnv(file, values) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  if (lines.at(-1) === "") lines.pop();
  const left = new Map(Object.entries(values).filter(([, v]) => v !== undefined && v !== null));
  const next = lines.map((line) => {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (!key || !left.has(key)) return line;
    const v = left.get(key);
    left.delete(key);
    return `${key}=${v}`;
  });
  for (const [k, v] of left) next.push(`${k}=${v}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${next.join("\n")}\n`);
}

// ---------- talking to the hub ----------

// The hub's original Railway address answers too; it's the fallback if the bhslabs.org name doesn't
// resolve on this network (or hasn't finished propagating).
const FALLBACK_URL = "https://locker-production-7e62.up.railway.app";
let useFallback = false;
const configuredUrl = () => process.env.LOCKER_URL || readEnv(ROOT_ENV).LOCKER_URL;
export const hubUrl = () => (configuredUrl() || (useFallback ? FALLBACK_URL : DEFAULT_URL)).replace(/\/+$/, "");
const token = () => process.env.LOCKER_TOKEN || readEnv(ROOT_ENV).LOCKER_TOKEN;

export class HubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(method, route, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = token();
    if (!t) throw new HubError("This laptop isn't connected to the hub yet. Run: npm run locker:connect", 401);
    headers.Authorization = `Bearer ${t}`;
  }
  let res;
  const send = () => fetch(hubUrl() + route, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90_000) });
  try {
    res = await send();
  } catch (err) {
    // The default name didn't resolve: try the Railway address once, then remember it for this run.
    const notFound = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(String(err?.cause?.code ?? err?.cause?.message ?? err?.message));
    if (!configuredUrl() && !useFallback && notFound) {
      useFallback = true;
      try {
        res = await send();
      } catch {
        res = null;
      }
    }
    if (!res) throw new HubError(`Can't reach the hub at ${hubUrl()}. Check your internet. If it keeps failing, the hub isn't live yet: tell an organizer.`, 0);
  }
  const json = await res.json().catch(() => null);
  if (res.ok && json) return { status: res.status, json };
  if (json?.error) {
    if (res.status === 401) throw new HubError(`${json.error} Run: npm run locker:connect`, 401);
    throw new HubError(json.error, res.status);
  }
  // No hub-shaped error means something else answered (the hub isn't deployed at this address yet).
  throw new HubError(`The hub at ${hubUrl()} isn't answering yet (HTTP ${res.status}). Tell an organizer, then try again later.`, res.status);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function openBrowser(url) {
  if (process.env.LOCKER_NO_BROWSER) return;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* no browser: the link is printed anyway */
  }
}

// ---------- the work (exported: scripts/locker-mcp.mjs serves these as AI tools) ----------
// Each one returns data and reports progress through optional `io` callbacks, so the CLI below and the MCP server
// can word things their own way. None of them ever returns a token.

const quiet = { log: () => {}, write: () => {} };

/** What the hub's connect page shows, so the student recognises their laptop: "ana's laptop (DESKTOP-8F3K2LQ)". */
export function deviceName() {
  let user = "";
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USERNAME || process.env.USER || ""; // userInfo() can throw on some locked-down machines
  }
  const host = os.hostname();
  return (user ? `${user}'s laptop (${host})` : host).slice(0, 80);
}

/** Starts the laptop sign-in: { deviceId, code, url, interval, expiresIn }. */
export async function connectStart() {
  return (await api("POST", "/api/cli/start", { device: deviceName() }, { auth: false })).json;
}

/** One poll of the sign-in. On approval saves LOCKER_TOKEN to the kit .env and returns the status without it. */
export async function connectPoll(deviceId) {
  const { json } = await api("GET", `/api/cli/poll?deviceId=${encodeURIComponent(deviceId)}`, null, { auth: false });
  if (json.status === "approved") mergeEnv(ROOT_ENV, { LOCKER_TOKEN: json.token });
  return { status: json.status, student: json.student };
}

export const isConnected = () => Boolean(token());
export const me = async () => (await api("GET", "/api/me")).json;
export const getProject = async (codename) => (await api("GET", `/api/projects/${codename}`)).json;

export function checkCodename(codename, { mustExist = true } = {}) {
  if (!codename) throw new HubError("Which app? Add its codename, like: lunch-line", 0);
  if (!CODENAME.test(codename)) throw new HubError(`"${codename}" isn't a valid codename (3–30 lowercase letters, digits or dashes).`, 0);
  if (mustExist && !fs.existsSync(appDir(codename))) {
    throw new HubError(`apps/${codename}/ doesn't exist yet. Run first: npm run new-app -- ${codename}`, 0);
  }
  return codename;
}

async function waitReady(project, io) {
  // The host makes one new project per 30 seconds; in a rush the hub queues them (it says how many).
  const deadline = Date.now() + 15 * 60_000;
  if (project.status === "provisioning" && project.queue > 1) {
    io.log(`Lots of people are setting up right now: you're in line with ${project.queue - 1} ahead (about ${Math.ceil((project.queue * 30) / 60)} min). Keep building; this finishes by itself.`);
  }
  while (project.status === "provisioning" && Date.now() < deadline) {
    io.write(".");
    await sleep(Number(process.env.LOCKER_POLL_MS ?? 3000));
    project = await getProject(project.codename);
  }
  if (project.status === "provisioning") io.write("\n");
  if (project.status === "failed") {
    throw new HubError(`The hub couldn't finish setting up ${project.codename}${project.error ? ` (${project.error})` : ""}. Run the same command again to retry. Fails twice? Tell an organizer.`, 0);
  }
  return project;
}

/** Fetches the project's settings into apps/<codename>/.env; returns the key names written. */
export async function writeAppEnv(codename, project) {
  const { json } = await api("GET", `/api/projects/${codename}/env`);
  // APP_URL is the kit's own addition, so `npm run deploy` can print where the app lives.
  const values = { ...json.env, ...(project?.url && { APP_URL: project.url }) };
  mergeEnv(path.join(appDir(codename), ".env"), values);
  return Object.keys(values);
}

/** Creates the project on the hub (or picks up your own on a re-run) and writes its .env. */
export async function createProject({ codename, name, pitch = "", ideaUrl }, io = quiet) {
  checkCodename(codename);
  const body = { codename, name: name ?? titleCase(codename), pitch, ideaUrl };
  io.log(`Asking the hub for a home for ${body.name}. This takes 10–30 seconds…`);
  let p;
  try {
    p = (await api("POST", "/api/projects", body)).json;
  } catch (e) {
    if (e.status === 403) throw new HubError(`${e.message} Tell an organizer your school email.`, 403);
    if (e.status !== 409 && e.status !== 400) throw e;
    // Already ours (a re-run)? Then just carry on. Otherwise show the hub's message.
    const mine = await getProject(codename).catch((err) => (err.status === 404 ? "other" : null));
    if (mine === "other") {
      throw new HubError(
        `${e.message}
  "${codename}" belongs to someone else's project. If you're on that team, run: npm run locker:join -- ${codename}
  Otherwise pick a new codename.`,
        409,
      );
    }
    if (!mine) throw e;
    if (mine.role === "member") {
      throw new HubError(`You're a teammate on ${codename}, not its owner. Run: npm run locker:join -- ${codename}`, 409);
    }
    io.log(`You already have ${codename}. Fetching its settings.`);
    p = mine;
    // Its setup broke last time (a hosting hiccup): the hub can start it over.
    if (p.status === "failed") {
      io.log("Last time its setup didn't finish. Trying again…");
      p = (await api("POST", `/api/projects/${codename}/retry`)).json;
    }
  }
  p = await waitReady(p, io);
  return { project: p, keys: await writeAppEnv(codename, p) };
}

/** Teammate flow. `keys` is null when the code isn't in apps/<codename>/ yet. */
export async function joinProject(codename) {
  checkCodename(codename, { mustExist: false });
  let p;
  try {
    p = await getProject(codename);
  } catch (e) {
    if (e.status === 404) {
      throw new HubError(`You're not on ${codename}'s team yet. Ask its owner to add you on the hub page: ${hubUrl()}/p/${codename}  ("Add teammate", with your school email).`, 404);
    }
    throw e;
  }
  if (!fs.existsSync(appDir(codename))) return { project: p, keys: null };
  return { project: p, keys: await writeAppEnv(codename, p) };
}

export async function pullEnv(codename) {
  checkCodename(codename);
  const p = await getProject(codename);
  return { project: p, keys: await writeAppEnv(codename, p) };
}

// ---------- the app directory ----------

export const CATEGORIES = ["School life", "Money", "Wellbeing", "Language", "Families", "Expat life", "Games", "Clubs", "Other"];

/** Lists the app in the hub's Apps directory (or hides it with listed: false). Fields left out keep their value. Returns the listing. */
export async function saveListing(codename, fields) {
  checkCodename(codename, { mustExist: false });
  const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return (await api("PUT", `/api/projects/${codename}/listing`, body)).json;
}

/**
 * Sets the image Apps shows for the app: a PNG/JPEG/WebP/SVG file (256 KB max; the hub turns SVG into PNG),
 * or { fromApp: true } to let the hub fetch the app's own icon from its live address. Returns the listing.
 */
export async function setIcon(codename, { file, fromApp = false } = {}) {
  checkCodename(codename, { mustExist: false });
  if (fromApp) return (await api("PUT", `/api/projects/${codename}/icon`, { fetch: true })).json;
  const found = [file, path.join(appDir(codename), file ?? "")].find((f) => f && fs.existsSync(f) && fs.statSync(f).isFile());
  if (!found) throw new HubError(`Can't find the image "${file}". Give its path, like apps/${codename}/public/icon.png`, 0);
  const bytes = fs.readFileSync(found);
  if (bytes.length > 256 * 1024) throw new HubError(`That image is ${Math.ceil(bytes.length / 1024)} KB; the most is 256 KB. Export a 512×512 PNG.`, 0);
  return (await api("PUT", `/api/projects/${codename}/icon`, { data: bytes.toString("base64") })).json;
}

// ---------- tester feedback (the app's "Feedback" button, kit/locker/feedback.mjs) ----------

/** What testers sent through the app's feedback button: { summary, feedback: [...] }, newest first. */
export async function readFeedback(codename, { unread = false, limit = 50 } = {}) {
  checkCodename(codename, { mustExist: false });
  const query = new URLSearchParams({ limit: String(limit), ...(unread && { unread: "1" }) });
  return (await api("GET", `/api/projects/${codename}/feedback?${query}`)).json;
}

/** Plain-text lines for a terminal or a chat. */
export function formatFeedback(codename, { summary, feedback }) {
  const head = `${codename}: ${summary.total} feedback, ${summary.unread} new${summary.averageRating ? `, average rating ${summary.averageRating} of 5` : ""}.`;
  if (!feedback.length) return `${head}\nNothing to show yet. Turn on the Feedback button in the app (/test-with-a-friend) and share the link.`;
  const lines = feedback.map((f) => {
    const meta = [new Date(f.createdAt).toISOString().slice(0, 16).replace("T", " "), f.read ? null : "new", f.rating ? `${f.rating}/5` : null, f.page, f.contact ? `from ${f.contact}` : null].filter(Boolean);
    return `- [${meta.join(" · ")}] ${f.message.replace(/\s+/g, " ")}`;
  });
  return [head, ...lines].join("\n");
}

// ---------- deploying ----------

export const HUB_OWNED = new Set(["RAILWAY_TOKEN", "OPENROUTER_API_KEY", "LOCKER_APP_SECRET", "LOCKER_APP_ID", "LOCKER_URL"]);

// The Railway tool: the kit's own copy (npm install puts @railway/cli in node_modules/.bin, nothing
// global, no new terminal), else one on PATH. Quoted because the shell runs it and paths can have spaces.
const LOCAL_RAILWAY = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "railway.cmd" : "railway");
export const railwayBin = () => (fs.existsSync(LOCAL_RAILWAY) ? `"${LOCAL_RAILWAY}"` : "railway");

// One quoted command line for the shell. (Handing the shell separate arguments makes Node print a
// security warning, and left values with spaces or & unquoted.)
export const shellArg = (a) =>
  /^[\w@%+=:,./\\-]+$/.test(a) ? a : process.platform === "win32" ? `"${a.replaceAll('"', '""')}"` : `'${a.replaceAll("'", "'\\''")}'`;
const railway = (args, opts) => spawnSync([railwayBin(), ...args.map(shellArg)].join(" "), { ...opts, shell: true });

function railwayArgs(codename) {
  const file = path.join(appDir(codename), ".env");
  const e = readEnv(file);
  if (!e.RAILWAY_TOKEN || !e.RAILWAY_SERVICE_ID) {
    throw new HubError(`apps/${codename}/.env has no deploy settings yet. Run: npm run locker:project -- ${codename}`, 0);
  }
  const check = railway(["--version"], { encoding: "utf8" });
  if (check.status !== 0) {
    throw new HubError("The Railway tool isn't installed. Run npm install in the kit folder (it comes with the kit), then try again.", 0);
  }
  // The project token goes only into the child's environment, never onto the screen.
  return { e, childEnv: { ...process.env, RAILWAY_TOKEN: e.RAILWAY_TOKEN } };
}

/** Uploads apps/<codename>/ (railway up --detach). Returns { output, appUrl }; output has the token masked. */
export function deployApp(codename, io = quiet) {
  checkCodename(codename);
  const dir = appDir(codename);
  if (!fs.existsSync(path.join(dir, "package.json")) && !fs.existsSync(path.join(dir, "index.html"))) {
    throw new HubError(`apps/${codename}/ has no package.json or index.html yet, so there's nothing to run. Build the app first.`, 0);
  }
  const { e, childEnv } = railwayArgs(codename);
  addRequestLogging(codename, io);
  const refreshed = refreshKitFiles(codename);
  if (refreshed.length) io.log(`Updated the kit's files in your app: ${refreshed.join(", ")}. Commit them in apps/${codename}/.`);
  io.log(`Uploading apps/${codename}/ to its hosting slot. Railway builds it from source…`);
  const run = railway(["up", "--service", e.RAILWAY_SERVICE_ID, "--detach"], { cwd: dir, env: childEnv, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(e.RAILWAY_TOKEN, "***");
  io.write(output);
  // `railway up` can say "Deploy failed" and still exit 0, so read what it printed too.
  if (run.status !== 0 || /deploy(ment)? failed|error:|unauthorized/i.test(output)) {
    throw Object.assign(new HubError(`The upload didn't go through (see above). Watch the build with: npm run locker:logs -- ${codename} --build`, 0), { output });
  }
  return { output, appUrl: e.APP_URL, refreshed };
}

// Request logging (kit/locker/otel.mjs): one log line per request and per outgoing call, read with
// `npm run locker:logs`. Real OpenTelemetry once these are installed; a built-in fallback until then.
export const OTEL_PACKAGES = {
  "@opentelemetry/sdk-node": "^0.223.0",
  "@opentelemetry/sdk-trace-base": "^2.12.0",
  "@opentelemetry/instrumentation-http": "^0.223.0",
  "@opentelemetry/instrumentation-undici": "^0.33.0",
};
export const OTEL_NODE_OPTION = "--import=./locker/otel.mjs";

/**
 * Before each deploy of a Node app: refresh locker/otel.mjs from the kit, make sure package.json
 * lists the OpenTelemetry packages. The hub's start command for the project loads it.
 * LOCKER_OTEL=0 in the app's .env skips all of it.
 */
/**
 * Before each deploy: bring the kit's own files in the app up to date, but only the ones the app
 * already has (the starter app has them all): locker/gate.mjs, locker/feedback.mjs + feedback.js,
 * and the AI kit in locker/ai/. Fixes reach every app on its next deploy. Returns the paths that changed.
 */
export function refreshKitFiles(codename) {
  const dir = appDir(codename);
  const kit = (rel) => fileURLToPath(new URL(`../kit/${rel}`, import.meta.url));
  const done = [];
  // Copies only when the kit's version is different (line endings don't count), and notes what changed.
  const same = (a, b) => fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n") === fs.readFileSync(b, "utf8").replace(/\r\n/g, "\n");
  const refresh = (from, to, rel) => {
    if (same(from, to)) return;
    fs.copyFileSync(from, to);
    done.push(rel);
  };
  for (const f of ["gate.mjs", "feedback.mjs", "feedback.js", "vault.mjs", "browser.mjs"]) {
    const to = path.join(dir, "locker", f);
    if (fs.existsSync(to)) refresh(kit(`locker/${f}`), to, `locker/${f}`);
  }
  const ai = path.join(dir, "locker", "ai");
  if (fs.existsSync(path.join(ai, "index.ts"))) {
    for (const f of fs.readdirSync(kit("ai")).filter((n) => n.endsWith(".ts") && n !== "cli.ts")) {
      const to = path.join(ai, f);
      if (fs.existsSync(to)) refresh(path.join(kit("ai"), f), to, `locker/ai/${f}`);
      else {
        fs.copyFileSync(path.join(kit("ai"), f), to);
        done.push(`locker/ai/${f}`);
      }
    }
  }
  return done;
}

export function addRequestLogging(codename, io = quiet) {
  const dir = appDir(codename);
  const pkgFile = path.join(dir, "package.json");
  if (!fs.existsSync(pkgFile)) return false; // a plain HTML site has no Node process to watch
  const env = readEnv(path.join(dir, ".env"));
  if (env.LOCKER_OTEL === "0") return false;
  fs.mkdirSync(path.join(dir, "locker"), { recursive: true });
  fs.copyFileSync(fileURLToPath(new URL("../kit/locker/otel.mjs", import.meta.url)), path.join(dir, "locker", "otel.mjs"));
  const raw = fs.readFileSync(pkgFile, "utf8");
  const pkg = JSON.parse(raw);
  const missing = Object.keys(OTEL_PACKAGES).filter((name) => !pkg.dependencies?.[name]);
  if (missing.length) {
    pkg.dependencies = { ...pkg.dependencies };
    for (const name of missing) pkg.dependencies[name] = OTEL_PACKAGES[name];
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
    // The server installs them. On a laptop the app runs fine without them (otel.mjs has a built-in fallback).
    io.log(`Added the request-logging packages to apps/${codename}/package.json (the server installs them; your laptop doesn't need them). Commit that change in apps/${codename}/.`);
  }
  // The hub gives every project a start command that loads locker/otel.mjs when it's there (not a
  // NODE_OPTIONS setting: Railway hands settings to the build too, before this file exists). It runs
  // `npm start`, so the app needs a start script.
  if (!pkg.scripts?.start) io.log(`Heads up: package.json has no "start" script, so the server won't know how to run the app. Add one, like "start": "node server.js".`);
  return true;
}

export const LOCAL_TEST_USER = "Test Student <test.student@example.org>";

/** Sets app settings on the server (no redeploy) and in apps/<codename>/.env. Returns the key names. */
export function setSettings(codename, values, io = quiet) {
  checkCodename(codename);
  for (const key of Object.keys(values)) {
    if (HUB_OWNED.has(key)) throw new HubError(`${key} comes from the hub, so you can't set it here. Run: npm run locker:env -- ${codename}`, 0);
    if (key === "LOCKER_GATE_USER") throw new HubError(`LOCKER_GATE_USER is only for your laptop: put it in apps/${codename}/.env, not on the server.`, 0);
  }
  const { e, childEnv } = railwayArgs(codename);
  const sets = Object.entries(values).flatMap(([k, v]) => ["--set", `${k}=${v}`]);
  const run = railway(["variables", "--service", e.RAILWAY_SERVICE_ID, ...sets, "--skip-deploys"], { cwd: appDir(codename), env: childEnv, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(e.RAILWAY_TOKEN, "***");
  io.write(output);
  if (run.status !== 0 || /error|unauthorized/i.test(output)) {
    throw Object.assign(new HubError("Railway didn't accept the settings (see above).", 0), { output });
  }
  const envFile = path.join(appDir(codename), ".env");
  mergeEnv(envFile, values);
  // School sign-in on: locally the gate acts signed in as a test user, so the laptop never bounces to the hub.
  if (values.LOCKER_GATE === "1" && !readEnv(envFile).LOCKER_GATE_USER) {
    mergeEnv(envFile, { LOCKER_GATE_USER: `"${LOCAL_TEST_USER}"` });
    io.log(`On your laptop you're signed in as ${LOCAL_TEST_USER} (LOCKER_GATE_USER in apps/${codename}/.env; change it or delete it). Online, people sign in with their school account.`);
  }
  return Object.keys(values);
}

/** The last `lines` log lines (build or runtime), token masked. Fetches instead of streaming, for tools. */
/** Railway log flags: build logs, only errors (the request log marks failures level "error"), or a text search. */
export function logFlags({ build = false, errors = false, find } = {}) {
  const filter = [errors && "@level:error", find && String(find).replaceAll('"', "").trim()].filter(Boolean).join(" ");
  return [...(build ? ["--build"] : []), ...(filter ? ["--filter", filter] : [])];
}

export function readLogs(codename, { build = false, lines = 50, errors = false, find } = {}) {
  checkCodename(codename);
  const { e, childEnv } = railwayArgs(codename);
  const extra = logFlags({ build, errors, find });
  const run = railway(["logs", "--service", e.RAILWAY_SERVICE_ID, ...extra, "--lines", String(lines)], { cwd: appDir(codename), env: childEnv, encoding: "utf8", timeout: 60_000 });
  return `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(e.RAILWAY_TOKEN, "***");
}

// ---------- the CLI ----------

const cli = { log: (s) => console.log(s), write: (s) => process.stdout.write(s) };

function needCodename(args, opts) {
  return checkCodename(args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")), opts);
}

const flag = (args, name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const wrote = (codename, keys) => console.log(`✓ Wrote ${keys.length} settings to apps/${codename}/.env (${keys.join(", ")}). Never commit it.`);

async function connect() {
  const start = await connectStart();
  const spaced = start.code.split("").join(" ");
  const bar = "═".repeat(spaced.length + 8);
  console.log(`\nOpening the hub in your browser. Sign in with your school Google account.`);
  console.log(`Check the code matches, then click Connect.\n`);
  console.log(`  ╔${bar}╗\n  ║    ${spaced}    ║\n  ╚${bar}╝\n`);
  console.log(`Browser didn't open? Go to: ${start.url}\n`);
  openBrowser(start.url);

  const deadline = Date.now() + (start.expiresIn ?? 900) * 1000;
  while (Date.now() < deadline) {
    await sleep((start.interval ?? 3) * 1000);
    const r = await connectPoll(start.deviceId);
    if (r.status === "approved") {
      console.log(`✓ Connected as ${r.student?.name ?? "you"} (${r.student?.email ?? "?"}). Saved to .env.`);
      console.log(`Next: npm run locker:project -- <codename>`);
      return;
    }
    if (r.status === "expired") break;
  }
  throw new HubError("The code expired before it was approved. Run npm run locker:connect again.", 0);
}

async function project(args) {
  const codename = needCodename(args);
  const { project: p, keys } = await createProject({ codename, name: flag(args, "name"), pitch: flag(args, "pitch") ?? "", ideaUrl: flag(args, "idea-url") }, cli);
  wrote(codename, keys);
  printProject(p);
  console.log(`\nNext: build it, then ship it with: npm run deploy -- ${codename}`);
}

function printProject(p) {
  const role = p.role === "member" ? " [teammate]" : p.role === "owner" ? " [owner]" : "";
  console.log(`
${p.name} (${p.codename}): ${p.status}${role}`);
  if (p.url) console.log(`  Live address:   ${p.url}`);
  if (p.ai) console.log(`  AI budget:      $${(p.ai.usedUsd ?? 0).toFixed(2)} used of $${p.ai.monthlyLimitUsd} this month`);
  if (p.costs) console.log(`  Hosting cost:   $${(p.costs.railwayUsdThisMonth ?? 0).toFixed(2)} this month`);
  if (p.railway?.inviteUrl) console.log(`  See logs in Railway (optional, free account): ${p.railway.inviteUrl}`);
}

async function join(args) {
  const codename = needCodename(args, { mustExist: false });
  const { project: p, keys } = await joinProject(codename);
  console.log(`✓ You're on ${p.name} (${codename}).`);
  if (!keys) {
    console.log(`
You need the code first. Ask the owner for the GitHub link, then in Cursor/Claude type:`);
    console.log(`  /bring-my-app <link>   (it clones the code into apps/${codename}/)`);
    console.log(`Then run this again: npm run locker:join -- ${codename}`);
    return;
  }
  wrote(codename, keys);
  printProject(p);
  console.log(`
Next: run it locally. Both of you can ship it with: npm run deploy -- ${codename} (agree who ships; commit and pull first).`);
}

async function env(args) {
  const codename = needCodename(args);
  wrote(codename, (await pullEnv(codename)).keys);
}

async function status(args) {
  if (args[0]) {
    printProject(await getProject(needCodename(args, { mustExist: false })));
    return;
  }
  const json = await me();
  console.log(`Connected as ${json.student?.name} (${json.student?.email}) to ${hubUrl()}`);
  if (!json.projects?.length) return console.log("No projects yet. Make one: npm run locker:project -- <codename>");
  for (const p of json.projects) printProject(p);
}

function deploy(args) {
  const codename = needCodename(args);
  const { appUrl } = deployApp(codename, cli);
  console.log(`\n✓ Uploaded. The build takes 1–3 minutes.`);
  if (appUrl) {
    console.log(`  Until it's built, the address may say "Application not found" (or show the old version). That's normal.`);
    console.log(`  Then open: ${appUrl}  (it's live when ${appUrl}/health says ok)`);
  }
  console.log(`  Watch it build: npm run locker:logs -- ${codename} --build`);
  console.log(`  Watch it run:   npm run locker:logs -- ${codename}`);
}

function set(args) {
  const codename = needCodename(args);
  const pairs = args.filter((a) => a !== codename);
  if (!pairs.length) throw new HubError(`Which settings? Like: npm run locker:set -- ${codename} LOCKER_GATE=1`, 0);
  const values = {};
  for (const pair of pairs) {
    const m = pair.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
    if (!m) throw new HubError(`"${pair.split("=")[0]}" needs a value, written KEY=VALUE.`, 0);
    if (HUB_OWNED.has(m[1])) throw new HubError(`${m[1]} comes from the hub, so you can't set it here. Run: npm run locker:env -- ${codename}`, 0);
    values[m[1]] = m[2];
  }
  const keys = setSettings(codename, values, cli);
  console.log(`Saved ${keys.join(", ")}. They apply on your next deploy (npm run deploy -- ${codename}).`);
}

// The hub's Apps categories (the hub's docs/contract.md, PUT /api/projects/:codename/listing).
export const LIST_CATEGORIES = ["School life", "Money", "Wellbeing", "Language", "Families", "Expat life", "Games", "Clubs", "Other"];
const listUsage = (codename) => `Usage: npm run locker:list -- ${codename} --tagline "One line that says what it does" --category "School life"
         [--description "A few sentences"] [--icon "L"] [--icon-file public/icon.png | --icon-from-app] [--school-only] [--off]
Categories: ${LIST_CATEGORIES.join(", ")}`;

async function list(args) {
  const codename = needCodename(args, { mustExist: false });
  const off = args.includes("--off");
  let category = flag(args, "category");
  if (category !== undefined) {
    category = LIST_CATEGORIES.find((c) => c.toLowerCase() === String(category).trim().toLowerCase());
    if (!category) throw new HubError(`"${flag(args, "category")}" isn't a category.\n${listUsage(codename)}`, 0);
  }
  let l;
  try {
    l = await saveListing(codename, {
      listed: !off,
      tagline: flag(args, "tagline"),
      description: flag(args, "description"),
      category,
      icon: flag(args, "icon"),
      bhsOnly: args.includes("--school-only") ? true : undefined,
    });
  } catch (err) {
    if (err instanceof HubError && err.status === 400) err.message += `\n${listUsage(codename)}`;
    throw err;
  }
  if (flag(args, "icon-file") || args.includes("--icon-from-app")) {
    await setIcon(codename, { file: flag(args, "icon-file"), fromApp: args.includes("--icon-from-app") });
    console.log(`✓ Apps shows ${codename}'s own image now (instead of the emoji).`);
  }
  if (!l.listed) return console.log(`✓ ${codename} isn't listed in Apps anymore. List it again with: npm run locker:list -- ${codename}`);
  console.log(`✓ ${codename} is listed in Apps: ${l.icon ? `${l.icon} ` : ""}${l.tagline} (${l.category}).`);
  console.log(`  Everyone finds it at ${hubUrl()}/apps. Opens and installs: ${hubUrl()}/p/${codename}`);
}

async function feedbackCmd(args) {
  const codename = needCodename(args, { mustExist: false });
  const data = await readFeedback(codename, { unread: args.includes("--new"), limit: Number(flag(args, "limit") ?? 50) });
  console.log(formatFeedback(codename, data));
  console.log(`\nMark it read or delete it on ${hubUrl()}/p/${codename}#feedback`);
}

// ---------- bring an app hosted elsewhere (an organizer approves it on the hub) ----------

/** Asks to bring an app the student hosts elsewhere: { id, codename, status, verify: { file, token } }. */
export async function requestApp({ codename, name, url, pitch }) {
  checkCodename(codename, { mustExist: false });
  return (await api("POST", "/api/app-requests", { codename, name, url, pitch })).json;
}

export const myAppRequests = async () => (await api("GET", "/api/app-requests")).json.requests;

async function bring(args) {
  if (!args.length) {
    const reqs = await myAppRequests();
    if (!reqs.length) return console.log('No requests yet. Ask with: npm run locker:bring -- <codename> --url https://your-app.example.com --name "Your App"');
    for (const r of reqs) console.log(`${r.name} (${r.codename}): ${r.status}${r.note ? ` (${r.note})` : ""}  ${r.url}`);
    return;
  }
  const codename = needCodename(args, { mustExist: false });
  const url = flag(args, "url");
  if (!url) throw new HubError(`Where does it live? Add its address: npm run locker:bring -- ${codename} --url https://your-app.example.com`, 0);
  const r = await requestApp({ codename, url, name: flag(args, "name"), pitch: flag(args, "pitch") });
  console.log(`✓ Asked to bring ${r.name} (${r.codename}) from ${r.url}. An organizer approves it on the hub; you'll get an email.`);
  console.log(`  Optional, makes approval quicker: prove it's yours by serving this line at ${r.verify.file}:`);
  console.log(`    ${r.verify.token}`);
  console.log(`  Check where it stands: npm run locker:bring`);
}

function logs(args) {
  const codename = needCodename(args);
  const { e, childEnv } = railwayArgs(codename);
  const extra = logFlags({ build: args.includes("--build"), errors: args.includes("--errors"), find: flag(args, "find") });
  const run = railway(["logs", "--service", e.RAILWAY_SERVICE_ID, ...extra], { cwd: appDir(codename), env: childEnv, stdio: "inherit" });
  process.exitCode = run.status ?? 1;
}

// ---------- main ----------

const COMMANDS = { connect, project, join, set, env, status, deploy, logs, list, feedback: feedbackCmd, bring };
const [cmd, ...rest] = process.argv.slice(2);

if (process.argv[1]?.endsWith("locker.mjs")) {
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("Usage: node scripts/locker.mjs <connect|project|join|set|env|status|deploy|logs|list|feedback> [codename]");
    process.exit(1);
  }
  Promise.resolve().then(() => fn(rest)).catch((err) => {
    console.error(`✗ ${err instanceof HubError ? err.message : err.stack}`);
    process.exit(1);
  });
}

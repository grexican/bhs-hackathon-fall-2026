#!/usr/bin/env node
// Talks to the incubator hub (the Locker): connect this laptop, create a project (hosting + AI key), fetch its
// settings, and deploy. Plain Node 22, no packages. scripts/locker-mcp.mjs serves the same work as AI tools.
//   npm run locker:connect
//   npm run locker:project -- <codename> [--name "Lunch Line"] [--pitch "..."] [--idea-url <link>]
//   npm run locker:join -- <codename>      (teammate: fetch the settings for a project you were added to)
//   npm run locker:set -- <codename> KEY=VALUE [KEY=VALUE...]   (app settings on the server, no redeploy)
//   npm run locker:env -- <codename>
//   npm run locker:status -- [codename]
//   npm run locker:logs -- <codename> [--build]
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

/** Starts the laptop sign-in: { deviceId, code, url, interval, expiresIn }. */
export async function connectStart() {
  return (await api("POST", "/api/cli/start", { device: os.hostname() }, { auth: false })).json;
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
  const deadline = Date.now() + 120_000;
  while (project.status === "provisioning" && Date.now() < deadline) {
    io.write(".");
    await sleep(Number(process.env.LOCKER_POLL_MS ?? 3000));
    project = await getProject(project.codename);
  }
  if (project.status === "provisioning") io.write("\n");
  if (project.status === "failed") throw new HubError("The hub couldn't finish setting up this project. Tell an organizer.", 0);
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

// ---------- deploying ----------

export const HUB_OWNED = new Set(["RAILWAY_TOKEN", "OPENROUTER_API_KEY", "LOCKER_APP_SECRET", "LOCKER_APP_ID", "LOCKER_URL"]);

function railwayArgs(codename) {
  const file = path.join(appDir(codename), ".env");
  const e = readEnv(file);
  if (!e.RAILWAY_TOKEN || !e.RAILWAY_SERVICE_ID) {
    throw new HubError(`apps/${codename}/.env has no deploy settings yet. Run: npm run locker:project -- ${codename}`, 0);
  }
  const check = spawnSync("railway", ["--version"], { shell: true, encoding: "utf8" });
  if (check.status !== 0) {
    throw new HubError("The Railway tool isn't installed. Install it with: npm i -g @railway/cli  (then open a new terminal and try again)", 0);
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
  io.log(`Uploading apps/${codename}/ to its hosting slot. Railway builds it from source…`);
  const run = spawnSync("railway", ["up", "--service", e.RAILWAY_SERVICE_ID, "--detach"], { cwd: dir, env: childEnv, shell: true, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(e.RAILWAY_TOKEN, "***");
  io.write(output);
  // `railway up` can say "Deploy failed" and still exit 0, so read what it printed too.
  if (run.status !== 0 || /deploy(ment)? failed|error:|unauthorized/i.test(output)) {
    throw Object.assign(new HubError(`The upload didn't go through (see above). Watch the build with: npm run locker:logs -- ${codename} --build`, 0), { output });
  }
  return { output, appUrl: e.APP_URL };
}

/** Sets app settings on the server (no redeploy) and in apps/<codename>/.env. Returns the key names. */
export function setSettings(codename, values, io = quiet) {
  checkCodename(codename);
  for (const key of Object.keys(values)) {
    if (HUB_OWNED.has(key)) throw new HubError(`${key} comes from the hub, so you can't set it here. Run: npm run locker:env -- ${codename}`, 0);
  }
  const { e, childEnv } = railwayArgs(codename);
  const sets = Object.entries(values).flatMap(([k, v]) => ["--set", `${k}=${v}`]);
  const run = spawnSync("railway", ["variables", "--service", e.RAILWAY_SERVICE_ID, ...sets, "--skip-deploys"], { cwd: appDir(codename), env: childEnv, shell: true, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(e.RAILWAY_TOKEN, "***");
  io.write(output);
  if (run.status !== 0 || /error|unauthorized/i.test(output)) {
    throw Object.assign(new HubError("Railway didn't accept the settings (see above).", 0), { output });
  }
  mergeEnv(path.join(appDir(codename), ".env"), values);
  return Object.keys(values);
}

/** The last `lines` log lines (build or runtime), token masked. Fetches instead of streaming, for tools. */
export function readLogs(codename, { build = false, lines = 50 } = {}) {
  checkCodename(codename);
  const { e, childEnv } = railwayArgs(codename);
  const extra = build ? ["--build"] : [];
  const run = spawnSync("railway", ["logs", "--service", e.RAILWAY_SERVICE_ID, ...extra, "--lines", String(lines)], { cwd: appDir(codename), env: childEnv, shell: true, encoding: "utf8", timeout: 60_000 });
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
  if (appUrl) console.log(`  Then open: ${appUrl}  (check ${appUrl}/health says ok)`);
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

async function list(args) {
  const codename = needCodename(args, { mustExist: false });
  const off = args.includes("--off");
  const l = await saveListing(codename, {
    listed: !off,
    tagline: flag(args, "tagline"),
    description: flag(args, "description"),
    category: flag(args, "category"),
    icon: flag(args, "icon"),
    bhsOnly: args.includes("--school-only") ? true : undefined,
  });
  if (!l.listed) return console.log(`✓ ${codename} isn't listed in Apps anymore. List it again with: npm run locker:list -- ${codename}`);
  console.log(`✓ ${codename} is listed in Apps: ${l.icon ? `${l.icon} ` : ""}${l.tagline} (${l.category}).`);
  console.log(`  Everyone finds it at ${hubUrl()}/apps. Opens and installs: ${hubUrl()}/p/${codename}`);
}

function logs(args) {
  const codename = needCodename(args);
  const { e, childEnv } = railwayArgs(codename);
  const extra = args.includes("--build") ? ["--build"] : [];
  const run = spawnSync("railway", ["logs", "--service", e.RAILWAY_SERVICE_ID, ...extra], { cwd: appDir(codename), env: childEnv, shell: true, stdio: "inherit" });
  process.exitCode = run.status ?? 1;
}

// ---------- main ----------

const COMMANDS = { connect, project, join, set, env, status, deploy, logs, list };
const [cmd, ...rest] = process.argv.slice(2);

if (process.argv[1]?.endsWith("locker.mjs")) {
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("Usage: node scripts/locker.mjs <connect|project|join|set|env|status|deploy|logs|list> [codename]");
    process.exit(1);
  }
  Promise.resolve().then(() => fn(rest)).catch((err) => {
    console.error(`✗ ${err instanceof HubError ? err.message : err.stack}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
// Checks this laptop has what the kit needs, and says exactly how to fix anything that's missing.
//   npm run doctor
// ✓ = fine, ✗ = needs fixing (one fix each), – = not needed yet. Exit code 1 when something is ✗.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.LOCKER_KIT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";
const MIN_NODE = [22, 18];

/** Runs a command and returns its trimmed output, or null when it can't run. */
function run(cmd, args = []) {
  // One command string (fixed text, no user input): the shell finds npm.cmd, git.exe and friends on every OS.
  const r = spawnSync([cmd, ...args].join(" "), { shell: true, encoding: "utf8", timeout: 20_000 });
  return r.status === 0 ? `${r.stdout ?? ""}`.trim() : null;
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
  );
}

export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok
    ? { ok: true, label: `Node ${version}` }
    : { ok: false, label: `Node ${version} is too old (needs 22.18 or newer)`, fix: "Install the LTS version from https://nodejs.org, then open a new terminal." };
}

export async function checkSqlite() {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    new DatabaseSync(":memory:").close();
    return { ok: true, label: "SQLite database built into Node" };
  } catch {
    return { ok: false, label: "SQLite (node:sqlite) isn't available", fix: "Update Node to the LTS version from https://nodejs.org." };
  }
}

export function checkGit() {
  const version = run("git", ["--version"]);
  if (!version) return { ok: false, label: "git isn't installed", fix: WINDOWS ? "Install it from https://git-scm.com/download/win (all the default options are fine), then open a new terminal." : "Run: xcode-select --install   (or install from https://git-scm.com)" };
  const name = run("git", ["config", "user.name"]);
  const email = run("git", ["config", "user.email"]);
  if (!name || !email) {
    return { ok: false, label: `${version}, but it doesn't know who you are yet`, fix: 'Run (with your own name and email): git config --global user.name "Your Name"  and  git config --global user.email "you@example.com"' };
  }
  return { ok: true, label: `${version} (you're ${name})` };
}

export function checkNpm() {
  const version = run("npm", ["--version"]);
  return version ? { ok: true, label: `npm ${version}` } : { ok: false, label: "npm doesn't run", fix: "Reinstall Node from https://nodejs.org (npm comes with it), then open a new terminal." };
}

export function checkInstalled(root = ROOT) {
  const ok = fs.existsSync(path.join(root, "node_modules", "@modelcontextprotocol", "sdk"));
  return ok ? { ok: true, label: "Kit packages installed" } : { ok: false, label: "Kit packages aren't installed yet", fix: "Run: npm install   (in this folder)" };
}

export function checkRailway(root = ROOT) {
  // The kit brings its own copy (@railway/cli in node_modules); scripts/locker.mjs uses it first.
  const local = path.join(root, "node_modules", ".bin", WINDOWS ? "railway.cmd" : "railway");
  const version = run(fs.existsSync(local) ? `"${local}"` : "railway", ["--version"]);
  return version
    ? { ok: true, label: `Railway tool ${version.replace(/^railway\s*/i, "")} (for putting apps online)` }
    : { ok: false, label: "Railway tool missing (needed to put your app online and read its logs)", fix: "Run: npm install   (in the kit folder; the Railway tool comes with the kit)" };
}

export function checkHub(root = ROOT) {
  const env = { ...readEnv(path.join(root, ".env")) };
  return env.LOCKER_TOKEN
    ? { ok: true, label: "Connected to the incubator hub" }
    : { ok: null, label: "Not connected to the incubator hub yet", fix: "Not needed to build. When you want your app online: /connect (or npm run locker:connect)." };
}

/**
 * Python runs the design data lookups (palettes, font pairings, styles: .claude/skills/ui-ux-pro-max/scripts/search.py).
 * Windows often has a fake "python" that opens the Microsoft Store, so try the real launchers in order.
 * probe(cmd) returns the version text or null; injectable for tests.
 */
export function checkPython(probe = (cmd) => run(cmd, ["--version"])) {
  const tries = WINDOWS ? ["py -3", "python", "python3"] : ["python3", "python"];
  for (const cmd of tries) {
    const out = probe(cmd);
    const version = out?.match(/Python (3\.\d+(?:\.\d+)?)/)?.[1];
    if (version) return { ok: true, label: `Python ${version} (for the design lookups; use \`${cmd}\`)` };
  }
  return {
    ok: false,
    label: "Python 3 isn't installed (the design skills use it to look up palettes and font pairings)",
    fix: WINDOWS ? "Run: winget install -e --id Python.Python.3.13   then open a new terminal (and use py -3)." : "Run: brew install python   (or install from https://www.python.org/downloads/)",
  };
}

/** Says whether this copy of the kit is behind the event's branch online (new skills, fixes). Never pulls. */
export function kitStaleness(behind, branch) {
  if (behind === null) return null;
  return behind > 0
    ? { ok: null, label: `The kit is ${behind} update${behind === 1 ? "" : "s"} behind (new skills or fixes)`, fix: `Save your work first (/wrap), then: git pull origin ${branch}   (ask your AI if it says "conflict").` }
    : { ok: true, label: "The kit is up to date" };
}

export function checkKitFresh(root = ROOT) {
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 10_000 });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  if (git("rev-parse", "--is-inside-work-tree") !== "true" || git("rev-parse", "--show-toplevel") === null) return null;
  // The event's branch is what the clone started from (origin/HEAD). Offline or no remote: skip quietly.
  const head = git("rev-parse", "--abbrev-ref", "origin/HEAD");
  if (!head || git("fetch", "--quiet", "origin") === null) return null;
  const behind = Number(git("rev-list", "--count", `HEAD..${head}`));
  return kitStaleness(Number.isFinite(behind) ? behind : null, head.replace(/^origin\//, ""));
}

/** Windows only: PowerShell's default policy blocks npm with "running scripts is disabled on this system". */
export function checkPowerShell() {
  if (!WINDOWS) return null;
  const policy = run("powershell", ["-NoProfile", "-Command", "Get-ExecutionPolicy"]);
  if (!policy) return null;
  const blocked = /^(Restricted|AllSigned|Undefined)$/i.test(policy);
  return blocked
    ? { ok: false, label: `PowerShell blocks npm (policy: ${policy}): "running scripts is disabled on this system"`, fix: "In PowerShell run: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force   then open a new terminal. Until then, type npm.cmd instead of npm." }
    : { ok: true, label: `PowerShell lets npm run (policy: ${policy})` };
}

export async function checks(root = ROOT) {
  return [checkNode(), await checkSqlite(), checkNpm(), checkInstalled(root), checkGit(), checkPowerShell(), checkPython(), checkRailway(root), checkHub(root), checkKitFresh(root)].filter(Boolean);
}

async function main() {
  console.log("Checking this laptop for the kit…\n");
  const results = await checks();
  for (const r of results) {
    console.log(`${r.ok === true ? "✓" : r.ok === false ? "✗" : "–"} ${r.label}`);
    if (r.ok !== true && r.fix) console.log(`    ${r.ok === false ? "Fix" : "Later"}: ${r.fix}`);
  }
  const bad = results.filter((r) => r.ok === false).length;
  console.log(bad ? `\n${bad} thing${bad === 1 ? "" : "s"} to fix. Fix them one by one, then run npm run doctor again.` : "\nAll good. Type /start in the chat to build something.");
  process.exitCode = bad ? 1 : 0;
}

if (process.argv[1]?.endsWith("doctor.mjs")) main();

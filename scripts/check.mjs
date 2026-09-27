#!/usr/bin/env node
// Repo hygiene gate. Runs in the pre-commit hook (staged files) and as `npm run check` (everything).
//   1. No secrets (API keys, tokens, private keys) in files headed for git.
//   2. Skills and agents are well-formed and Cursor mirrors are fresh.
//   3. The local-only name guard, when this machine has one configured.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGED = process.argv.includes("--staged");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

const files = (STAGED ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR") : git("ls-files", "--cached", "--others", "--exclude-standard"))
  .split("\n")
  .filter(Boolean);

const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic API key"],
  [/sk-(proj-)?[A-Za-z0-9_-]{32,}/, "OpenAI-style API key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
];
const BLOCKED_FILES = [/(^|\/)\.env(\..+)?$/, /\.db$/, /(^|\/)node_modules\//];
const SKIP = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|mp[34]|wav|glb)$|package-lock\.json$/i;

const problems = [];
for (const file of files) {
  if (BLOCKED_FILES.some((re) => re.test(file)) && !file.endsWith(".env.example")) {
    problems.push(`${file}: this file must never be committed`);
    continue;
  }
  const abs = path.join(ROOT, file);
  if (SKIP.test(file) || !fs.existsSync(abs) || fs.statSync(abs).size > 2_000_000) continue;
  const text = fs.readFileSync(abs, "utf8");
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(text)) problems.push(`${file}: looks like it contains a ${label}. Move it to .env.`);
  }
}

const run = (script, ...args) => spawnSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { cwd: ROOT, stdio: "inherit" }).status;
if (run("sync-agents.mjs", "--check") !== 0) problems.push("skills/agents check failed (see above)");
if (run("check-provenance.mjs", STAGED ? "--staged" : "--all", "--if-configured") !== 0) problems.push("name guard failed (see above)");

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`check: clean (${files.length} files)`);

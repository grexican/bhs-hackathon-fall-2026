#!/usr/bin/env node
/**
 * Hygiene gate: keeps references to systems outside this codebase from landing
 * in source, comments, or commit messages.
 *
 * This repository should read as a self-contained product. Stray mentions of
 * unrelated internal systems, scratch paths, or prior workspaces are noise at
 * best and confusing to a new reader at worst.
 *
 * Terms are intentionally NOT stored here. The scanner loads them from an
 * untracked local file or from the environment, so the term list itself never
 * becomes part of the published history.
 *
 *   .provenance-terms   one pattern per line, # comments allowed   (untracked)
 *   PROVENANCE_TERMS    newline- or comma-separated, for CI
 *
 * Usage:
 *   node scripts/check-provenance.mjs            # working tree
 *   node scripts/check-provenance.mjs --staged   # staged changes only
 *   node scripts/check-provenance.mjs --history  # every commit message + author
 *   node scripts/check-provenance.mjs --all      # all of the above
 *   node scripts/check-provenance.mjs --message <file>  # a commit message (commit-msg hook)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
// Linked worktrees (demo builds) share the main checkout's untracked term list.
const mainRoot = join(execSync("git rev-parse --path-format=absolute --git-common-dir", { encoding: "utf8" }).trim(), "..");
const localFile = (name) => [join(root, name), join(mainRoot, name)].find((p) => existsSync(p));
const args = new Set(process.argv.slice(2));
const mode = {
  staged: args.has("--staged") || args.has("--all"),
  history: args.has("--history") || args.has("--all"),
  tree: args.has("--all") || (!args.has("--staged") && !args.has("--history") && !args.has("--message")),
};

function loadTerms() {
  const raw =
    process.env.PROVENANCE_TERMS ??
    (localFile(".provenance-terms") ? readFileSync(localFile(".provenance-terms"), "utf8") : "");
  return raw
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((pattern) => new RegExp(pattern, "gi"));
}

/**
 * Scoped suppressions, so a legitimate third-party mention does not train
 * everyone to ignore this tool. Format: `<path-prefix>|<regex>`.
 */
function loadAllows() {
  const raw =
    process.env.PROVENANCE_ALLOW ??
    (localFile(".provenance-allow") ? readFileSync(localFile(".provenance-allow"), "utf8") : "");
  return raw
    .split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return null;
      return {
        prefix: line.slice(0, separator),
        pattern: new RegExp(line.slice(separator + 1), "i"),
      };
    })
    .filter(Boolean);
}

const TERMS = loadTerms();
const ALLOWS = loadAllows();

function isAllowed(label, matched) {
  return ALLOWS.some((rule) => label.startsWith(rule.prefix) && rule.pattern.test(matched));
}
// Student clones have no term list; hooks pass --if-configured so they stay silent there.
if (TERMS.length === 0 && args.has("--if-configured")) process.exit(0);
if (TERMS.length === 0) {
  console.error(
    "check-provenance: no term list found. Create .provenance-terms (untracked) or set PROVENANCE_TERMS.",
  );
  process.exit(2);
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".turbo", "coverage"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|mp4|lockb?)$/i;
const SELF = "scripts/check-provenance.mjs";

function listTrackedFiles() {
  const out = execSync("git ls-files --cached --others --exclude-standard", {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\n").filter(Boolean);
}

function listStagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    cwd: root,
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

const findings = [];

function scanText(label, text) {
  for (const term of TERMS) {
    term.lastIndex = 0;
    let match;
    // biome-ignore lint/suspicious/noAssignInExpressions: the canonical exec loop; lastIndex is what advances it
    while ((match = term.exec(text)) !== null) {
      const before = text.slice(0, match.index);
      const line = before.split("\n").length;
      const lineText = text.split("\n")[line - 1] ?? "";
      if (!isAllowed(label, match[0])) {
        findings.push({ label, line, match: match[0], context: lineText.trim().slice(0, 160) });
      }
      if (!term.global) break;
    }
  }
}

function scanFiles(files) {
  for (const rel of files) {
    if (rel === SELF) continue;
    if (BINARY.test(rel)) continue;
    if (rel.split("/").some((part) => SKIP_DIRS.has(part))) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    try {
      if (statSync(abs).size > 2 * 1024 * 1024) continue;
      scanText(rel, readFileSync(abs, "utf8"));
    } catch {
      /* unreadable or binary; nothing to check */
    }
  }
}

if (mode.tree) scanFiles(listTrackedFiles());
if (mode.staged) scanFiles(listStagedFiles());

if (mode.history) {
  let log = "";
  try {
    log = execSync("git log --format=%H%x00%an%x00%ae%x00%B%x00---END---", {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    log = "";
  }
  for (const entry of log.split("---END---")) {
    const [sha, name, email, body] = entry.split("\0");
    if (!sha) continue;
    scanText(`commit ${sha.trim().slice(0, 8)}`, [name, email, body].filter(Boolean).join("\n"));
  }
}

// commit-msg hook: node scripts/check-provenance.mjs --message <file>
const messageArg = process.argv.indexOf("--message");
if (messageArg > 0) scanText("commit message", readFileSync(process.argv[messageArg + 1], "utf8"));

if (findings.length > 0) {
  console.error(`\ncheck-provenance: ${findings.length} reference(s) that must not ship:\n`);
  for (const f of findings) {
    console.error(`  ${f.label}:${f.line}  "${f.match}"`);
    console.error(`      ${f.context}`);
  }
  console.error(
    "\nRemove these before committing. For commit messages already written, rewrite the history.\n",
  );
  process.exit(1);
}

console.log(`check-provenance: clean (${TERMS.length} patterns checked).`);

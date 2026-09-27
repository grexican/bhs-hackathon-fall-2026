#!/usr/bin/env node
// Refreshes vendored third-party skills from skills.manifest.json.
//
//   npm run skills:outdated          which vendored skills have newer upstream commits
//   npm run skills:sync -- <name…>   pull the latest upstream copy of those skills
//   npm run skills:sync -- --all     pull every vendored skill
//
// Vendored (not installed as plugins) because Cursor only reads skill files from the repo.
// Local edits are listed under "patches" in the manifest. After a sync, re-apply them and
// review with `git diff .claude/`, since upstream text replaces ours.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "skills.manifest.json");
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const args = process.argv.slice(2);
const vendored = manifest.skills.filter((s) => /^https?:\/\//.test(s.source ?? ""));
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const headOf = new Map();
const upstreamHead = (source) => {
  if (!headOf.has(source)) headOf.set(source, git("ls-remote", source, "HEAD").split(/\s/)[0]);
  return headOf.get(source);
};

if (args.includes("--check") || !args.length) {
  let outdated = 0;
  for (const s of vendored) {
    try {
      const head = upstreamHead(s.source);
      if (s.ref && head !== s.ref) {
        outdated++;
        console.log(`${s.name.padEnd(28)} ${s.ref.slice(0, 7)} → ${head.slice(0, 7)}  ${s.source}`);
      }
    } catch {
      console.log(`${s.name.padEnd(28)} could not reach ${s.source}`);
    }
  }
  console.log(outdated ? `\n${outdated} outdated. Update with: npm run skills:sync -- <name>` : "All vendored skills are current.");
  process.exit(0);
}

const wanted = args.includes("--all") ? vendored : vendored.filter((s) => args.includes(s.name));
if (!wanted.length) {
  console.error("No matching vendored skill. Names are in skills.manifest.json.");
  process.exit(1);
}

const clones = new Map();
const cloneOf = (source) => {
  if (!clones.has(source)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"));
    git("clone", "--depth", "1", "--quiet", source, dir);
    clones.set(source, dir);
  }
  return clones.get(source);
};

for (const s of wanted) {
  const src = path.join(cloneOf(s.source), s.path);
  if (!fs.existsSync(src)) {
    console.error(`✗ ${s.name}: ${s.path} no longer exists upstream. Check ${s.source}`);
    continue;
  }
  const kind = s.kind === "agent" ? "agents" : "skills";
  const dest = kind === "agents" ? path.join(ROOT, ".claude", "agents", `${s.name}.md`) : path.join(ROOT, ".claude", "skills", s.name);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  for (const ex of s.exclude ?? []) fs.rmSync(path.join(dest, ex), { recursive: true, force: true });
  s.ref = git("-C", cloneOf(s.source), "rev-parse", "HEAD");
  console.log(`✓ ${s.name} @ ${s.ref.slice(0, 7)}`);
  for (const p of s.patches ?? []) console.log(`    re-apply: ${p}`);
}

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
for (const dir of clones.values()) fs.rmSync(dir, { recursive: true, force: true });
console.log("\nReview with `git diff .claude/`, re-apply the patches listed, then `npm run agents:sync`.");

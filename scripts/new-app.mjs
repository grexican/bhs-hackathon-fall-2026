#!/usr/bin/env node
// Creates apps/<codename>/ as its own git repo, ready for /start to build in.
//   npm run new-app -- lunch-line [--name "Lunch Line"] [--bare]
// By default it holds the starter app (kit/app-template): a tiny Node server with /health, SQLite
// (node:sqlite) at DATABASE_PATH and a phone-first page, so it runs with `npm run dev` and passes every
// /ship check before anything else is built. --bare makes just the folder (for a scaffolder like Vite).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./port.mjs";

// LOCKER_KIT_ROOT: the same test hook as locker.mjs (the MCP tests scaffold into a throwaway folder).
const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.LOCKER_KIT_ROOT ?? KIT;
const TEMPLATE = path.join(KIT, "kit", "app-template");

export const CODENAME = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
export const titleCase = (codename) => codename.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Copies the AI kit (kit/ai, TypeScript that Node 22.18+ runs as is) into <app>/locker/ai. The deploy refreshes it. */
export function copyAiKit(dir) {
  const to = path.join(dir, "locker", "ai");
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(path.join(KIT, "kit", "ai"))) {
    if (f.endsWith(".ts") && f !== "cli.ts") fs.copyFileSync(path.join(KIT, "kit", "ai", f), path.join(to, f));
  }
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Copies the starter app into dir, filling in the app's name. */
function copyTemplate(dir, { codename, name }) {
  for (const entry of fs.readdirSync(TEMPLATE, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const from = path.join(entry.parentPath, entry.name);
    const to = path.join(dir, path.relative(TEMPLATE, from));
    const text = fs
      .readFileSync(from, "utf8")
      .replaceAll("{{codename}}", codename)
      .replaceAll("{{nameJson}}", JSON.stringify(name))
      .replaceAll("{{name}}", escapeHtml(name));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, text);
  }
  // The same request logging the app gets online (npm run deploy refreshes this copy).
  fs.mkdirSync(path.join(dir, "locker"), { recursive: true });
  // And the school sign-in gate, the tester "Feedback" button, and the AI kit (locker/ai: server-side only).
  for (const f of ["otel.mjs", "feedback.mjs", "feedback.js", "gate.mjs"]) fs.copyFileSync(path.join(KIT, "kit", "locker", f), path.join(dir, "locker", f));
  copyAiKit(dir);
}

async function main() {
  const args = process.argv.slice(2);
  const codename = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!codename) fail('Usage: npm run new-app -- <codename> [--name "Lunch Line"] [--bare]');
  if (!CODENAME.test(codename)) fail(`"${codename}" won't work as a codename. Use 3–30 lowercase letters, digits or dashes, like lunch-line.`);
  const name = flag(args, "name") ?? titleCase(codename);
  const bare = args.includes("--bare");
  const dir = path.join(ROOT, "apps", codename);
  if (fs.existsSync(dir)) fail(`apps/${codename}/ already exists. Pick another codename, or keep building in that folder.`);

  const files = {
    "AGENTS.md": `# ${name} (\`${codename}\`)

This app lives inside the hackathon kit. Follow the kit's rules in \`../../AGENTS.md\`
(Cursor is opened at the kit root, so the kit's skills apply here too).

- This folder is its **own git repo**: run git commands here, not in the kit.
- Deploy from the kit root: \`npm run deploy -- ${codename}\` (see \`/ship\`).
- Secrets go in \`.env\` in this folder (written by \`npm run locker:project\`). Never commit it.
${bare ? "" : `
## The starter app

\`npm run dev\` in this folder runs it on the port in \`.env\`. It's plain Node, no packages:

- \`server.js\`: the server. \`/health\` (keep it), the API routes, and the files in \`public/\`.
- \`db.js\`: SQLite (\`node:sqlite\`) at \`DATABASE_PATH\` (\`./data/app.db\` here, \`/data/app.db\` online).
- \`public/\`: the page (phone first). Replace the "Tap me" example with the real app.
- \`POST /api/ask\` in \`server.js\`: a working AI example (\`locker/ai\`, the kit's AI helper). It already handles
  "no key yet" (a simulated answer) and "AI budget used up" (a friendly message). Its "Ask the AI" box is one
  uncommented line in \`public/index.html\`.
- School sign-in: off until \`LOCKER_GATE=1\`; then \`user\` in every route is whoever is signed in (\`GET /api/me\`).
- \`locker/\`: kit files (request logging, sign-in gate, Feedback button, AI kit). The deploy refreshes them; don't edit.

Switching to Vite, Next.js or another stack is fine (\`stack-picker\`): keep \`PORT\`, \`/health\`,
\`DATABASE_PATH\` and a \`start\` script. A purely static site can use \`locker/static.mjs\` instead (\`/ship\`).
`}
## Notes about this app

- The idea: \`docs/idea.md\`
`,
    ".gitignore": "node_modules/\n.env\n.env.*\n!.env.example\ndata/\n*.db\n*.db-*\ndist/\n.next/\n.DS_Store\n",
    "docs/idea.md": `# ${name}\n\n_Filled in by /start: who it's for, the one thing it nails, what's cut to "later", and the 30-second test._\n`,
  };
  if (!bare) {
    copyTemplate(dir, { codename, name });
    // A free port of its own, so several apps (and demos) can run side by side.
    files[".env"] = `# Local settings for this app. Never commit this file.
PORT=${await freePort()}
`;
  }
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }

  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q", "-b", "main");
  // The first commit is the student's: their git identity, else the one /onboard set in the kit repo,
  // else a placeholder so it never fails (/onboard sets a global identity for every later commit).
  const read = (cwd, key) => spawnSync("git", ["config", key], { cwd, encoding: "utf8" }).stdout?.trim() ?? "";
  const id = read(dir, "user.email")
    ? []
    : ["-c", `user.name=${read(KIT, "user.name") || "Hackathon Student"}`, "-c", `user.email=${read(KIT, "user.email") || "student@example.invalid"}`];
  git("add", "-A");
  git(...id, "commit", "-q", "-m", `Start ${name}`);

  console.log(`Created apps/${codename}/ (${name}), its own git repo with a first commit.`);
  if (!bare) console.log(`Try it: cd apps/${codename} && npm run dev   (a starter app with a database, ready to change)`);
  console.log(`Next: build in apps/${codename}/. When you want it online: /connect, then /ship.`);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (process.argv[1]?.endsWith("new-app.mjs")) {
  main().catch((err) => fail(err.message));
}

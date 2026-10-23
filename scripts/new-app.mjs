#!/usr/bin/env node
// Creates apps/<codename>/ as its own git repo, ready for /start to build in.
//   npm run new-app -- lunch-line [--name "Lunch Line"] [--plain | --bare] [--no-install]
// By default it holds the React starter (kit/app-template-react): Vite + React + TypeScript + Tailwind +
// shadcn/ui, with the component galleries (React Bits, Magic UI, Aceternity) ready to add, on the same small
// Node server as always (/health, SQLite at DATABASE_PATH, the AI route, the sign-in gate). It runs with
// `npm run dev` and passes every /ship check before anything else is built. It installs its packages
// (--no-install skips that). --plain: the no-packages starter (kit/app-template: plain HTML, CSS and JS).
// --bare: just the folder (for another scaffolder).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./port.mjs";

// LOCKER_KIT_ROOT: the same test hook as locker.mjs (the MCP tests scaffold into a throwaway folder).
const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.LOCKER_KIT_ROOT ?? KIT;
const TEMPLATES = { react: path.join(KIT, "kit", "app-template-react"), plain: path.join(KIT, "kit", "app-template") };

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
function copyTemplate(dir, { codename, name, template }) {
  const TEMPLATE = TEMPLATES[template];
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
  // And the school sign-in gate, the tester "Feedback" button, the vault for users' passwords and keys,
  // and the AI kit (locker/ai: server-side only).
  for (const f of ["otel.mjs", "feedback.mjs", "feedback.js", "gate.mjs", "vault.mjs", "browser.mjs"]) fs.copyFileSync(path.join(KIT, "kit", "locker", f), path.join(dir, "locker", f));
  copyAiKit(dir);
}

/** The app's AGENTS.md section for the React starter (kit/app-template-react). */
const REACT_STARTER_DOC = `
## The starter app (React)

\`npm run dev\` in this folder runs it on the port in \`.env\`: one server, and the page updates as you save.

- \`src/App.tsx\`: the page (phone first: one column, the main button at thumb height). Replace the "Tap me"
  example with the real app. \`src/components/\` for your own components, \`src/components/ui/\` for library ones.
- **Make it beautiful with the component galleries** (\`beautiful-components\` skill). Add any of them with one command:
  - shadcn/ui, the base pieces: \`npx shadcn@latest add dialog tabs sheet\`
  - React Bits, animated text, backgrounds and cards: \`npx shadcn@latest add @react-bits/SplitText-TS-TW\`
  - Magic UI, marketing motion (globe, marquee, number ticker): \`npx shadcn@latest add @magicui/marquee\`
  - Aceternity UI, heroes, spotlights, 3D cards, bento grids: \`npx shadcn@latest add @aceternity/bento-grid\`
  The starter already uses one of each (SplitText, NumberTicker, Spotlight) so you can see how they fit.
- \`server.js\`: the server. \`/health\` (keep it) and the API routes the page calls with \`fetch("/api/…")\`.
  On this laptop it hands the page to Vite; online it serves the built files in \`dist/\` (\`npm run build\`, the deploy runs it).
- \`db.js\`: SQLite (\`node:sqlite\`) at \`DATABASE_PATH\` (\`./data/app.db\` here, \`/data/app.db\` online).
- \`POST /api/ask\` in \`server.js\` + \`src/components/AskBox.tsx\`: a working AI example (\`locker/ai\`). It already handles
  "no key yet" (a simulated answer) and "AI budget used up" (a friendly message). Turn the box on with
  \`SHOW_ASK_THE_AI\` in \`src/App.tsx\`.
- Tester **Feedback button**: the commented line in \`index.html\` (\`/playtest\`). The starter page shows a small
  "Turn on: Ask the AI · Feedback button" hint; drop it when the real page replaces the starter.
- Sign-in gate: off until \`LOCKER_GATE=1\` (every page) or \`lazy\` (public; \`requireUser\` on the routes that need it);
  then \`user\` in every route is whoever is signed in (\`GET /api/me\`). If the app is for "everyone" on the hub,
  parents and guests can sign in too: check \`user.domain\`, don't assume a student.
  On this laptop, \`LOCKER_GATE_USER="Ana Garcia <ana@example.org>"\` in \`.env\` signs you in as that person.
- Routes with a blank in the address: \`"GET /api/things/:id"\` in \`server.js\` gives the handler \`params.id\`.
- Users' passwords or API keys: \`locker/vault.mjs\` (\`keep-secrets-safe\`), never the database.
- \`locker/\`: kit files (request logging, sign-in gate, Feedback button, AI kit). The deploy refreshes them; don't edit.
- \`npm run typecheck\` finds TypeScript mistakes. The build doesn't block on them.

Keep \`PORT\`, \`/health\`, \`DATABASE_PATH\` and the \`build\` + \`start\` scripts: the host needs them.
`;

async function main() {
  const args = process.argv.slice(2);
  const codename = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!codename) fail('Usage: npm run new-app -- <codename> [--name "Lunch Line"] [--plain | --bare] [--no-install]');
  if (!CODENAME.test(codename)) fail(`"${codename}" won't work as a codename. Use 3–30 lowercase letters, digits or dashes, like lunch-line.`);
  const name = flag(args, "name") ?? titleCase(codename);
  const bare = args.includes("--bare");
  const template = args.includes("--plain") ? "plain" : "react";
  const dir = path.join(ROOT, "apps", codename);
  if (fs.existsSync(dir)) fail(`apps/${codename}/ already exists. Pick another codename, or keep building in that folder.`);
  // The codename becomes the app's web address, so it must be free on the hub. Ask now, not at /connect.
  const { codenameFree } = await import("./locker.mjs");
  const free = await codenameFree(codename);
  if (free.checked && !free.available) {
    fail(`${free.reason} The codename becomes your app's web address, so it has to be unique. Try another, like ${codename}-2 or ${codename.slice(0, 20)}-club.`);
  }
  const unchecked = free.checked
    ? null
    : free.why === "not-connected"
      ? `Note: this laptop isn't connected to the hub yet, so "${codename}" wasn't checked. /connect checks it; if it's taken then, you'll pick another name.`
      : `Note: couldn't reach the hub to check that "${codename}" is free. /connect checks it again later.`;

  const files = {
    "AGENTS.md": `# ${name} (\`${codename}\`)

This app lives inside the hackathon kit. Follow the kit's rules in \`../../AGENTS.md\`
(Cursor is opened at the kit root, so the kit's skills apply here too).

- This folder is its **own git repo**: run git commands here, not in the kit.
- Deploy from the kit root: \`npm run deploy -- ${codename}\` (see \`/ship\`).
- Secrets go in \`.env\` in this folder (written by \`npm run locker:project\`). Never commit it.
${bare ? "" : template === "react" ? REACT_STARTER_DOC : `
## The starter app

\`npm run dev\` in this folder runs it on the port in \`.env\`. It's plain Node, no packages:

- \`server.js\`: the server. \`/health\` (keep it), the API routes, and the files in \`public/\`.
- \`db.js\`: SQLite (\`node:sqlite\`) at \`DATABASE_PATH\` (\`./data/app.db\` here, \`/data/app.db\` online).
- \`public/\`: the page (phone first). Replace the "Tap me" example with the real app.
- \`POST /api/ask\` in \`server.js\`: a working AI example (\`locker/ai\`, the kit's AI helper). It already handles
  "no key yet" (a simulated answer) and "AI budget used up" (a friendly message). Its "Ask the AI" box is one
  uncommented line in \`public/index.html\`.
- Tester **Feedback button**: the other commented line in \`public/index.html\` (\`/playtest\`). The starter
  page shows a small "Turn on: Ask the AI · Feedback button" hint so the student knows both exist; drop it when
  the real page replaces the starter.
- Sign-in gate: off until \`LOCKER_GATE=1\` (every page) or \`lazy\` (public; \`requireUser\` on the pages that need it);
  then \`user\` in every route is whoever is signed in (\`GET /api/me\`). If the app is for "everyone" on the hub,
  parents and guests can sign in too: check \`user.domain\`, don't assume a student.
  On this laptop, \`LOCKER_GATE_USER="Ana Garcia <ana@example.org>"\` in \`.env\` signs you in as that person.
- Routes with a blank in the address: \`"GET /api/things/:id"\` in \`server.js\` gives the handler \`params.id\`.
- Users' passwords or API keys: \`locker/vault.mjs\` (\`keep-secrets-safe\`), never the database.
- \`locker/\`: kit files (request logging, sign-in gate, Feedback button, AI kit). The deploy refreshes them; don't edit.

Switching to Vite, Next.js or another stack is fine (\`stack-picker\`): keep \`PORT\`, \`/health\`,
\`DATABASE_PATH\` and a \`start\` script. A purely static site can use \`locker/static.mjs\` instead (\`/ship\`).
`}
## Notes about this app

- The idea: \`docs/idea.md\`
`,
    ".gitignore": "node_modules/\n.env\n.env.*\n!.env.example\ndata/\n*.db\n*.db-*\ndist/\n.next/\n.DS_Store\n*.log\n",
    "docs/idea.md": `# ${name}\n\n_Filled in by /start: who it's for, the one thing it nails, what's cut to "later", and the 30-second test._\n`,
  };
  if (!bare) {
    copyTemplate(dir, { codename, name, template });
    // A free port of its own, so several apps (and demos) can run side by side.
    files[".env"] = `# Local settings for this app. Never commit this file.
PORT=${await freePort()}
`;
  }
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }

  // The React starter needs its packages (Vite, React, Tailwind, the UI pieces). Installed now, so
  // `npm run dev` works the first time; package-lock.json goes in the first commit.
  let installed = template !== "react" || bare;
  if (!installed && !args.includes("--no-install")) {
    console.log("Installing the starter's packages (React, Vite, Tailwind, UI pieces). About a minute…");
    // On Windows npm is a .cmd, which needs a shell; one command string (no args array) keeps Node quiet about it.
    const npm =
      process.platform === "win32"
        ? spawnSync("npm install --no-audit --no-fund --loglevel=error", { cwd: dir, stdio: "inherit", shell: true })
        : spawnSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir, stdio: "inherit" });
    installed = npm.status === 0;
    if (!installed) console.log(`The install didn't finish (no internet?). Run it yourself when you can: cd apps/${codename} && npm install`);
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
  if (!flag(args, "name") && !bare) console.log(`The app is called "${name}" (made from the codename). Want different spacing or capitals, like "LunchLine"? Change it in ${template === "react" ? "index.html and src/App.tsx" : "public/index.html"} (or start over with --name "…").`);
  if (!bare && template === "react") console.log(`Try it: cd apps/${codename} && ${installed ? "" : "npm install && "}npm run dev   (a React starter with a database and UI galleries ready to add)`);
  if (!bare && template === "plain") console.log(`Try it: cd apps/${codename} && npm run dev   (a starter app with a database, ready to change)`);
  console.log(`Next: build in apps/${codename}/. When you want it online: /connect, then /ship.`);
  if (unchecked) console.log(unchecked);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (process.argv[1]?.endsWith("new-app.mjs")) {
  main().catch((err) => fail(err.message));
}

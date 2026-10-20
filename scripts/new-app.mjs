#!/usr/bin/env node
// Creates apps/<codename>/ as its own git repo, ready for /start to build in.
//   npm run new-app -- lunch-line [--name "Lunch Line"]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// LOCKER_KIT_ROOT: the same test hook as locker.mjs (the MCP tests scaffold into a throwaway folder).
const ROOT = process.env.LOCKER_KIT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const CODENAME = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
export const titleCase = (codename) => codename.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  const codename = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!codename) fail('Usage: npm run new-app -- <codename> [--name "Lunch Line"]');
  if (!CODENAME.test(codename)) fail(`"${codename}" won't work as a codename. Use 3–30 lowercase letters, digits or dashes, like lunch-line.`);
  const name = flag(args, "name") ?? titleCase(codename);
  const dir = path.join(ROOT, "apps", codename);
  if (fs.existsSync(dir)) fail(`apps/${codename}/ already exists. Pick another codename, or keep building in that folder.`);

  const files = {
    "AGENTS.md": `# ${name} (\`${codename}\`)

This app lives inside the hackathon kit. Follow the kit's rules in \`../../AGENTS.md\`
(Cursor is opened at the kit root, so the kit's skills apply here too).

- This folder is its **own git repo**: run git commands here, not in the kit.
- Deploy from the kit root: \`npm run deploy -- ${codename}\` (see \`/ship\`).
- Secrets go in \`.env\` in this folder (written by \`npm run locker:project\`). Never commit it.

## Notes about this app

- The idea: \`docs/idea.md\`
`,
    ".gitignore": "node_modules/\n.env\n.env.*\n!.env.example\ndata/\n*.db\n*.db-*\ndist/\n.next/\n.DS_Store\n",
    "docs/idea.md": `# ${name}\n\n_Filled in by /start: who it's for, the one thing it nails, what's cut to "later", and the 30-second test._\n`,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }

  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q", "-b", "main");
  // A student without a git identity yet still gets a first commit; /onboard sets the real one.
  const who = (() => { try { return git("config", "user.email").trim(); } catch { return ""; } })();
  const id = who ? [] : ["-c", "user.name=Hackathon Student", "-c", "user.email=student@example.invalid"];
  git("add", "-A");
  git(...id, "commit", "-q", "-m", `Start ${name}`);

  console.log(`Created apps/${codename}/ (${name}), its own git repo with a first commit.`);
  console.log(`Next: build in apps/${codename}/. When you want it online: /connect, then /ship.`);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (process.argv[1]?.endsWith("new-app.mjs")) main();

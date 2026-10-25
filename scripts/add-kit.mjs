#!/usr/bin/env node
// Adds a ready-made piece of the kit to an app in apps/<codename>/, and wires it into the app's server.js.
//   node scripts/add-kit.mjs speech <codename>        voice input: three engines + a hold-to-talk button (kit/speech)
//   node scripts/add-kit.mjs leaderboard <codename>   game scores: a leaderboard in the app's own database
// Safe to run again: files are refreshed, server.js lines are only added once. Prints what to do next.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.LOCKER_KIT_ROOT ?? KIT;
const SPEECH_FILES = ["listen.js", "mic.js", "commands.js", "engine-browser.js", "engine-cloud.js", "engine-vosk.js", "hold-to-talk.js"];
// Where the server.js lines go: right after the Feedback button's line, which every starter app has.
const ANCHOR = "if (await feedback(req, res)) return;";

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return path.relative(ROOT, to).replaceAll("\\", "/");
};

/** Adds imports at the top of server.js and route lines after the feedback line. Returns what happened. */
export function wireServer(dir, { imports, setup = [], route, marker }) {
  const file = path.join(dir, "server.js");
  if (!fs.existsSync(file)) return { ok: false, why: "no server.js" };
  let text = fs.readFileSync(file, "utf8");
  if (text.includes(marker)) return { ok: true, already: true };
  if (!text.includes(ANCHOR)) return { ok: false, why: "no feedback line to put it next to" };
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lastImport = [...text.matchAll(/^import .*;$/gm)].at(-1);
  const at = lastImport.index + lastImport[0].length;
  text = text.slice(0, at) + nl + imports.join(nl) + (setup.length ? nl + nl + setup.join(nl) : "") + text.slice(at);
  text = text.replace(/^([ \t]*)if \(await feedback\(req, res\)\) return;/m, (line, indent) => `${line}${nl}${nl}${route.map((l) => indent + l).join(nl)}`);
  fs.writeFileSync(file, text);
  return { ok: true };
}

const isReact = (dir) => fs.existsSync(path.join(dir, "src")) && fs.existsSync(path.join(dir, "vite.config.ts"));

// The AI kit in the app (locker/ai), refreshed so it has transcribe() and Jev. The deploy does the same.
function refreshAiKit(dir) {
  const to = path.join(dir, "locker", "ai");
  for (const f of fs.readdirSync(path.join(KIT, "kit", "ai"))) if (f.endsWith(".ts") && f !== "cli.ts") copy(path.join(KIT, "kit", "ai", f), path.join(to, f));
}

export function addSpeech(dir) {
  const react = isReact(dir);
  const pageDir = react ? path.join(dir, "src", "lib", "speech") : path.join(dir, "public", "speech");
  const files = SPEECH_FILES.map((f) => copy(path.join(KIT, "kit", "speech", f), path.join(pageDir, f)));
  // React + TypeScript also gets the component and the types (the .d.ts files) for the plain JavaScript.
  if (react) for (const f of ["HoldToTalk.tsx", "listen.d.ts", "hold-to-talk.d.ts"]) files.push(copy(path.join(KIT, "kit", "speech", f), path.join(pageDir, f)));
  files.push(copy(path.join(KIT, "kit", "speech", "transcribe-route.mjs"), path.join(dir, "locker", "transcribe-route.mjs")));
  refreshAiKit(dir);
  const wired = wireServer(dir, {
    marker: "transcribeRoute",
    imports: ['import { transcribe } from "./locker/ai/index.ts";', 'import { transcribeRoute } from "./locker/transcribe-route.mjs";'],
    route: ["// Speech to text for the \"cloud\" voice engine (POST /api/transcribe). Uses the app's AI budget.", "if (await transcribeRoute(req, res, { transcribe, user })) return;"],
  });
  return { files, wired, react };
}

export function addLeaderboard(dir) {
  const react = isReact(dir);
  const files = [copy(path.join(KIT, "kit", "locker", "leaderboard.mjs"), path.join(dir, "locker", "leaderboard.mjs"))];
  files.push(copy(path.join(KIT, "kit", "locker", "scores.js"), react ? path.join(dir, "src", "lib", "scores.js") : path.join(dir, "public", "scores.js")));
  if (react) files.push(copy(path.join(KIT, "kit", "locker", "scores.d.ts"), path.join(dir, "src", "lib", "scores.d.ts")));
  refreshAiKit(dir);
  const wired = wireServer(dir, {
    marker: "leaderboard(db",
    imports: ['import { leaderboard } from "./locker/leaderboard.mjs";', 'import { noul } from "./locker/ai/index.ts";'],
    setup: [
      "// The game's leaderboard, in the app's database. Each board can have its own rules (see locker/leaderboard.mjs):",
      "// maxPerSecond = most points a player can earn in a second; timed: true = fastest time wins.",
      'const scores = leaderboard(db, { noul, boards: { main: {} } });',
    ],
    route: ["// The leaderboard's routes: POST /api/scores/start, POST /api/scores, GET /api/scores/:board.", "if (await scores.route(req, res, user)) return;"],
  });
  return { files, wired, react };
}

function main() {
  const [piece, codename] = process.argv.slice(2);
  const pieces = { speech: addSpeech, leaderboard: addLeaderboard };
  if (!pieces[piece] || !codename) {
    console.log("Usage: node scripts/add-kit.mjs <speech | leaderboard> <codename>");
    process.exit(1);
  }
  const dir = path.join(ROOT, "apps", codename);
  if (!fs.existsSync(dir)) {
    console.log(`There's no apps/${codename}/ yet. Make it first: npm run new-app -- ${codename}`);
    process.exit(1);
  }
  const { files, wired, react } = pieces[piece](dir);
  const inApp = (f) => f.replace(`apps/${codename}/`, "");
  console.log(`Added to apps/${codename}/:\n${files.map((f) => `  ${inApp(f)}`).join("\n")}\n  locker/ai/ (refreshed)`);
  if (wired.already) console.log("server.js already had it.");
  else if (wired.ok) console.log("server.js: added the import lines at the top and the route next to the feedback line.");
  else console.log(`Couldn't add it to server.js (${wired.why}). Add the lines by hand: see kit/${piece === "speech" ? "speech/README.md" : "locker/LEADERBOARD.md"}.`);
  const where = react ? "src/lib" : "public";
  console.log(
    piece === "speech"
      ? `\nNext: put a hold-to-talk button on a page (kit/speech/README.md, step 2). The files are in ${where}/speech/.`
      : `\nNext: call startRun / submitScore / topScores from the game (kit/locker/LEADERBOARD.md, step 2). The page helper is ${where}/scores.js.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

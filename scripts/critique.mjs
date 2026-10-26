#!/usr/bin/env node
// A design critique you can READ: screenshots of the running app go to the kit's vision model, and a
// score out of 10 plus three concrete fixes come back as text. Works with any editor model, even one
// that can't see images. Part of "done": a score of 7 or more, or an override note saying why not.
//
//   npm run critique -- http://localhost:4817                 desktop + phone shots, score, 3 fixes
//   npm run critique -- http://localhost:4817 --tap           a game: also taps the screen and shoots the play
//   npm run critique -- <url> --app lunch-line                which app it is (found from the port when local)
//   npm run critique -- <url> --accept "out of time, demo in 5 min"   records an override below 7
//   npm run critique -- <url> --dry-run                       shows the request, sends nothing
//
// It uses the app's own AI key (apps/<codename>/.env, from /connect), else the kit's .env key; the
// "vision" tier (kit/ai/models.ts). No key: it shows the request it would make. Each run costs about
// a cent of the app's monthly AI budget. Results are logged in apps/<codename>/docs/critique.md.
// Exit code: 0 = passed (7+) or accepted, 1 = below 7, 2 = couldn't run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PASS = 7;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "verdict", "looksDefault", "strength", "fixes"],
  properties: {
    score: { type: "integer", description: "1 to 10." },
    verdict: { type: "string", description: "One sentence a stranger would say after 5 seconds." },
    looksDefault: { type: "boolean", description: "True if it looks like an unstyled template or default AI output." },
    strength: { type: "string", description: "The one thing that already works, to keep." },
    fixes: {
      type: "array",
      description: "Exactly 3.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["problem", "fix", "where"],
        properties: {
          problem: { type: "string", description: "What is wrong, as seen in the screenshot." },
          fix: { type: "string", description: "The concrete change: which CSS property, token, size, color or element, to what." },
          where: { type: "string", description: "Which screen and element (e.g. 'phone: the main button')." },
        },
      },
    },
  },
};

export const SYSTEM = `You are a strict, kind design critic for apps and browser games built at a high school hackathon.
You see screenshots (desktop and phone; for a game also a moment of play). Judge only what is visible.
Score 1-10 against this bar:
1-3 broken, blank, or the unstyled default (system font, gray, centered card, lorem ipsum).
4-6 works but generic: no clear direction, weak hierarchy, random spacing, default-looking colors or fonts.
7 designed: one clear direction, a real type scale, a palette used on purpose, aligned spacing, readable on the phone. This is the bar to ship.
8-9 distinctive: a memorable signature move, polish in the details. 10 is rare.
For games also: real art (sprites, not plain rectangles or circles), a readable HUD, the player easy to find, a title or game-over screen that looks finished.
Penalize: purple-to-pink default gradients, Inter/Roboto/Arial everywhere, text under 4.5:1 contrast, tap targets under 44px, horizontal overflow on the phone, empty screens with no next step.
Each fix must be concrete enough for a beginner's AI assistant to apply in code without seeing the image: name the element, the property and the new value (a size, a token, a hex color, a font). Most important fix first.`;

function opt(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Reads KEY=value lines (the same format kit/ai reads). */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^(["'])(.*)\1$/, "$2")]),
  );
}

/** Which app is this? --app, else the one whose .env has this URL's port. */
export function findApp(url, explicit, root = ROOT) {
  if (explicit) return fs.existsSync(path.join(root, "apps", explicit)) ? explicit : null;
  const port = (() => {
    try {
      return new URL(url).port;
    } catch {
      return "";
    }
  })();
  const apps = path.join(root, "apps");
  if (!port || !fs.existsSync(apps)) return null;
  return fs.readdirSync(apps).find((name) => readEnvFile(path.join(apps, name, ".env")).PORT === port) ?? null;
}

/** The app's capped key first (/connect writes it), then the kit's. Never printed. */
function loadKey(app) {
  for (const file of [app && path.join(ROOT, "apps", app, ".env"), path.join(ROOT, ".env")].filter(Boolean)) {
    const env = readEnvFile(file);
    for (const k of ["OPENROUTER_API_KEY", "MODEL_VISION", "AI_PROVIDER"]) if (env[k] && !process.env[k]) process.env[k] = env[k];
    if (process.env.OPENROUTER_API_KEY) return path.relative(ROOT, file);
  }
  return null;
}

async function capture(url, { tap, outDir }) {
  const { chromium } = await import("playwright").catch(() => {
    throw new Error("Playwright is missing. Run `npm run setup` once.");
  });
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const browser = await chromium.launch();
  const shots = [];
  const problems = [];
  try {
    for (const size of [
      { name: "desktop", width: 1280, height: 800, isMobile: false, scale: 1 },
      { name: "phone", width: 390, height: 844, isMobile: true, scale: 2 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.isMobile, hasTouch: size.isMobile, deviceScaleFactor: size.scale });
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && problems.push(`[${size.name}] console: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`[${size.name}] uncaught: ${e.message}`));
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch (err) {
        throw new Error(`Couldn't open ${url}: ${err.message.split("\n")[0]}. Is the app running (npm run dev in its folder)?`);
      }
      await page.waitForTimeout(1200);
      const take = async (label) => {
        const file = path.join(outDir, `${stamp}-${label}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 72 });
        shots.push({ label, file });
      };
      await take(size.name);
      if (tap && size.isMobile) {
        // A game: start it and catch a moment of play (move the finger a little so something happens).
        await page.mouse.click(size.width / 2, size.height * 0.7);
        for (let i = 0; i < 30; i++) {
          await page.mouse.move(size.width / 2 + Math.sin(i / 3) * 100, size.height * 0.8);
          await page.waitForTimeout(100);
        }
        await take("phone-play");
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return { shots, problems: [...new Set(problems)] };
}

/** The messages sent to the vision model: the rubric, the app's own design notes, and the pictures. */
export function buildMessages(shots, { design, note }) {
  const text = [
    "Critique this app from its screenshots.",
    ...shots.map((s, i) => `Image ${i + 1}: ${s.label}.`),
    design ? `The builders' design direction (DESIGN.md), judge against it:\n${design}` : "",
    note ? `Context from the builders: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: [{ type: "text", text }, ...shots.map((s) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(s.file).toString("base64")}` } }))] },
  ];
}

export function formatResult(r, { model, cost, shots, problems, accepted }) {
  const passed = r.score >= PASS;
  return [
    `Looks: ${r.score}/10${r.looksDefault ? "  (reads as a default template)" : ""}`,
    `Verdict: ${r.verdict}`,
    `Keep: ${r.strength}`,
    "Fixes, most important first:",
    ...r.fixes.slice(0, 3).map((f, i) => `  ${i + 1}. ${f.problem}\n     Fix: ${f.fix}\n     Where: ${f.where}`),
    problems.length ? `Console problems (fix these too):\n${problems.map((p) => `  ${p}`).join("\n")}` : "Console: no errors",
    `Shots: ${shots.map((s) => path.relative(ROOT, s.file)).join(", ")}`,
    `Model: ${model}${cost ? `, $${cost.toFixed(4)}` : ""}`,
    passed ? `PASS (${PASS}+): looks are done for now.` : accepted ? `ACCEPTED below ${PASS}: "${accepted}"` : `NOT YET (below ${PASS}): apply the fixes, then run the critique again. Out of time? Record why: --accept "<reason>".`,
  ].join("\n");
}

function logResult(app, url, r, accepted) {
  const file = app ? path.join(ROOT, "apps", app, "docs", "critique.md") : path.join(ROOT, "tmp", "critique.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "# Design critiques\n\nWritten by `npm run critique`. The latest entry is at the bottom. Done = 7+ or an accepted override.\n");
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  const status = r.score >= PASS ? "PASS" : accepted ? `ACCEPTED: ${accepted}` : "NOT YET";
  fs.appendFileSync(file, `\n## ${when} · ${r.score}/10 · ${status}\n\n${url}\n\n${r.verdict}\n\n${r.fixes.slice(0, 3).map((f, i) => `${i + 1}. ${f.problem} Fix: ${f.fix} (${f.where})`).join("\n")}\n`);
  return path.relative(ROOT, file);
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => /^https?:\/\//.test(a));
  if (!url) {
    console.error('Usage: npm run critique -- <url> [--tap] [--app <codename>] [--accept "<reason>"] [--note "<context>"] [--dry-run]');
    process.exit(2);
  }
  const app = findApp(url, opt(args, "app"));
  const accepted = opt(args, "accept");
  const keyFrom = loadKey(app);
  const designFile = app && path.join(ROOT, "apps", app, "DESIGN.md");
  const design = designFile && fs.existsSync(designFile) ? fs.readFileSync(designFile, "utf8").slice(0, 2000) : "";

  console.log(`Taking screenshots of ${url}${app ? ` (apps/${app})` : ""}…`);
  const { shots, problems } = await capture(url, { tap: args.includes("--tap"), outDir: path.join(ROOT, "tmp", "shots", "critique") });
  const messages = buildMessages(shots, { design, note: opt(args, "note") });

  const { askJson, provider } = await import("../kit/ai/index.ts");
  const { resolveTier } = await import("../kit/ai/models.ts");
  const model = resolveTier("vision").model;
  if (args.includes("--dry-run") || provider().name === "sim") {
    // No key (or a dry run): show exactly what would be sent, without the picture bytes.
    console.log(`\n${args.includes("--dry-run") ? "Dry run" : "No AI key found (apps/<codename>/.env after /connect, or the kit's .env)"}: this is the request it would send.\n`);
    console.log(`POST https://openrouter.ai/api/v1/chat/completions  model=${model} (tier "vision")  response_format=json_schema`);
    for (const m of messages) {
      if (typeof m.content === "string") console.log(`[${m.role}]\n${m.content}\n`);
      else for (const part of m.content) console.log(part.type === "text" ? `[${m.role}] ${part.text}\n` : `[${m.role}] <image ${Math.round((part.image_url.url.length * 3) / 4 / 1024)} KB jpeg>`);
    }
    console.log(`\nShots: ${shots.map((s) => path.relative(ROOT, s.file)).join(", ")}`);
    console.log("No score without the model, so this doesn't count toward done.");
    process.exit(2);
  }

  console.log(`Asking the vision model (${model}, ${keyFrom === ".env" ? "the kit's key" : `the app's key in ${keyFrom}`})…\n`);
  let result;
  try {
    result = await askJson("vision", messages, SCHEMA, { maxTokens: 1500, valid: (d) => Number.isInteger(d.score) && d.score >= 1 && d.score <= 10 && d.fixes?.length >= 3 });
  } catch (err) {
    console.error(`✗ The critique didn't come back: ${err.message}`);
    process.exit(2);
  }
  const r = result.data;
  console.log(formatResult(r, { model: result.model, cost: result.cost, shots, problems, accepted }));
  console.log(`Logged in ${logResult(app, url, r, accepted)}`);
  process.exit(r.score >= PASS || accepted ? 0 : 1);
}

if (process.argv[1]?.endsWith("critique.mjs")) main();

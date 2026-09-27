#!/usr/bin/env node
// Screenshots a running page at desktop and phone size and reports console errors,
// so an agent can SEE what it built before calling it done.
//
//   npm run shot -- http://localhost:4817            desktop + mobile
//   npm run shot -- http://localhost:4817 --desktop  desktop only
//   npm run shot -- http://localhost:4817 --out builds/x/full/shots
//
// Prints the saved PNG paths and every console error / failed request.
// Exit code 1 when the page throws or logs errors, so it works as a gate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
  console.error("Usage: npm run shot -- <url> [--desktop|--mobile] [--out <dir>] [--wait <ms>]");
  process.exit(2);
}
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = path.resolve(opt("out") ?? path.join(ROOT, "tmp", "shots"));
const wait = Number(opt("wait") ?? 800);
const sizes = [
  !args.includes("--mobile") && { name: "desktop", width: 1440, height: 900, isMobile: false },
  !args.includes("--desktop") && { name: "mobile", width: 390, height: 844, isMobile: true },
].filter(Boolean);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is missing. Run `npm run setup` once.");
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const host = new URL(url).port || new URL(url).hostname;
const browser = await chromium.launch();
const problems = [];

for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.isMobile, hasTouch: size.isMobile, deviceScaleFactor: size.isMobile ? 2 : 1 });
  const page = await context.newPage();
  page.on("console", (msg) => msg.type() === "error" && problems.push(`[${size.name}] console: ${msg.text()}`));
  page.on("pageerror", (err) => problems.push(`[${size.name}] uncaught: ${err.message}`));
  page.on("requestfailed", (req) => problems.push(`[${size.name}] failed request: ${req.url()} (${req.failure()?.errorText})`));
  page.on("response", (res) => res.status() >= 400 && problems.push(`[${size.name}] HTTP ${res.status()}: ${res.url()}`));
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (err) {
    problems.push(`[${size.name}] could not load: ${err.message.split("\n")[0]}`);
  }
  await page.waitForTimeout(wait);
  const file = path.join(outDir, `${host}-${size.name}-${stamp}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${path.relative(ROOT, file)}`);
  await context.close();
}
await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nno console errors");

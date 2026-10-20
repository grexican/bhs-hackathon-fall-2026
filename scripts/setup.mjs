#!/usr/bin/env node
// One-time setup: tools, the screenshot browser, git hooks, and the agent mirrors.
import { execSync, spawnSync } from "node:child_process";

const step = (label, cmd) => {
  console.log(`\n→ ${label}`);
  execSync(cmd, { stdio: "inherit" });
};

// 22.18+ runs TypeScript files directly (the AI kit and its CLI rely on it).
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`Node ${process.versions.node} is too old. Install Node 22.18 or newer from nodejs.org.`);
  process.exit(1);
}
step("Installing tools", "npm install --no-audit --no-fund --loglevel=error");
step("Installing the browser used for screenshots", "npx playwright install chromium");
step("Turning on the safety checks for commits", "git config core.hooksPath .githooks");
step("Syncing skills for Cursor and Claude Code", "node scripts/sync-agents.mjs");
// The Railway tool puts apps online (npm run deploy). Not needed to build, so a failed install only warns.
try {
  execSync("railway --version", { stdio: "ignore" });
} catch {
  try {
    step("Installing the tool that puts apps online (Railway)", "npm i -g @railway/cli");
  } catch {
    console.log("  Couldn't install it now. It's only needed to go online: npm run doctor shows the fix.");
  }
}
// Doctor's report says what (if anything) still needs fixing; setup carries on either way.
console.log("\n→ Checking everything");
spawnSync(process.execPath, ["scripts/doctor.mjs"], { stdio: "inherit" });
console.log("\nNext: in Cursor (or Claude Code), type /onboard, then /start.");

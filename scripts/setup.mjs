#!/usr/bin/env node
// One-time setup: tools (including the Railway tool that puts apps online), the screenshot browser,
// git hooks, and the agent mirrors.
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
// Doctor's report says what (if anything) still needs fixing; setup carries on either way.
console.log("\n→ Checking everything");
spawnSync(process.execPath, ["scripts/doctor.mjs"], { stdio: "inherit" });
console.log("\nNext: in Cursor (or Claude Code), type /onboard, then /start.");

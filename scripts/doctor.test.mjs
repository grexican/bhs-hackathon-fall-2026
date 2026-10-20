// Tests scripts/doctor.mjs: each check says ✓ or gives one plain fix.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkHub, checkInstalled, checkNode, checkSqlite } from "./doctor.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "doctor.mjs");

test("Node: 22.18 and newer pass, older gets the download link", () => {
  assert.equal(checkNode("22.18.0").ok, true);
  assert.equal(checkNode("24.1.0").ok, true);
  const old = checkNode("22.11.0");
  assert.equal(old.ok, false);
  assert.match(old.fix, /nodejs\.org/);
});

test("SQLite is built in", async () => {
  assert.equal((await checkSqlite()).ok, true);
});

test("hub connection and installed packages are read from the kit folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
  assert.equal(checkHub(root).ok, null, "not connected is not an error");
  assert.match(checkHub(root).fix, /\/connect/);
  fs.writeFileSync(path.join(root, ".env"), "LOCKER_TOKEN=lkr_x\n");
  assert.equal(checkHub(root).ok, true);
  assert.equal(checkInstalled(root).ok, false);
  assert.match(checkInstalled(root).fix, /npm install/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the report lists every check with a mark, and never prints the hub token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
  fs.writeFileSync(path.join(root, ".env"), "LOCKER_TOKEN=lkr_secret_value\n");
  let out;
  try {
    out = execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, LOCKER_KIT_ROOT: root }, encoding: "utf8" });
  } catch (err) {
    out = err.stdout; // exit 1 is expected here: the temp folder has no node_modules
  }
  for (const word of ["Node", "SQLite", "npm", "Kit packages", "git", "Railway", "hub"]) assert.match(out, new RegExp(`[✓✗–] .*${word}`));
  assert.match(out, /✗ Kit packages aren't installed yet\n {4}Fix: Run: npm install/);
  assert.doesNotMatch(out, /lkr_secret_value/);
  fs.rmSync(root, { recursive: true, force: true });
});

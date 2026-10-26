// End-to-end test of scripts/locker-mcp.mjs: starts the MCP server as a child process against the mock hub and a fake
// `railway`, and speaks MCP to it over stdio (initialize, tools/list, tools/call). No network, no real Railway.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readEnv } from "./locker.mjs";
import { APP_SECRETS, RW_TOKEN, TOKEN, startMockHub } from "./locker-mock-hub.mjs";

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "locker-mcp.mjs");
let mock;
let client;
const outputs = []; // every tool result text, for the secrets check at the end

before(async () => {
  mock = await startMockHub();
  client = new Client({ name: "locker-mcp-test", version: "1.0.0" });
  // A short check wait, so the first locker_connect_check hands back "Still waiting" before the mock approves.
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], env: mock.env({ LOCKER_CONNECT_WAIT_MS: "30" }), stderr: "pipe" });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
  mock.close();
});

async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.map((c) => c.text).join("\n");
  outputs.push(text);
  return { text, isError: Boolean(r.isError) };
}

const appEnv = (codename) => readEnv(path.join(mock.kit, "apps", codename, ".env"));

test("lists every tool, each with a description", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "locker_bring_app",
    "locker_connect",
    "locker_connect_check",
    "locker_create_project",
    "locker_deploy",
    "locker_feedback",
    "locker_join_project",
    "locker_list_app",
    "locker_logs",
    "locker_pull_env",
    "locker_set",
    "locker_status",
    "locker_whats_new",
    "new_app",
  ]);
  for (const t of tools) assert.ok(t.description?.length > 20, `${t.name} has a description`);
});

test("status before connecting says how to connect", async () => {
  const r = await call("locker_status");
  assert.equal(r.isError, false);
  assert.match(r.text, /isn't connected/);
  assert.match(r.text, /locker_connect/);
});

test("connect: returns the code at once, then check polls until approved and saves the token", async () => {
  const first = await call("locker_connect");
  assert.equal(first.isError, false, first.text);
  assert.match(first.text, /Show the student this code/);
  assert.match(first.text, /KQ7-4PX/);
  assert.match(first.text, /locker_connect_check/);
  let r = await call("locker_connect_check");
  assert.match(r.text, /Still waiting/);
  assert.match(r.text, /locker_connect_check again/);
  for (let i = 0; i < 20 && !/Connected as/.test(r.text); i++) r = await call("locker_connect_check");
  assert.match(r.text, /Connected as Ana/);
  assert.equal(readEnv(path.join(mock.kit, ".env")).LOCKER_TOKEN, TOKEN);
  assert.match(fs.readFileSync(path.join(mock.kit, ".env"), "utf8"), /# my notes/);
  assert.match((await call("locker_connect")).text, /Already connected as Ana/);
});

test("status after connecting shows who", async () => {
  const r = await call("locker_status");
  assert.match(r.text, /Connected as Ana/);
  assert.match(r.text, /Team App \(team-app, teammate\)/);
});

test("create_project needs the folder first and says to use new_app", async () => {
  const r = await call("locker_create_project", { codename: "lunch-line" });
  assert.equal(r.isError, true);
  assert.match(r.text, /new_app tool/);
  assert.doesNotMatch(r.text, /\n\s+at /, "no stack trace");
});

test("new_app, then create_project writes apps/<codename>/.env", async () => {
  const n = await call("new_app", { codename: "lunch-line", name: "Lunch Line" });
  assert.equal(n.isError, false, n.text);
  assert.ok(fs.existsSync(path.join(mock.kit, "apps", "lunch-line", "AGENTS.md")));
  const r = await call("locker_create_project", { codename: "lunch-line", name: "Lunch Line", pitch: "Skip the queue" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /lunch-line-production\.up\.railway\.app/);
  assert.equal(mock.projects.get("lunch-line").body.pitch, "Skip the queue");
  const env = appEnv("lunch-line");
  assert.equal(env.RAILWAY_TOKEN, RW_TOKEN);
  assert.equal(env.APP_URL, "https://lunch-line-production.up.railway.app");
});

test("pull_env returns key names only", async () => {
  fs.rmSync(path.join(mock.kit, "apps", "lunch-line", ".env"));
  const r = await call("locker_pull_env", { codename: "lunch-line" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /RAILWAY_TOKEN, RAILWAY_SERVICE_ID, OPENROUTER_API_KEY/);
  assert.equal(appEnv("lunch-line").RAILWAY_TOKEN, RW_TOKEN);
});

test("set refuses hub keys and saves the student's own", async () => {
  for (const key of ["RAILWAY_TOKEN", "OPENROUTER_API_KEY", "LOCKER_APP_SECRET"]) {
    const r = await call("locker_set", { codename: "lunch-line", settings: { [key]: "x" } });
    assert.equal(r.isError, true);
    assert.match(r.text, /comes from the hub/);
    assert.match(r.text, /locker_pull_env/);
  }
  const unsafe = await call("locker_set", { codename: "lunch-line", settings: { GREETING: "hi & bye" } });
  assert.equal(unsafe.isError, true);
  const r = await call("locker_set", { codename: "lunch-line", settings: { LOCKER_GATE: "1" } });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /Saved LOCKER_GATE/);
  assert.equal(appEnv("lunch-line").LOCKER_GATE, "1");
  assert.equal(appEnv("lunch-line").RAILWAY_TOKEN, RW_TOKEN, "hub keys untouched");
});

test("deploy uploads and points at the live URL and the build logs", async () => {
  fs.writeFileSync(path.join(mock.kit, "apps", "lunch-line", "package.json"), "{}");
  const r = await call("locker_deploy", { codename: "lunch-line" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /https:\/\/lunch-line-production\.up\.railway\.app/);
  assert.match(r.text, /locker_logs/);
  assert.match(r.text, /may say "Application not found"[\s\S]*\/health says ok/);
  assert.match(r.text, /token present/);
});

test("deploy with a note, and locker_whats_new: the student's line goes to the hub; too long is refused before uploading", async () => {
  const r = await call("locker_deploy", { codename: "lunch-line", note: "Added a leaderboard" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /What's new saved: "Added a leaderboard"/);
  const long = await call("locker_deploy", { codename: "lunch-line", note: "x".repeat(141) });
  assert.equal(long.isError, true);
  const w = await call("locker_whats_new", { codename: "lunch-line", note: "Dark mode" });
  assert.equal(w.isError, false, w.text);
  assert.match(w.text, /What's new for lunch-line: "Dark mode"\. 2 notes/);
});

test("logs fetch a fixed number of lines instead of streaming", async () => {
  const r = await call("locker_logs", { codename: "lunch-line", build: true, lines: 20 });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /railway logs --service svc-123 --build --lines 20/);
});

test("list_app: needs a tagline, then lists the app", async () => {
  const missing = await call("locker_list_app", { codename: "lunch-line" });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /Add a tagline/);
  const r = await call("locker_list_app", { codename: "lunch-line", tagline: "See the line before you leave class", category: "School life" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /listed in the Apps directory/);
  const bad = await call("locker_list_app", { codename: "lunch-line", category: "Homework" });
  assert.equal(bad.isError, true, "unknown category rejected before the hub");
});

test("bring_app asks for an app hosted elsewhere and lists requests", async () => {
  const r = await call("locker_bring_app", { codename: "quiz-night", url: "https://quiz.example.com", name: "Quiz Night" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /Asked to bring Quiz Night/);
  assert.match((await call("locker_bring_app", {})).text, /quiz-night\): pending/);
  assert.match((await call("locker_bring_app", { codename: "quiz-night", withdraw: true })).text, /Withdrew the request for quiz-night/);
  assert.match((await call("locker_bring_app", {})).text, /quiz-night\): withdrawn/);
});

test("status with a codename includes 'Is it working?' so the agent can self-diagnose", async () => {
  const r = await call("locker_status", { codename: "lunch-line", check: true });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /Is it working\? Live and answering in 120 ms/);
});

test("feedback reads the inbox as plain lines", async () => {
  const r = await call("locker_feedback", { codename: "lunch-line" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /lunch-line: 0 feedback, 0 new\./);
  assert.match(r.text, /Feedback button/);
});

test("new_app with bare: true makes an empty folder (no starter app)", async () => {
  const r = await call("new_app", { codename: "bare-one", bare: true });
  assert.equal(r.isError, false, r.text);
  assert.ok(fs.existsSync(path.join(mock.kit, "apps", "bare-one", "AGENTS.md")));
  assert.ok(!fs.existsSync(path.join(mock.kit, "apps", "bare-one", "server.js")));
});

test("join: a non-member gets a friendly error result", async () => {
  const r = await call("locker_join_project", { codename: "taken-app" });
  assert.equal(r.isError, true);
  assert.match(r.text, /Ask its owner to add you/);
});

test("a bad codename is rejected before anything runs", async () => {
  const r = await call("locker_pull_env", { codename: "Not OK!" });
  assert.equal(r.isError, true);
});

test("no secret ever appears in any tool output", () => {
  assert.ok(outputs.length > 15);
  const all = outputs.join("\n");
  for (const secret of [TOKEN, RW_TOKEN, ...APP_SECRETS]) assert.ok(!all.includes(secret), `leaked ${secret}`);
  assert.doesNotMatch(all, /lkr_[A-Za-z0-9_]+|rw_[A-Za-z0-9_]{8,}|sk-or-[A-Za-z0-9-]+/);
});

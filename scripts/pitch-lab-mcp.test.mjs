// End-to-end test of scripts/pitch-lab-mcp.mjs (the /pitch tools): starts the MCP server as a child process against a
// small mock Pitch Lab and speaks MCP to it over stdio. No network. Checks the connect flow, the pitch tools, and that
// the token never shows up in a result.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readEnv } from "./locker.mjs";

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "pitch-lab-mcp.mjs");
const TOKEN = "plab_test-token-never-shown";
const kit = fs.mkdtempSync(path.join(os.tmpdir(), "pitch-kit-"));
const outputs = [];
let mock;
let client;
let polls = 0;
const pitches = [];

function startMock() {
  return new Promise((resolve) => {
    const s = http.createServer(async (req, res) => {
      let raw = "";
      for await (const c of req) raw += c;
      const body = raw ? JSON.parse(raw) : {};
      const send = (status, data) => (res.writeHead(status, { "Content-Type": "application/json" }), res.end(JSON.stringify(data)));
      const url = req.url.split("?")[0];
      if (url === "/api/connect/start") return send(200, { deviceCode: "dev-1", code: "K7QX-M2PA", url: `http://127.0.0.1:${s.address().port}/connect?code=K7QX-M2PA`, expiresIn: 900, interval: 0.01 });
      if (url === "/api/connect/poll") return send(200, ++polls < 2 ? { status: "pending" } : { status: "approved", token: TOKEN, name: "Ana Garcia" });
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "sign_in_required" });
      const view = (p) => ({ ...p, questions: [], record: {}, deck: null, decks: [], shared: true, stale: null });
      if (url === "/api/pitches" && req.method === "GET") return send(200, { pitches: pitches.map((p) => ({ id: p.id, title: p.title, audience: p.audience, answered: 0, decks: 0 })) });
      if (url === "/api/pitches" && req.method === "POST") {
        const p = { id: pitches.length + 1, slug: "abc123", minutes: 3, goal: "", audience_detail: "", sources: [], ...body };
        pitches.push(p);
        return send(201, view(p));
      }
      const m = /^\/api\/pitches\/(\d+)(\/sources)?$/.exec(url);
      const p = m && pitches.find((x) => x.id === Number(m[1]));
      if (!p) return send(404, { error: "No pitch with that number that's yours." });
      if (m[2]) {
        p.sources.push({ id: p.sources.length + 1, title: body.title ?? body.url });
        return send(201, view(p));
      }
      return send(200, view(p));
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

before(async () => {
  mock = await startMock();
  client = new Client({ name: "pitch-lab-mcp-test", version: "1.0.0" });
  const env = { ...process.env, LOCKER_KIT_ROOT: kit, PITCH_LAB_URL: `http://127.0.0.1:${mock.address().port}`, PITCH_LAB_CONNECT_WAIT_MS: "2000", LOCKER_NO_BROWSER: "1" };
  delete env.PITCH_LAB_TOKEN;
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER], env, stderr: "pipe" }));
});

after(async () => {
  await client?.close();
  mock?.close();
  fs.rmSync(kit, { recursive: true, force: true });
});

async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.map((c) => c.text).join("\n");
  outputs.push(text);
  return { text, isError: Boolean(r.isError) };
}

test("the /pitch path: not connected, connect, create, add what the code shows, status with links", async () => {
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["pitch_add_source", "pitch_connect", "pitch_connect_check", "pitch_create", "pitch_list", "pitch_status", "pitch_update_setup"]);

  const before = await call("pitch_list");
  assert.equal(before.isError, true);
  assert.match(before.text, /pitch_connect/, "says which tool to use, not a stack trace");

  assert.match((await call("pitch_connect")).text, /K7QX-M2PA/);
  assert.match((await call("pitch_connect_check")).text, /Connected to Pitch Lab as Ana Garcia/);
  assert.equal(readEnv(path.join(kit, ".env")).PITCH_LAB_TOKEN, TOKEN, "saved to the kit .env");
  assert.match((await call("pitch_connect")).text, /Already connected/);

  const made = await call("pitch_create", { title: "Lunch Line", idea: "See the line before you leave class.", audience: "users" });
  assert.match(made.text, /#1 "Lunch Line".*\/p\/1\?step=grill/);
  const added = await call("pitch_add_source", { id: 1, title: "What the app does (from its code)", text: "Shows the wait. The wait times are simulated." });
  assert.match(added.text, /1 source/);
  assert.equal((await call("pitch_add_source", { id: 1 })).isError, true, "needs text or a url");

  const status = await call("pitch_status", { id: 1 });
  assert.match(status.text, /What the app does \(from its code\)/);
  assert.match(status.text, /Pitch: not written yet/);
  assert.match(status.text, /\/p\/1\?step=grill/);
  assert.match((await call("pitch_list")).text, /#1 Lunch Line/);
  assert.equal((await call("pitch_status", { id: 9 })).isError, true);
});

test("the token never appears in any tool result", () => {
  for (const text of outputs) assert.ok(!text.includes(TOKEN), `leaked in: ${text.slice(0, 80)}`);
});

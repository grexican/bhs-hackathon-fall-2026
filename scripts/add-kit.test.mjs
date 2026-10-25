// Tests scripts/add-kit.mjs on a pretend starter app: files land in the right folders (plain vs React),
// server.js gets its lines once (running it twice changes nothing), and an app without the feedback line is left alone.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { addLeaderboard, addSpeech } from "./add-kit.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "add-kit-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const SERVER = `import http from "node:http";
import { db } from "./db.js";
import { feedback } from "./locker/feedback.mjs";

http.createServer(async (req, res) => {
    if (await feedback(req, res)) return;
    res.end("ok");
});
`;

function app(name, { react = false, server = SERVER } = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, react ? "src" : "public"), { recursive: true });
  if (react) fs.writeFileSync(path.join(dir, "vite.config.ts"), "");
  fs.writeFileSync(path.join(dir, "server.js"), server);
  return dir;
}

test("plain app: speech + leaderboard files, AI kit refreshed, server.js wired once", () => {
  const dir = app("plain");
  addSpeech(dir);
  addLeaderboard(dir);
  for (const f of ["public/speech/listen.js", "public/speech/hold-to-talk.js", "public/scores.js", "locker/transcribe-route.mjs", "locker/leaderboard.mjs", "locker/ai/transcribe.ts", "locker/ai/index.ts"])
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.ok(!fs.existsSync(path.join(dir, "public/speech/HoldToTalk.tsx")), "the React component stays out of a plain app");
  const once = fs.readFileSync(path.join(dir, "server.js"), "utf8");
  assert.match(once, /import \{ transcribeRoute \} from "\.\/locker\/transcribe-route\.mjs";/);
  assert.match(once, /const scores = leaderboard\(db, \{ noul, boards: \{ main: \{\} \} \}\);/);
  assert.match(once, /\n    if \(await transcribeRoute\(req, res, \{ transcribe, user \}\)\) return;\n/, "the route line, indented like the feedback line");
  assert.match(once, /\n    if \(await scores\.route\(req, res, user\)\) return;\n/);
  assert.ok(once.indexOf("transcribeRoute(req") > once.indexOf("await feedback(req"), "after the feedback line");
  assert.ok(once.indexOf("const scores =") > once.lastIndexOf("import "), "the setup comes after every import");
  addSpeech(dir);
  addLeaderboard(dir);
  assert.equal(fs.readFileSync(path.join(dir, "server.js"), "utf8"), once, "running it again changes nothing");
});

test("React app: files in src/lib with the component and types", () => {
  const dir = app("react", { react: true });
  addSpeech(dir);
  addLeaderboard(dir);
  for (const f of ["src/lib/speech/listen.js", "src/lib/speech/HoldToTalk.tsx", "src/lib/speech/listen.d.ts", "src/lib/scores.js", "src/lib/scores.d.ts"]) assert.ok(fs.existsSync(path.join(dir, f)), f);
});

test("an app without the feedback line: files copied, server.js untouched, says why", () => {
  const dir = app("custom", { server: 'import http from "node:http";\nhttp.createServer().listen(3000);\n' });
  const { wired } = addSpeech(dir);
  assert.equal(wired.ok, false);
  assert.match(wired.why, /feedback/);
  assert.ok(!fs.readFileSync(path.join(dir, "server.js"), "utf8").includes("transcribe"));
});

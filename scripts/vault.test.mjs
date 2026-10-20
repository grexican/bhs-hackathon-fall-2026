// Tests kit/locker/vault.mjs: the offline simulator (encrypted on disk), the hub calls (app secret,
// user in the body), just-in-time use with redaction, and request logs that never show a secret in use.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createVault, redact, VaultMissingError } from "../kit/locker/vault.mjs";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const SECRET = "Portal-Pa55word-xyz";

test("simulator: put, has, use, list, remove; stored encrypted, never in plain text", async () => {
  const v = createVault({ DATABASE_PATH: path.join(dir, "app.db") });
  const meta = await v.put({ sub: "u1" }, "portal-password", SECRET);
  assert.equal(meta.hint, "…-xyz");
  assert.equal(meta.simulated, true);
  assert.ok(!fs.readFileSync(path.join(dir, "vault-sim.json"), "utf8").includes(SECRET));
  assert.equal((await v.has({ sub: "u1" }, "portal-password")).name, "portal-password");
  assert.equal(await v.has({ sub: "u2" }, "portal-password"), null, "another person sees nothing");
  assert.equal(await v.use({ sub: "u1" }, "portal-password", "log in", async (s) => s.length), SECRET.length);
  await assert.rejects(v.use({ sub: "u2" }, "portal-password", "log in", async () => 1), VaultMissingError);
  await assert.rejects(v.use({ sub: "u1" }, "portal-password", "", async () => 1), /purpose/);
  assert.equal(await v.remove({ sub: "u1" }, "portal-password"), true);
  assert.deepEqual(await v.list({ sub: "u1" }), []);
  await assert.rejects(v.put("u1", "Bad Name", "x"), /lowercase/);
});

test("errors thrown while a secret is in use come out with it redacted", async () => {
  const v = createVault({ DATABASE_PATH: path.join(dir, "app.db") });
  await v.put("u1", "api-key", SECRET);
  await assert.rejects(
    v.use("u1", "api-key", "call the API", async (key) => {
      throw new Error(`invalid api key: ${key}`);
    }),
    (err) => err.message === "invalid api key: [redacted]" && !err.stack.includes(SECRET),
  );
  assert.equal(redact(`x ${SECRET}`), "x [redacted]", "still redacted just after use (late log lines)");
  assert.equal(redact("x some-other-value"), "x some-other-value");
});

test("connected: talks to the hub with the app secret, user in the body, 404 → VaultMissingError", async () => {
  const seen = [];
  const hub = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    const send = (s, b) => res.writeHead(s, { "Content-Type": "application/json" }).end(JSON.stringify(b));
    if (req.url === "/api/vault/portal-password/use") return JSON.parse(raw).user === "u1" ? send(200, { value: SECRET, name: "portal-password" }) : send(404, { error: "Nothing stored" });
    if (req.url === "/api/vault/list") return send(200, { secrets: [{ name: "portal-password", hint: "…-xyz" }] });
    if (req.url.endsWith("/delete")) return send(200, { deleted: true });
    send(201, { name: "portal-password", hint: "…-xyz" });
  });
  await new Promise((r) => hub.listen(0, "127.0.0.1", r));
  const v = createVault({ LOCKER_URL: `http://127.0.0.1:${hub.address().port}`, LOCKER_APP_SECRET: "app_secret_1" });
  await v.put({ sub: "u1" }, "portal-password", SECRET);
  assert.equal(await v.use({ sub: "u1" }, "portal-password", "log in to fetch grades", async (s) => s), SECRET);
  await assert.rejects(v.use({ sub: "u2" }, "portal-password", "log in", async () => 1), (e) => e.code === "VAULT_NOT_FOUND");
  assert.equal((await v.has("u1", "portal-password")).hint, "…-xyz");
  assert.equal(await v.remove("u1", "portal-password"), true);
  hub.close();
  assert.deepEqual(seen[0], { method: "PUT", url: "/api/vault/portal-password", auth: "Bearer app_secret_1", body: { user: "u1", value: SECRET } });
  assert.deepEqual(seen[1].body, { user: "u1", purpose: "log in to fetch grades" });
  assert.ok(seen.every((s) => !s.url.includes("u1")), "the person's id never goes in a URL");
});

test("request logs (locker/otel.mjs) never show a secret that's in use", () => {
  const script = path.join(dir, "uses-secret.mjs");
  fs.writeFileSync(
    script,
    `import http from "node:http";
import { createVault } from ${JSON.stringify(pathToFileURL(path.join(KIT, "kit/locker/vault.mjs")).href)};
const server = http.createServer((req, res) => res.end("ok")).listen(0, "127.0.0.1", async () => {
  const v = createVault({ DATABASE_PATH: ${JSON.stringify(path.join(dir, "otel", "app.db"))} });
  await v.put("u1", "token", ${JSON.stringify(SECRET)});
  await v.use("u1", "token", "call a site", (t) => fetch("http://127.0.0.1:" + server.address().port + "/login/" + t));
  server.close();
});`,
  );
  const out = execFileSync(process.execPath, ["--import", pathToFileURL(path.join(KIT, "kit/locker/otel.mjs")).href, script], { encoding: "utf8", env: { ...process.env, LOCKER_OTEL: "", npm_lifecycle_event: "" } });
  assert.match(out, /\/login\/\[redacted\]/);
  assert.ok(!out.includes(SECRET));
});

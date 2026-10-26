// Test helper (not a test itself): a tiny mock of the hub (docs: the hub contract v1), a throwaway kit folder and a
// fake `railway` on PATH. Shared by locker.test.mjs and locker-mcp.test.mjs. No network, no real Railway.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export const TOKEN = "lkr_test_secret_token";
export const RW_TOKEN = "rw_project_token_secret";
export const APP_SECRETS = ["or-app-key", "app_secret"];

const project = (codename, name) => ({
  codename,
  name,
  status: "ready",
  url: `https://${codename}-production.up.railway.app`,
  railway: { projectId: "p1", serviceId: "svc-123", environmentId: "e1", dashboardUrl: "https://railway.com/project/p1", inviteUrl: "https://railway.com/invite/abc" },
  ai: { monthlyLimitUsd: 5, usedUsd: 0.12 },
  costs: { railwayUsdThisMonth: 0.04, aiUsdThisMonth: 0.12, updatedAt: "2026-10-20T00:00:00Z" },
});

export async function startMockHub() {
  const projects = new Map([
    ["taken-app", { owner: "someone-else", members: [] }],
    ["claimed-app", { owner: "someone-else", members: [] }],
    ["team-app", { owner: "someone-else", members: ["ana"], project: null }],
  ]);
  projects.get("team-app").project = { codename: "team-app", name: "Team App", status: "ready", url: "https://team-app-production.up.railway.app", role: "member" };
  const flags = { approvalRequired: false };
  let polls = 0;

  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://x");

    if (req.method === "POST" && url.pathname === "/api/cli/start") {
      assert.ok(body.device, "device name sent");
      return send(200, { deviceId: "dev-1", code: "KQ7-4PX", url: "http://hub/connect?code=KQ7-4PX", interval: 0.02, expiresIn: 5 });
    }
    if (url.pathname === "/api/cli/poll") {
      polls++;
      return send(200, polls < 3 ? { status: "pending" } : { status: "approved", token: TOKEN, student: { email: "ana@bhsschools.org", name: "Ana" } });
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "Not signed in." });
    const cn = url.pathname.match(/^\/api\/codenames\/([^/]+)$/);
    if (cn) {
      const p = projects.get(cn[1]);
      if (!p) return send(200, { available: true });
      return send(200, p.owner === "ana" || p.members?.includes("ana") ? { available: true, yours: true } : { available: false, reason: `Someone already took "${cn[1]}".` });
    }
    if (url.pathname === "/api/me") {
      const mine = [...projects.values()].filter((p) => p.owner === "ana" || p.members?.includes("ana")).map((p) => p.project);
      return send(200, { student: { email: "ana@bhsschools.org", name: "Ana" }, projects: mine });
    }
    if (req.method === "POST" && url.pathname === "/api/projects") {
      if (!/^[a-z0-9-]{3,30}$/.test(body.codename)) return send(400, { error: "Bad codename." });
      if (flags.approvalRequired) return send(403, { error: "Making projects needs an organizer's OK first." });
      if (projects.has(body.codename)) return send(409, { error: "That codename is taken. Pick another one." });
      if (flags.failProvision) {
        projects.set(body.codename, { owner: "ana", project: { ...project(body.codename, body.name), role: "owner", status: "failed", error: "Railway timed out" }, body });
        return send(502, { error: "Setting up your project didn't finish: Railway timed out" });
      }
      // First answer is "provisioning", like the real hub while Railway spins up.
      projects.set(body.codename, { owner: "ana", project: { ...project(body.codename, body.name), role: "owner" }, body });
      return send(201, { ...project(body.codename, body.name), status: "provisioning" });
    }
    const rm = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/retry$/);
    if (req.method === "POST" && rm) {
      const p = projects.get(rm[1]);
      if (!p || p.owner !== "ana") return send(404, { error: "No project with that codename." });
      if (p.project.status !== "failed") return send(409, { error: "Only a project that failed to set up can be retried." });
      p.project = { ...project(rm[1], p.body.name), role: "owner" };
      p.retried = true;
      return send(201, { ...p.project, status: "provisioning" });
    }
    const wm = url.pathname.match(/^\/api\/app-requests\/([a-z0-9-]+)\/withdraw$/);
    if (req.method === "POST" && wm) {
      const r = (flags.requests ?? []).find((x) => x.codename === wm[1] && x.status === "pending");
      if (!r) return send(404, { error: `You have no waiting request for "${wm[1]}".` });
      r.status = "withdrawn";
      return send(200, { withdrawn: true });
    }
    if (url.pathname === "/api/app-requests") {
      flags.requests ??= [];
      if (req.method === "GET") return send(200, { requests: flags.requests });
      if (!/^https:\/\/[^/:]+\/?$/.test(body.url ?? "")) return send(400, { error: "The app's address must start with https://" });
      const r = { id: String(flags.requests.length + 1), codename: body.codename, name: body.name ?? body.codename, url: body.url.replace(/\/?$/, "/"), status: "pending", verify: { file: `${body.url.replace(/\/$/, "")}/.well-known/locker-verify.txt`, token: "locker-verify=tok123" } };
      flags.requests.push(r);
      return send(201, r);
    }
    const hm = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/health\/check$/);
    if (req.method === "POST" && hm) {
      const p = projects.get(hm[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      flags.healthChecks = (flags.healthChecks ?? 0) + 1;
      if (flags.healthChecks > 1) return send(429, { error: "Checked less than a minute ago. Try again in a moment." });
      p.project.health = { status: "healthy", hints: [], deploy: { id: "d1", status: "SUCCESS", createdAt: "2026-10-24T10:00:00Z", errorLines: [] }, up: { ok: true, status: 200, ms: 120 }, errors1h: 0, checkedAt: "2026-10-24T12:00:00Z" };
      return send(200, { health: p.project.health });
    }
    const fm = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/feedback$/);
    if (req.method === "GET" && fm) {
      const p = projects.get(fm[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      const all = p.feedback ?? [];
      const items = url.searchParams.get("unread") === "1" ? all.filter((f) => !f.read) : all;
      const rated = all.filter((f) => f.rating);
      return send(200, {
        summary: { total: all.length, unread: all.filter((f) => !f.read).length, averageRating: rated.length ? rated.reduce((n, f) => n + f.rating, 0) / rated.length : null },
        feedback: items.slice(0, Number(url.searchParams.get("limit") ?? 50)),
      });
    }
    const im = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/icon$/);
    if (req.method === "PUT" && im) {
      const p = projects.get(im[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      p.icon = body;
      return send(200, { ...p.listing, iconHash: "abc123", iconType: "image/png" });
    }
    // What's new (hub contract §5c): the deploy ping with an optional note, and the note for the latest deploy.
    const dm = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/(deployed|whats-new)$/);
    if (dm && ((dm[2] === "deployed" && req.method === "POST") || (dm[2] === "whats-new" && req.method === "PUT"))) {
      const p = projects.get(dm[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      flags.deploys ??= [];
      if (dm[2] === "deployed") flags.deploys.push({ codename: dm[1], note: body.note ?? null });
      const text = body.note == null ? null : String(body.note).replace(/\s+/g, " ").trim();
      if (dm[2] === "whats-new" && !text) return send(400, { error: "Write one line about what's new (or skip it)." });
      if (text && text.length > 140) return send(400, { error: `Keep it to one line: 140 characters at most (that one has ${text.length}).` });
      p.notes ??= [];
      if (text) p.notes.unshift({ id: String(p.notes.length + 1), text, at: "2026-10-26T10:00:00.000Z" });
      if (p.project) p.project.whatsNew = p.notes;
      return send(200, { ok: true, note: text ? p.notes[0] : null, notes: p.notes });
    }
    const lm = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/listing$/);
    if (req.method === "PUT" && lm) {
      const p = projects.get(lm[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      const next = { listed: false, tagline: null, description: null, category: null, icon: null, bhsOnly: false, ...p.listing };
      for (const k of Object.keys(next)) if (body[k] !== undefined) next[k] = body[k];
      if (next.listed && !next.tagline) return send(400, { error: "Add a tagline before you list the app: one short line that says what it does." });
      if (next.listed && !next.category) return send(400, { error: "Pick a category before you list the app." });
      p.listing = next;
      return send(200, next);
    }
    const m = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(\/env)?$/);
    if (m) {
      const p = projects.get(m[1]);
      if (!p || (p.owner !== "ana" && !p.members?.includes("ana"))) return send(404, { error: "No project with that codename that you're on. Ask its owner to add you." });
      if (!m[2]) return send(200, p.project);
      return send(200, {
        env: {
          RAILWAY_TOKEN: RW_TOKEN,
          RAILWAY_SERVICE_ID: "svc-123",
          OPENROUTER_API_KEY: APP_SECRETS[0],
          LOCKER_URL: "http://hub",
          LOCKER_APP_ID: "app_1",
          LOCKER_APP_SECRET: APP_SECRETS[1],
          DATABASE_PATH: "/data/app.db",
        },
      });
    }
    send(404, { error: "Not found." });
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const kit = fs.mkdtempSync(path.join(os.tmpdir(), "locker-kit-"));
  fs.writeFileSync(path.join(kit, ".env"), "# my notes\nOPENROUTER_API_KEY=sk-or-root\n");
  // A fake `railway` that records how it was called and whether it got the token.
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "locker-bin-"));
  fs.writeFileSync(
    path.join(bin, "fake-railway.mjs"),
    `const fail = process.env.FAKE_RAILWAY_FAIL;
console.log("railway " + process.argv.slice(2).join(" "));
console.log("token " + (process.env.RAILWAY_TOKEN === "${RW_TOKEN}" ? "present" : "missing"));
if (fail) console.log("Deploy failed");`,
  );
  fs.writeFileSync(path.join(bin, "railway.cmd"), `@node "%~dp0fake-railway.mjs" %*\r\n`);
  fs.writeFileSync(path.join(bin, "railway"), `#!/bin/sh\nnode "$(dirname "$0")/fake-railway.mjs" "$@"\n`, { mode: 0o755 });

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    kit,
    bin,
    projects,
    flags,
    /** The environment a locker script needs to run against this mock instead of the real hub. */
    env(extra = {}) {
      const env = { ...process.env, LOCKER_URL: this.url, LOCKER_KIT_ROOT: kit, LOCKER_NO_BROWSER: "1", LOCKER_POLL_MS: "10", PATH: `${bin}${path.delimiter}${process.env.PATH}`, ...extra };
      delete env.LOCKER_TOKEN;
      return env;
    },
    close() {
      server.close();
      fs.rmSync(kit, { recursive: true, force: true });
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
}

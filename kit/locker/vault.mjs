// The vault: for passwords and API keys your app's USERS give it (a school-portal password a headless
// browser logs in with, someone's own API key). Never keep those in your database, logs, git or the
// browser. The incubator hub keeps them encrypted; your server asks for one only at the moment it uses it.
//
//   import { vault } from "./locker/vault.mjs";
//   await vault.put(user, "portal-password", password);           // when the person types it in
//   const grades = await vault.use(user, "portal-password", "log in to the portal to fetch grades", async (password) => {
//     return await fetchGrades(password);                         // use it here, don't save it anywhere
//   });
//   await vault.has(user, "portal-password");                     // { name, hint, updatedAt, … } or null: no value
//   await vault.remove(user, "portal-password");                  // "Forget my password" button
//
// `user` is the signed-in person: the `user` from the school sign-in (its `sub`), or your app's own id
// for them (a string). With the school sign-in, people can also see and delete what your app keeps on the
// hub's "Passwords apps keep for you" page. Runs on the server only: it needs LOCKER_APP_SECRET.
// Not connected yet (no LOCKER_URL / LOCKER_APP_SECRET)? It's simulated: kept encrypted in data/vault-sim.json
// on your laptop, labelled, so you can build and test the whole flow offline.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Values in use right now (and for 30 seconds after). locker/otel.mjs and redact() replace them with
// [redacted] in any log line.
const live = (globalThis.__lockerSecrets ??= new Set());

/** Replaces any secret that's in use right now with [redacted]. Use it before logging text from outside. */
export function redact(text) {
  let out = String(text ?? "");
  for (const s of live) out = out.replaceAll(s, "[redacted]");
  return out;
}

/** Thrown by vault.use when nothing is stored yet: show "add your password first", not an error page. */
export class VaultMissingError extends Error {
  code = "VAULT_NOT_FOUND";
  constructor(name) {
    super(`Nothing saved as "${name}" for this person yet.`);
    this.name = "VaultMissingError";
  }
}

const userKey = (user) => {
  const key = typeof user === "string" ? user : user?.sub ?? user?.id;
  if (!key) throw new Error("vault: pass the signed-in user (or your app's id for them) as the first argument.");
  return String(key);
};

// ---------- the real one: the hub ----------
async function hub(method, route, body, env) {
  const res = await fetch(`${env.LOCKER_URL.replace(/\/+$/, "")}${route}`, {
    method,
    headers: { Authorization: `Bearer ${env.LOCKER_APP_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 404 && route.endsWith("/use")) return null;
  if (!res.ok) throw Object.assign(new Error(`vault: ${json.error ?? `the hub answered ${res.status}`}`), { status: res.status });
  return json;
}

// ---------- the simulator: encrypted on this laptop, for building offline ----------
function simFiles(env) {
  const dir = path.dirname(env.DATABASE_PATH || "./data/app.db");
  fs.mkdirSync(dir, { recursive: true });
  const keyFile = path.join(dir, ".vault-sim-key");
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  return { store: path.join(dir, "vault-sim.json"), key: Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "hex") };
}
function simLoad(env) {
  const { store, key } = simFiles(env);
  return { key, store, rows: fs.existsSync(store) ? JSON.parse(fs.readFileSync(store, "utf8")) : {} };
}
const simId = (user, name) => `${user}\n${name}`;
function simSeal(key, aad, value) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}
function simOpen(key, aad, sealed) {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
const meta = (name, r) => ({ name, hint: r.hint, length: r.length, createdAt: r.createdAt, updatedAt: r.updatedAt, lastUsedAt: r.lastUsedAt ?? null, simulated: true });
let warned = false;
const simNote = () => {
  if (!warned) console.log("[vault, simulated] Not connected to the hub yet: secrets are kept encrypted in data/vault-sim.json on this laptop.");
  warned = true;
};

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const checkName = (name) => {
  if (!NAME.test(String(name))) throw new Error("vault: names are lowercase letters, digits, dot, dash or underscore, like portal-password.");
};

export function createVault(env = process.env) {
  const real = () => Boolean(env.LOCKER_URL && env.LOCKER_APP_SECRET);
  return {
    /** Saves (or replaces) a secret for this person. Returns what's safe to show: name, hint, dates. */
    async put(user, name, value) {
      checkName(name);
      const v = String(value ?? "");
      if (!v.trim()) throw new Error("vault: nothing to save (the value is empty).");
      if (real()) return hub("PUT", `/api/vault/${name}`, { user: userKey(user), value: v }, env);
      simNote();
      const db = simLoad(env);
      const id = simId(userKey(user), name);
      const now = new Date().toISOString();
      db.rows[id] = { sealed: simSeal(db.key, id, v), hint: v.length >= 12 ? `…${v.slice(-4)}` : "", length: v.length, createdAt: db.rows[id]?.createdAt ?? now, updatedAt: now };
      fs.writeFileSync(db.store, JSON.stringify(db.rows, null, 2));
      return meta(name, db.rows[id]);
    },

    /**
     * Gets the secret just in time, runs `fn(secret)` and returns what fn returns. `purpose` says what
     * it's for (kept in the hub's audit log). While fn runs, the secret is redacted from log lines;
     * errors fn throws come out with the secret replaced by [redacted]. Throws VaultMissingError if
     * nothing is saved yet.
     */
    async use(user, name, purpose, fn) {
      checkName(name);
      if (!String(purpose ?? "").trim()) throw new Error("vault: say what you're using it for (the purpose), like \"log in to fetch grades\".");
      if (typeof fn !== "function") throw new Error("vault: use(user, name, purpose, async (secret) => { … }): use the secret inside the function.");
      let value;
      if (real()) {
        const r = await hub("POST", `/api/vault/${name}/use`, { user: userKey(user), purpose: String(purpose).slice(0, 120) }, env);
        if (!r) throw new VaultMissingError(name);
        value = r.value;
      } else {
        simNote();
        const db = simLoad(env);
        const id = simId(userKey(user), name);
        if (!db.rows[id]) throw new VaultMissingError(name);
        value = simOpen(db.key, id, db.rows[id].sealed);
        db.rows[id].lastUsedAt = new Date().toISOString();
        fs.writeFileSync(db.store, JSON.stringify(db.rows, null, 2));
      }
      const tracked = value.length >= 6; // shorter values would blank out ordinary words in logs
      if (tracked) live.add(value);
      try {
        return await fn(value);
      } catch (err) {
        if (err && typeof err === "object") {
          err.message = redact(err.message);
          if (err.stack) err.stack = redact(err.stack);
        }
        throw err;
      } finally {
        // Request logs can be written a moment after the call returns (when a response body finishes),
        // so the value stays on the redaction list a little longer.
        if (tracked) setTimeout(() => live.delete(value), 30_000).unref();
      }
    },

    /** Is something saved? Returns { name, hint, updatedAt, lastUsedAt, … } or null. Never the value. */
    async has(user, name) {
      checkName(name);
      return (await this.list(user)).find((s) => s.name === name) ?? null;
    },

    /** Everything saved for this person (names, hints, dates; never values). */
    async list(user) {
      if (real()) return (await hub("POST", "/api/vault/list", { user: userKey(user) }, env)).secrets;
      const db = simLoad(env);
      const prefix = `${userKey(user)}\n`;
      return Object.entries(db.rows)
        .filter(([id]) => id.startsWith(prefix))
        .map(([id, r]) => meta(id.slice(prefix.length), r));
    },

    /** Deletes it ("Forget my password"). Returns true if something was deleted. */
    async remove(user, name) {
      checkName(name);
      if (real()) return (await hub("POST", `/api/vault/${name}/delete`, { user: userKey(user) }, env)).deleted;
      const db = simLoad(env);
      const id = simId(userKey(user), name);
      const had = Boolean(db.rows[id]);
      delete db.rows[id];
      fs.writeFileSync(db.store, JSON.stringify(db.rows, null, 2));
      return had;
    },
  };
}

export const vault = createVault();

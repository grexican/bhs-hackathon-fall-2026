// Pitch Lab (the school's pitch coach, pitch-lab.apps.bhslabs.org) from the laptop: connect once, then start a pitch,
// feed it what the app's code shows, and read where it stands. Used by scripts/pitch-lab-mcp.mjs (the /pitch tools).
// The Grill itself stays in Pitch Lab: the student answers it there, in their own words.
// The sign-in is PITCH_LAB_TOKEN in the kit .env (never printed). PITCH_LAB_URL overrides the address.
import path from "node:path";
import { ROOT, deviceName, mergeEnv, readEnv } from "./locker.mjs";

const ROOT_ENV = path.join(ROOT, ".env");
export const AUDIENCES = ["judges", "investors", "school", "users", "competition", "other"];
export const STEPS = ["setup", "sources", "grill", "pitch"];

export class PitchLabError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export const baseUrl = () => (process.env.PITCH_LAB_URL || readEnv(ROOT_ENV).PITCH_LAB_URL || "https://pitch-lab.apps.bhslabs.org").replace(/\/$/, "");
const token = () => process.env.PITCH_LAB_TOKEN || readEnv(ROOT_ENV).PITCH_LAB_TOKEN;
export const isConnected = () => Boolean(token());

/** The pages the student opens: the workspace (at a step) and the public share link. */
export const links = (p) => ({
  workspace: `${baseUrl()}/p/${p.id}`,
  ...Object.fromEntries(STEPS.map((s) => [s, `${baseUrl()}/p/${p.id}?step=${s}`])),
  ...(p.slug && { share: `${baseUrl()}/s/${p.slug}` }),
});

async function api(method, url, body, { auth = true } = {}) {
  if (auth && !token()) throw new PitchLabError("Not connected to Pitch Lab yet. Use the pitch_connect tool first.");
  let res;
  try {
    res = await fetch(baseUrl() + url, {
      method,
      headers: { Accept: "application/json", ...(body && { "Content-Type": "application/json" }), ...(auth && { Authorization: `Bearer ${token()}` }) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new PitchLabError(`Can't reach Pitch Lab at ${baseUrl()}. Check the internet connection.`);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new PitchLabError("Pitch Lab doesn't know this laptop any more. Use the pitch_connect tool to connect again.", 401);
  if (!res.ok) throw new PitchLabError(json.error ?? `Pitch Lab said ${res.status}.`, res.status);
  return json;
}

// ── connecting ──
export const connectStart = () => api("POST", "/api/connect/start", { device: `Cursor or Claude Code on ${deviceName()}` }, { auth: false });

/** One poll. On approval saves PITCH_LAB_TOKEN to the kit .env and returns the status without it. */
export async function connectPoll(deviceCode) {
  const json = await api("GET", `/api/connect/poll?deviceCode=${encodeURIComponent(deviceCode)}`, null, { auth: false });
  if (json.status === "approved") mergeEnv(ROOT_ENV, { PITCH_LAB_TOKEN: json.token });
  return { status: json.status, name: json.name };
}

// ── pitches ──
export const listPitches = async () => (await api("GET", "/api/pitches")).pitches;
export const getPitch = (id) => api("GET", `/api/pitches/${Number(id)}`);
export const createPitch = (setup) => api("POST", "/api/pitches", setup);
export const updatePitch = (id, setup) => api("PATCH", `/api/pitches/${Number(id)}`, setup);
export const addSource = (id, source) => api("POST", `/api/pitches/${Number(id)}/sources`, source);

/** Where a pitch stands, as short plain text an AI can pass on: step by step, then what to do next and where. */
export function statusText(p) {
  const judged = p.questions.filter((q) => q.verdict);
  const open = p.questions.filter((q) => !q.verdict);
  const rounds = new Set(judged.map((q) => q.round)).size;
  const l = links(p);
  const ready = p.record?.readiness ? Object.entries(p.record.readiness).map(([k, v]) => `${k} ${["nothing yet", "weak", "thin", "strong"][v] ?? v}`).join(", ") : "not judged yet";
  const lines = [
    `#${p.id} ${p.title}: for ${p.audience}${p.audience_detail ? ` (${p.audience_detail})` : ""}, ${p.minutes} min. Wants: ${p.goal || "(not said yet)"}`,
    `Context: ${p.sources.length ? p.sources.map((s) => s.title).join("; ") : "no sources yet"}`,
    `Grill: ${rounds} round${rounds === 1 ? "" : "s"} judged${open.length ? `, ${open.length} question${open.length === 1 ? "" : "s"} waiting for answers` : ""}. Readiness: ${ready}`,
    ...(p.record?.open?.length ? [`Still open: ${p.record.open.slice(0, 3).join(" | ")}`] : []),
    p.deck ? `Pitch: version ${p.decks.length}${p.stale ? " (out of date: new answers or sources since)" : ""}. "${p.deck.one_liner}"` : "Pitch: not written yet (needs one judged round).",
    ...(p.deck?.gaps?.length ? [`Gaps the pitch admits: ${p.deck.gaps.slice(0, 4).join(" | ")}`] : []),
    `Open it: ${open.length || !p.deck ? l.grill : l.pitch}`,
    ...(p.deck && p.shared ? [`Share link (anyone, no names): ${l.share}`] : []),
  ];
  return lines.join("\n");
}

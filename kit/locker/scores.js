// The page side of the leaderboard (the server side is leaderboard.mjs). Plain JavaScript: works in a plain
// HTML game, a canvas game, Phaser, three.js and React. It only talks to YOUR server.
//
//   import { startRun, submitScore, topScores } from "./scores.js";
//   const run = await startRun("main");                                       // when the game starts
//   const result = await submitScore({ board: "main", score: 1200, name: "Nova", run });   // when it ends
//   // result: { score, best, isBest, rank, name }, or it throws an Error with a message to show
//   const { scores, me } = await topScores("main", { period: "week", limit: 10 });
//   // scores: [{ rank, name, score, at, me }], me: { score, rank } or null

const KEY = "leaderboard-device";
let memoryId = null;

/** A random id this browser keeps, so a public game knows "you" without a sign-in. */
export function deviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) localStorage.setItem(KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    // Private mode can block storage: the id lasts until the page closes.
    return (memoryId ??= crypto.randomUUID());
  }
}

/** The name this player typed last time (or ""), and saving a new one. */
export const savedName = () => {
  try {
    return localStorage.getItem("leaderboard-name") ?? "";
  } catch {
    return "";
  }
};
const saveName = (name) => {
  try {
    localStorage.setItem("leaderboard-name", name);
  } catch {
    // no storage: they type it again next time
  }
};

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  // Problems come back as { error } in plain words ("Pick another name"): throw it so the game can show it.
  if (!res.ok) throw Object.assign(new Error(json.error ?? "The leaderboard isn't answering right now."), { status: res.status });
  return json;
}

/** Tells the server a game started (it keeps the stopwatch). Returns a ticket for submitScore. */
export async function startRun(board = "main") {
  return (await call("POST", "/api/scores/start", { board, device: deviceId() })).run;
}

/** Sends a finished game's score. For a "timed" board, leave out score: the server's stopwatch is the score. */
export async function submitScore({ board = "main", score, name = savedName(), run, meta } = {}) {
  const result = await call("POST", "/api/scores", { board, score, name, run, meta, device: deviceId() });
  saveName(result.name);
  return result;
}

/** The table: { scores: [{ rank, name, score, at, me }], me }. period: "all" (default), "week" or "today". */
export async function topScores(board = "main", { period = "all", limit = 10 } = {}) {
  const query = new URLSearchParams({ period, limit: String(limit), device: deviceId() });
  return call("GET", `/api/scores/${encodeURIComponent(board)}?${query}`);
}

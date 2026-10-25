// A game leaderboard in the app's own database (SQLite at DATABASE_PATH). No hub, no account, no extra install.
//
// In server.js (the AI kit is already in every starter app at locker/ai/):
//   import { leaderboard } from "./locker/leaderboard.mjs";
//   import { noul } from "./locker/ai/index.ts";
//   const scores = leaderboard(db, { noul, boards: { main: { maxPerSecond: 20 } } });
//   if (await scores.route(req, res, user)) return;   // next to the feedback line
//
// The page uses scores.js: startRun() when a game starts, submitScore() when it ends, topScores() to show the table.
//
// How it stops cheating (the simple, honest version):
//   1. The server keeps the stopwatch. startRun() gets a ticket with the server's start time; a score
//      that's impossible for the time played (more than maxPerSecond points a second) is refused.
//   2. Each ticket works once, and each player can send a few scores a minute, not hundreds.
//   3. Players are the signed-in person (user.sub, with the BHS sign-in on) or, in a public game, a
//      random id the browser keeps. Someone can still fake a browser id; sign-in is the strong version.
//   4. Names are checked: rules first (length, letters, a list of bad words), then Jev (kit/ai), which
//      catches what a list misses, in Spanish, Catalan and English too. No AI key? The rules still run.
// The game's own code runs on the player's device, so nothing here makes cheating impossible: it makes it hard and visible.
import crypto from "node:crypto";

const DEFAULTS = {
  lowerIsBetter: false, // true for "fewest moves"; for "fastest time" use timed instead
  timed: false, // true: the score IS the time the server measured (seconds, lower is better), the page sends no score
  maxScore: 1_000_000,
  maxPerSecond: null, // e.g. 20: at most 20 points for each second played (needs startRun)
  minSeconds: 0, // a game shorter than this doesn't count
  perMinute: 6, // scores one player may send in a minute
};
const RUN_HOURS = 2; // a ticket is good for this long
const BOARD_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;

// Bad words, in any spelling: "sh1t", "f.u.c.k". ANYWHERE: never part of a normal name. WHOLE: only as a whole word
// (so "Cassandra" and "Dickens" are fine). Jev catches the rest; this list is the part that works with no AI at all.
const ANYWHERE = ["fuck", "shit", "cunt", "nigg", "fagg", "whore", "slut", "porn", "bitch", "mierda", "gilipoll", "maricon", "cabron", "joder", "follar", "pendej", "collons", "hitler"];
const WHOLE = ["ass", "dick", "cock", "fag", "rape", "sex", "puta", "puto", "polla", "cono", "zorra", "verga", "merda", "cony", "nazi", "kkk", "milf"];

const flat = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$]/g, (c) => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" })[c]);

/** The rule check on a nickname: returns { ok, name, why }. Fast and offline; Jev adds judgment on top. */
export function checkNameRules(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 16) return { ok: false, name, why: "Pick a name of 2 to 16 letters." };
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return { ok: false, name, why: "Use letters, numbers, spaces, - or _ only." };
  const squashed = flat(name).replace(/[^a-z]/g, "");
  const words = flat(name).split(/[^a-z]+/).filter(Boolean);
  if (ANYWHERE.some((w) => squashed.includes(w)) || words.some((w) => WHOLE.includes(w)) || WHOLE.includes(squashed))
    return { ok: false, name, why: "That name isn't OK here. Pick another one." };
  return { ok: true, name };
}

/** Midnight today in the school's time zone, as an ISO time. */
function startOfToday(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const sinceMidnight = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnight).toISOString();
}

/** Who is playing: the signed-in person, or a browser's random id. A string is used as it is. */
export function playerId(user, device) {
  if (typeof user === "string") return user;
  if (user?.sub) return `user:${user.sub}`;
  if (typeof device === "string" && /^[A-Za-z0-9-]{8,64}$/.test(device)) return `device:${device}`;
  return null;
}

const fail = (status, message) => Object.assign(new Error(message), { status });

/**
 * Makes the leaderboard. `db` is the app's node:sqlite database (db.js). Options:
 *   boards: { <name>: { lowerIsBetter, timed, maxScore, maxPerSecond, minSeconds, perMinute } } (any other board name gets the defaults)
 *   noul: Jev's noul from kit/ai, for the name check (leave it out and only the rules run)
 *   timeZone: for "today" (default Europe/Madrid)
 */
export function leaderboard(db, { boards = {}, noul, timeZone = "Europe/Madrid", now = () => Date.now() } = {}) {
  db.exec(`
    create table if not exists scores (
      id integer primary key,
      board text not null,
      player text not null,
      name text not null,
      score real not null,
      seconds real,
      meta text,
      at text not null
    );
    create index if not exists scores_by_board on scores (board, score);
    create table if not exists score_runs (
      id text primary key,
      board text not null,
      player text not null,
      started_at integer not null,
      used integer not null default 0
    );
  `);

  const settings = (board) => {
    if (!BOARD_NAME.test(String(board ?? ""))) throw fail(400, "Board names are short: lowercase letters, numbers, - or _.");
    return { ...DEFAULTS, ...boards[board] };
  };
  const lowerWins = (cfg) => cfg.lowerIsBetter || cfg.timed;
  const since = (period = "all") => {
    if (period === "today") return startOfToday(timeZone, new Date(now()));
    if (period === "week") return new Date(now() - 7 * 24 * 3600 * 1000).toISOString(); // the last 7 days
    if (period === "all") return "";
    throw fail(400, 'period is "all", "week" or "today".');
  };

  // Names already judged, so the same name never costs a second AI call.
  const judged = new Map();
  async function checkName(raw) {
    const rules = checkNameRules(raw);
    if (!rules.ok) return rules;
    const key = rules.name.toLowerCase();
    if (!judged.has(key)) {
      const verdict = noul
        ? await noul(
            { nickname: rules.name },
            "Is this nickname fine to show on a game leaderboard at a high school? Not fine: swear words or insults in any language (English, Spanish, Catalan…), sexual, drug or hateful words, even when misspelled on purpose.",
            { true: "fine to show", false: "not fine to show" },
          ).catch(() => null)
        : null;
      // Jev answers the chance it's fine. No answer (no AI key, offline): the rules alone decide.
      judged.set(key, verdict ? verdict.p >= 0.3 : true);
    }
    return judged.get(key) ? rules : { ok: false, name: rules.name, why: "That name isn't OK here. Pick another one." };
  }

  // Scores (and tickets) one player sent in the last minute.
  const recent = new Map();
  const tooMany = (key, limit) => {
    const t = now();
    const times = (recent.get(key) ?? []).filter((x) => t - x < 60_000);
    times.push(t);
    recent.set(key, times);
    return times.length > limit;
  };

  /** A ticket for one game: the server notes when it started. Call it when the game begins. */
  function startRun({ board, user, device }) {
    settings(board);
    const player = playerId(user, device);
    if (!player) throw fail(400, "Who's playing? Send a device id (scores.js does it for you).");
    if (tooMany(`run:${player}`, 30)) throw fail(429, "Too many games started. Wait a minute.");
    const id = crypto.randomUUID();
    db.prepare("insert into score_runs (id, board, player, started_at) values (?, ?, ?, ?)").run(id, board, player, now());
    return id;
  }

  /** Saves a score after the checks. Returns { score, best, isBest, rank, name }. */
  async function submitScore({ board, user, device, name, score, run, meta }) {
    const cfg = settings(board);
    const player = playerId(user, device);
    if (!player) throw fail(400, "Who's playing? Send a device id (scores.js does it for you).");
    if (tooMany(`score:${player}`, cfg.perMinute)) throw fail(429, "That's a lot of scores at once. Wait a minute.");

    // The ticket: the server's own stopwatch for this game.
    let seconds = null;
    if (run) {
      const ticket = db.prepare("select * from score_runs where id = ?").get(String(run));
      if (!ticket || ticket.board !== board || ticket.player !== player) throw fail(400, "That game ticket isn't yours. Start a new game.");
      if (ticket.used) throw fail(409, "That game's score is already saved. Start a new game.");
      if (now() - ticket.started_at > RUN_HOURS * 3600 * 1000) throw fail(400, "That game is too old to count. Start a new game.");
      db.prepare("update score_runs set used = 1 where id = ?").run(ticket.id);
      seconds = (now() - ticket.started_at) / 1000;
    } else if (cfg.timed || cfg.maxPerSecond || cfg.minSeconds) {
      throw fail(400, "Start the game with startRun() first, so the server can time it.");
    }

    if (cfg.timed) score = Math.round(seconds * 1000) / 1000;
    score = Number(score);
    if (!Number.isFinite(score) || score < 0) throw fail(400, "The score has to be a number, 0 or more.");
    if (score > cfg.maxScore) throw fail(400, "That score is higher than this game allows.");
    if (seconds !== null && seconds < cfg.minSeconds) throw fail(400, "That game was too short to count.");
    if (cfg.maxPerSecond && seconds !== null && score > cfg.maxPerSecond * Math.max(seconds, 1)) throw fail(400, "That score is faster than the game allows.");

    // A signed-in player with no name gets their first name and initial (never the full name or email).
    const fallback = typeof user === "object" && user?.name ? user.name.split(/\s+/).map((w, i) => (i ? w[0] + "." : w)).slice(0, 2).join(" ") : "";
    const checked = await checkName(name || fallback);
    if (!checked.ok) throw fail(400, checked.why);

    const before = best(board, player);
    const metaText = meta === undefined ? null : JSON.stringify(meta).slice(0, 500);
    db.prepare("insert into scores (board, player, name, score, seconds, meta, at) values (?, ?, ?, ?, ?, ?, ?)").run(
      board, player, checked.name, Math.round(score * 1000) / 1000, seconds, metaText, new Date(now()).toISOString(),
    );
    const isBest = !before || (lowerWins(cfg) ? score < before.score : score > before.score);
    return { score, best: best(board, player).score, isBest, rank: rank(board, player), name: checked.name };
  }

  /** The best score per player, best first: [{ rank, name, score, at, me }]. period: "all" | "week" | "today". */
  function top(board, { limit = 10, period = "all", player } = {}) {
    const cfg = settings(board);
    const pick = lowerWins(cfg) ? "min" : "max";
    // SQLite gives the other columns (name, at) from the row that holds the min/max: each player's best game.
    const rows = db
      .prepare(`select player, name, ${pick}(score) as score, at from scores where board = ? and at >= ? group by player order by score ${lowerWins(cfg) ? "asc" : "desc"}, at asc limit ?`)
      .all(board, since(period), Math.min(Math.max(Number(limit) || 10, 1), 100));
    let shown = 0;
    return rows.map((row, i) => {
      if (i === 0 || row.score !== rows[i - 1].score) shown = i + 1; // ties share a place
      return { rank: shown, name: row.name, score: row.score, at: row.at, me: player !== undefined && row.player === player };
    });
  }

  /** One player's best: { score, name, at } or null. `user` is a gate user or a player id string. */
  function best(board, user, { period = "all" } = {}) {
    const cfg = settings(board);
    const player = playerId(user);
    const row = db
      .prepare(`select name, ${lowerWins(cfg) ? "min" : "max"}(score) as score, at from scores where board = ? and player = ? and at >= ?`)
      .get(board, player, since(period));
    return row?.score === null || row?.score === undefined ? null : { score: row.score, name: row.name, at: row.at };
  }

  /** A player's place (1 = first), or null before their first score. */
  function rank(board, user, { period = "all" } = {}) {
    const cfg = settings(board);
    const mine = best(board, user, { period });
    if (!mine) return null;
    const pick = lowerWins(cfg) ? "min" : "max";
    const { better } = db
      .prepare(`select count(*) as better from (select ${pick}(score) as s from scores where board = ? and at >= ? group by player) where s ${lowerWins(cfg) ? "<" : ">"} ?`)
      .get(board, since(period), mine.score);
    return better + 1;
  }

  /** Answers the score routes for the page (scores.js). Returns true when it handled the request. */
  async function route(req, res, user) {
    const url = new URL(req.url ?? "/", "http://x");
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const body = async () => {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 5000) throw fail(413, "That's too much data for a score.");
      }
      try {
        return raw ? JSON.parse(raw) : {};
      } catch {
        throw fail(400, "Send the score as JSON.");
      }
    };
    try {
      if (req.method === "POST" && url.pathname === "/api/scores/start") {
        const input = await body();
        return send(201, { run: startRun({ board: input.board, user, device: input.device }) }), true;
      }
      if (req.method === "POST" && url.pathname === "/api/scores") {
        const input = await body();
        return send(201, await submitScore({ ...input, user })), true;
      }
      const match = req.method === "GET" && url.pathname.match(/^\/api\/scores\/([^/]+)$/);
      if (match) {
        const board = decodeURIComponent(match[1]);
        const period = url.searchParams.get("period") ?? "all";
        const player = playerId(user, url.searchParams.get("device") ?? undefined);
        const me = player ? best(board, player, { period }) : null;
        return send(200, { board, period, scores: top(board, { limit: url.searchParams.get("limit"), period, player }), me: me && { ...me, rank: rank(board, player, { period }) } }), true;
      }
    } catch (err) {
      if (!err.status) console.error(`[scores] ${err.message}`);
      return send(err.status ?? 500, { error: err.status ? err.message : "Couldn't save that score right now." }), true;
    }
    return false;
  }

  return { startRun, submitScore, top, best, rank, route, checkName };
}

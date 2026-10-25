// Tests kit/locker/leaderboard.mjs: saving and ranking scores, periods, the server stopwatch, the name check
// (rules + a pretend Jev), rate limits, and the routes the page calls (scores.js). In-memory SQLite, no network.
import assert from "node:assert/strict";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { checkNameRules, leaderboard, playerId } from "../kit/locker/leaderboard.mjs";

// A clock the test moves by hand, so "seconds played" and "today" are exact.
const clock = (start = Date.parse("2026-10-25T10:00:00Z")) => {
  let t = start;
  return { now: () => t, wait: (seconds) => (t += seconds * 1000) };
};

test("scores: best per player, ranks with ties, best and rank", async () => {
  const c = clock();
  const lb = leaderboard(new DatabaseSync(":memory:"), { now: c.now, boards: { main: { perMinute: 100 } } });
  await lb.submitScore({ board: "main", user: "device:aaaaaaaa", name: "Nova", score: 100 });
  await lb.submitScore({ board: "main", user: "device:aaaaaaaa", name: "Nova", score: 300 });
  await lb.submitScore({ board: "main", user: "device:bbbbbbbb", name: "Pixel", score: 300 });
  const r = await lb.submitScore({ board: "main", user: "device:cccccccc", name: "Zed", score: 50 });
  assert.deepEqual({ rank: r.rank, isBest: r.isBest }, { rank: 3, isBest: true });
  const table = lb.top("main", { player: "device:aaaaaaaa" });
  assert.deepEqual(table.map((x) => [x.rank, x.name, x.score, x.me]), [
    [1, "Nova", 300, true],
    [1, "Pixel", 300, false],
    [3, "Zed", 50, false],
  ]);
  assert.equal(lb.best("main", "device:aaaaaaaa").score, 300);
  assert.equal(lb.rank("main", "device:cccccccc"), 3);
  assert.equal(lb.best("main", "device:nobody00"), null);
  assert.equal(lb.rank("main", "device:nobody00"), null);
});

test("periods: today starts at midnight in Barcelona, week is the last 7 days", async () => {
  const c = clock(Date.parse("2026-10-20T12:00:00Z"));
  const lb = leaderboard(new DatabaseSync(":memory:"), { now: c.now });
  await lb.submitScore({ board: "main", user: "device:old00000", name: "Old", score: 999 });
  c.wait(4 * 24 * 3600); // 4 days later: 2026-10-24 12:00 UTC
  await lb.submitScore({ board: "main", user: "device:mid00000", name: "Mid", score: 500 });
  c.wait(11.5 * 3600); // 2026-10-24 23:30 UTC = 01:30 on the 25th in Barcelona
  await lb.submitScore({ board: "main", user: "device:new00000", name: "New", score: 10 });
  assert.deepEqual(lb.top("main", { period: "today" }).map((x) => x.name), ["New"]);
  c.wait(4 * 24 * 3600);
  assert.deepEqual(lb.top("main", { period: "week" }).map((x) => x.name), ["Mid", "New"]);
  assert.deepEqual(lb.top("main").map((x) => x.name), ["Old", "Mid", "New"]);
  assert.throws(() => lb.top("main", { period: "month" }), /period/);
});

test("the server's stopwatch: too fast, too short, tickets used once, timed boards", async () => {
  const c = clock();
  const lb = leaderboard(new DatabaseSync(":memory:"), { now: c.now, boards: { arcade: { maxPerSecond: 10, minSeconds: 5, perMinute: 100 }, race: { timed: true } } });
  const me = "device:runner00";
  await assert.rejects(lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 10 }), /startRun/);
  let run = lb.startRun({ board: "arcade", user: me });
  c.wait(2);
  await assert.rejects(lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 10, run }), /too short/);
  run = lb.startRun({ board: "arcade", user: me });
  c.wait(30);
  await assert.rejects(lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 301, run }), /faster than the game allows/);
  run = lb.startRun({ board: "arcade", user: me });
  c.wait(30);
  await lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 300, run });
  await assert.rejects(lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 1, run }), /already saved/);
  const theirs = lb.startRun({ board: "arcade", user: "device:someone0" });
  await assert.rejects(lb.submitScore({ board: "arcade", user: me, name: "Bolt", score: 1, run: theirs }), /isn't yours/);

  // Timed: the score is the time the server measured, lower wins, whatever the page claims.
  const a = lb.startRun({ board: "race", user: "device:fast0000" });
  const b = lb.startRun({ board: "race", user: "device:slow0000" });
  c.wait(42.5);
  await lb.submitScore({ board: "race", user: "device:fast0000", name: "Fast", score: 0.1, run: a });
  c.wait(10);
  await lb.submitScore({ board: "race", user: "device:slow0000", name: "Slow", run: b });
  assert.deepEqual(lb.top("race").map((x) => [x.name, x.score]), [["Fast", 42.5], ["Slow", 52.5]]);
});

test("limits: score range, board names, scores per minute", async () => {
  const c = clock();
  const lb = leaderboard(new DatabaseSync(":memory:"), { now: c.now, boards: { main: { maxScore: 1000 } } });
  await assert.rejects(lb.submitScore({ board: "main", user: "device:limit000", name: "Max", score: 1001 }), /higher than/);
  await assert.rejects(lb.submitScore({ board: "main", user: "device:limit000", name: "Max", score: -1 }), /0 or more/);
  await assert.rejects(lb.submitScore({ board: "main", user: "device:limit000", name: "Max", score: "lots" }), /number/);
  await assert.rejects(lb.submitScore({ board: "Main Board!", user: "device:limit000", name: "Max", score: 1 }), /Board names/);
  await assert.rejects(lb.submitScore({ board: "main", name: "Max", score: 1 }), /Who's playing/);
  // The limit is per player (default 6 a minute): the 7th in a minute is refused, and a minute later it works again.
  for (let i = 0; i < 6; i++) await lb.submitScore({ board: "main", user: "device:spam0000", name: "Spam", score: i });
  await assert.rejects(lb.submitScore({ board: "main", user: "device:spam0000", name: "Spam", score: 9 }), /Wait a minute/);
  c.wait(61);
  await lb.submitScore({ board: "main", user: "device:spam0000", name: "Spam", score: 9 });
});

test("names: rules catch bad words in any spelling, keep normal names", () => {
  for (const bad of ["sh1t", "F.U.C.K", "puta", "Mierda99", "a s s", "x", "ThisNameIsWayTooLong", "<script>"]) assert.equal(checkNameRules(bad).ok, false, bad);
  for (const fine of ["Cassandra", "Dickens", "Computadora", "Nazir", "Núria", "Pau_22", "Marta G."]) assert.equal(checkNameRules(fine).ok, true, fine);
});

test("names: Jev's judgment on top of the rules, asked once per name; no Jev = rules only", async () => {
  const asked = [];
  // A pretend Jev: "Bobo Feo" is an insult it catches; anything else is fine.
  const noul = async (state) => (asked.push(state.nickname), { p: state.nickname === "Bobo Feo" ? 0.05 : 0.97 });
  const lb = leaderboard(new DatabaseSync(":memory:"), { noul, boards: { main: { perMinute: 100 } } });
  await assert.rejects(lb.submitScore({ board: "main", user: "device:namer000", name: "Bobo Feo", score: 1 }), /isn't OK/);
  await assert.rejects(lb.submitScore({ board: "main", user: "device:namer000", name: "Bobo Feo", score: 1 }), /isn't OK/);
  await lb.submitScore({ board: "main", user: "device:namer000", name: "Luna", score: 1 });
  await assert.rejects(lb.submitScore({ board: "main", user: "device:namer000", name: "shit", score: 1 }), /isn't OK/);
  assert.deepEqual(asked, ["Bobo Feo", "Luna"], "each name asked once, and never for one the rules already refused");

  const offline = leaderboard(new DatabaseSync(":memory:"), { noul: async () => null });
  assert.equal((await offline.submitScore({ board: "main", user: "device:namer000", name: "Bobo Feo", score: 1 })).name, "Bobo Feo");
});

test("players: signed-in person first, then the browser id; signed-in name is first name + initial", async () => {
  assert.equal(playerId({ sub: "abc" }, "device-1234"), "user:abc");
  assert.equal(playerId(undefined, "device-1234"), "device:device-1234");
  assert.equal(playerId(undefined, "no"), null);
  const lb = leaderboard(new DatabaseSync(":memory:"));
  const r = await lb.submitScore({ board: "main", user: { sub: "s1", name: "Marta Garcia Puig", email: "m@school.org" }, score: 5 });
  assert.equal(r.name, "Marta G.");
});

test("routes: start, submit, table with me, friendly errors", async () => {
  const lb = leaderboard(new DatabaseSync(":memory:"), { boards: { main: { maxPerSecond: 1000 } } });
  const server = http.createServer(async (req, res) => {
    if (await lb.route(req, res, undefined)) return;
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };
  try {
    const device = "test-device-0001";
    const start = await call("POST", "/api/scores/start", { board: "main", device });
    assert.equal(start.status, 201);
    const saved = await call("POST", "/api/scores", { board: "main", device, run: start.json.run, name: "Nova", score: 0 });
    assert.equal(saved.status, 201);
    assert.equal(saved.json.rank, 1);
    const table = await call("GET", `/api/scores/main?period=week&device=${device}`);
    assert.equal(table.json.scores[0].me, true);
    assert.deepEqual({ score: table.json.me.score, rank: table.json.me.rank }, { score: 0, rank: 1 });
    assert.equal(table.json.scores[0].player, undefined, "player ids never reach other browsers");
    const bad = await call("POST", "/api/scores", { board: "main", device, name: "Nova", score: 5 });
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /startRun/);
    const notJson = await fetch(`${base}/api/scores`, { method: "POST", body: "{nope" });
    assert.equal(notJson.status, 400);
    assert.equal((await fetch(`${base}/api/other`)).status, 404, "other routes pass through");
  } finally {
    server.close();
  }
});

test("removing scores: by name, only with the app secret over HTTP, never everything by accident", async () => {
  const c = clock();
  const lb = leaderboard(new DatabaseSync(":memory:"), { now: c.now, boards: { main: { perMinute: 100 } } });
  await lb.submitScore({ board: "main", user: "device:aaaaaaaa", name: "test", score: 1234 });
  await lb.submitScore({ board: "main", user: "device:bbbbbbbb", name: "Pixel", score: 300 });
  assert.equal(lb.removeScores({ board: "main" }), 0, "no filter removes nothing");
  process.env.LOCKER_APP_SECRET = "s3cret";
  const server = http.createServer(async (req, res) => (await lb.route(req, res)) || (res.writeHead(404), res.end()));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/api/scores/main?name=TEST`;
  assert.equal((await fetch(base, { method: "DELETE" })).status, 403);
  assert.equal((await fetch(base, { method: "DELETE", headers: { Authorization: "Bearer wrong" } })).status, 403);
  const ok = await fetch(base, { method: "DELETE", headers: { Authorization: "Bearer s3cret" } });
  assert.deepEqual(await ok.json(), { removed: 1 });
  server.close();
  delete process.env.LOCKER_APP_SECRET;
  assert.deepEqual(lb.top("main").map((x) => x.name), ["Pixel"]);
});

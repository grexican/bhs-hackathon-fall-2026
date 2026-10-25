# Playtest your own game with a bot

Read before a checkpoint, when tuning difficulty, or when "it seems fine" needs to become a number.
A bot can't tell you if the game is fun (that's `/playtest` with a real person). It can tell you, in
a minute and without anyone's help: does it crash, is it too easy or too hard, is there an
exploit, and does it hold its frame rate on a phone-sized screen.

The kit already has Playwright installed (`npm run setup`). Background: `playwright-cli` (driving a
browser from the terminal), `verify-in-browser` (screenshots and console errors), `headless-browser`
(running a browser inside an app's server, which is a different job).

## Step 1: a `?debug` hook in the game

Expose just enough for a bot to read and start the game. Only when the URL has `?debug`, never by default:

```js
const params = new URLSearchParams(location.search);
if (params.has("debug")) {
  window.__game = {
    start: () => startGame(),                 // skip the title screen
    snap: () => ({                            // a small, plain copy of the state (no DOM, no class instances)
      state: game.state,                      // "title" | "playing" | "over"
      time: game.time,                        // GAME seconds survived (not wall-clock)
      wave: game.wave, score: game.score, hp: player.hp,
      player: { x: player.x, y: player.y },
      enemies: enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
    }),
  };
}
// Optional: ?speed=4 runs 4 fixed steps per frame, so a 5-minute run takes about 75 s.
const SPEED = params.has("debug") ? Math.min(16, Number(params.get("speed")) || 1) : 1;
```

Measure survival in **game** time (`game.time += dt` in `update`), so a slow machine doesn't change
the result. Read `?seed=` too (`difficulty-and-variety.md`), so runs are repeatable.

## Step 2: the bot script

Save as `apps/<codename>/test/bot.mjs`. Start the app first (`npm run dev` in its folder), then
from the kit root: `node apps/<codename>/test/bot.mjs http://localhost:<port>` (the deployed link works too).

```js
// Plays the real game with real key presses, several bots x several seeds, and reports survival.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4100";   // the running game
const SEEDS = ["a", "b", "c", "d", "e"];
const MAX_S = 300;                          // stop a run after 5 game-minutes

const BOTS = {
  idle: async () => {},                     // does nothing: should die fast
  masher: async (page) => {                 // random keys: a confused beginner
    const k = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"][Math.floor(Math.random() * 5)];
    await page.keyboard.down(k); await page.waitForTimeout(150); await page.keyboard.up(k);
  },
  dodger: async (page, s) => {              // moves away from the nearest enemy: a decent player
    const near = s.enemies.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))[0];
    const keys = [];
    if (near) {
      keys.push(near.x > s.player.x ? "ArrowLeft" : "ArrowRight");
      keys.push(near.y > s.player.y ? "ArrowUp" : "ArrowDown");
    }
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(100);
    for (const k of keys) await page.keyboard.up(k);
  },
};

async function run(browser, bot, seed) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });  // phone-sized
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?debug&speed=4&seed=${seed}`);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => window.__game.start());
  let s;
  do {
    s = await page.evaluate(() => window.__game.snap());
    await BOTS[bot](page, s);
  } while (s.state === "playing" && s.time < MAX_S);
  await page.close();
  return { bot, seed, time: Math.round(s.time), wave: s.wave, score: s.score, errors: errors.length };
}

const browser = await chromium.launch();
try {
  for (const bot of Object.keys(BOTS)) {
    const runs = [];
    for (const seed of SEEDS) runs.push(await run(browser, bot, seed));
    const t = runs.map((r) => r.time).sort((a, b) => a - b);
    console.log(`${bot.padEnd(7)} median ${t[2]}s  min ${t[0]}s  max ${t.at(-1)}s  waves ${runs.map((r) => r.wave)}  errors ${runs.reduce((n, r) => n + r.errors, 0)}`);
  }
} finally {
  await browser.close();
}
```

Real key presses test the real input code. A smarter bot can skip the keyboard: add
`setInput(fn)` to the hook so the game calls the bot's function instead of reading the keys every
step. That's faster and steadier, but it skips the input code, so keep one key-pressing bot too.

## Step 3: read the numbers

| What you see | What it means | Try |
|---|---|---|
| `idle` survives more than a minute | Nothing forces the player to act | Enemies seek the player; spawn faster early |
| `masher` does as well as `dodger` | Skill doesn't matter yet | Telegraphs worth reacting to, enemies that punish standing still |
| `dodger` dies in wave 1-2 | Too hard for a decent player | Slower first waves, longer rests, bigger player hitbox forgiveness |
| `dodger` hits the time cap every seed | Too easy, or no late game | Ramp in later waves, new enemy types |
| One seed is far worse than the rest | A bad spawn or layout from that seed | Replay that seed with `?seed=` and watch |
| Any errors above 0 | A crash or bug in some state | Fix before anything else |

Write the numbers down before and after each tuning change; keep the change that moved them the
way you wanted. A simple exploit bot (circle around the edge, hide in a corner) is worth adding:
if it beats `dodger`, players will find it too.

## Step 4: frame time at phone size

Add one run that records frame times while the bot plays, and fails if the worst 5% are slow:

```js
await page.evaluate(() => {
  window.__ft = []; let last = performance.now();
  const tick = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
// ...let the bot play 10 s at speed=1, then:
const p95 = await page.evaluate(() => { const a = window.__ft.slice(30).sort((x, y) => x - y); return a[Math.floor(a.length * 0.95)]; });
console.log(`p95 frame ${p95.toFixed(1)} ms (60 fps = 16.7)`);
```

Headless Chromium on a laptop is not a phone: treat this as a "did it get worse" alarm, and check
on a real phone too (`/on-my-phone`, `performance.md`).

## Pitfalls

- The `?debug` hook on by default: anyone can cheat in the console. Only with `?debug`.
- Survival in wall-clock time: results change with the machine. Use game time.
- One run per bot: luck. Use 5+ seeds and look at the median.
- Bot results instead of real players. The bot finds crashes and exploits; `/playtest` finds fun.

---

Sources: written for this kit.

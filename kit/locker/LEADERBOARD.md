# Leaderboard: high scores for your game

Scores saved in your app's own database, a top 10 (all time, this week, today), each player's best and
rank, and the basic anti-cheat a real game needs. No account, no extra install. Works with a plain HTML
game, canvas, Phaser, three.js or React.

## Setup (about 5 minutes)

**1. Add it to your app** (from the kit's main folder, with your app's codename):

```bash
node scripts/add-kit.mjs leaderboard my-game
```

It copies `locker/leaderboard.mjs` (server) and `scores.js` (page: `public/scores.js`, or `src/lib/scores.js`
in a React app), and adds these lines to your `server.js`:

```js
import { leaderboard } from "./locker/leaderboard.mjs";
import { noul } from "./locker/ai/index.ts";
const scores = leaderboard(db, { noul, boards: { main: {} } });
// …and next to the feedback line:
if (await scores.route(req, res, user)) return;
```

Then set your game's rule in that `boards` line (see "Stop cheaters" below) and restart `npm run dev`.

**2. Call it from the game.**

Plain HTML game:

```html
<script type="module">
  import { startRun, submitScore, topScores } from "/scores.js";

  let run;
  async function gameStarts() {
    run = await startRun("main");                     // the server starts its stopwatch
  }

  async function gameOver(points) {
    try {
      const result = await submitScore({ board: "main", score: points, name: nameInput.value, run });
      message.textContent = result.isBest ? `New best! You're #${result.rank}` : `You're #${result.rank}`;
    } catch (err) {
      message.textContent = err.message;              // "Pick another name", "That score is faster than…"
    }
    showTable();
  }

  async function showTable() {
    const { scores } = await topScores("main", { period: "week" });   // "all", "week" or "today"
    table.replaceChildren(...scores.map((s) => {
      const row = document.createElement("li");
      row.textContent = `#${s.rank} ${s.name}: ${s.score}`;   // textContent: a player's name is never run as HTML
      row.classList.toggle("me", s.me);                          // highlight this player's own row
      return row;
    }));
  }
</script>
```

React:

```tsx
import { startRun, submitScore, topScores } from "@/lib/scores.js"

const run = useRef<string | undefined>(undefined)
// game starts:  run.current = await startRun("main")
// game over:    const r = await submitScore({ board: "main", score, name, run: run.current })
// the table:    const { scores, me } = await topScores("main", { period: "today" })
```

`submitScore` remembers the name, so next time `submitScore({ score, run })` uses it again (`savedName()` reads it
to pre-fill a box). `topScores` also returns `me`: this player's best and rank, even when they're not in the top 10.

**3. Try it.** Play, lose, see your name in the table. Restart the server: still there. Online, the scores live
next to the database on `/data`, so they survive every deploy.

## Stop cheaters (the honest version)

The game runs on the player's device, so a clever player can send any number. The server doesn't trust the
game; it checks:

| Check | How | Set it |
|---|---|---|
| **The server keeps the stopwatch** | `startRun()` gets a ticket with the server's start time. A score that's impossible for the time played is refused. | `maxPerSecond: 20` (most points a second), `minSeconds: 10` (shortest real game) |
| **Fastest time wins?** | Then the score IS the server's stopwatch: the game can't lie about its time. | `timed: true` (leave out `score`) |
| **Fewest moves wins?** | Lowest score first. | `lowerIsBetter: true` |
| **Highest possible score** | Anything above it is refused. | `maxScore: 5000` (default 1,000,000) |
| **One ticket, one score** | A ticket works once and only for the player who started it. | always on |
| **Not hundreds a minute** | Each player can send a few scores a minute. | `perMinute: 6` (default) |
| **Who is playing** | With the school sign-in on (`LOCKER_GATE=1` or `lazy`), the signed-in person. Without it, a random id the browser keeps. | sign-in is stronger: a browser id can be faked |
| **Names** | 2–16 letters, a bad-word list (any spelling: "sh1t"), then Jev (the AI kit's decision model) for what a list misses, in Spanish, Catalan and English. No AI key: the list still works. | always on |

Several boards, each with its own rules:

```js
const scores = leaderboard(db, {
  noul,
  boards: {
    main: { maxPerSecond: 20, minSeconds: 10 },
    race: { timed: true },
    puzzle: { lowerIsBetter: true, maxScore: 500 },
  },
});
```

On the server you can also call `scores.top("main", { limit: 10, period: "week" })`, `scores.best("main", user)`,
`scores.rank("main", user)` and `scores.submitScore({ board, user, name, score, run })` directly.

## The routes (if you call them without scores.js)

| Route | Send | Get back |
|---|---|---|
| `POST /api/scores/start` | `{ board, device }` | `{ run }` |
| `POST /api/scores` | `{ board, score, name, run, device, meta }` | `{ score, best, isBest, rank, name }` |
| `GET /api/scores/:board?period=week&limit=10&device=…` | | `{ scores: [{ rank, name, score, at, me }], me }` |

Errors are `{ error }` with a message to show the player (400 refused, 409 already saved, 429 too many).
`meta` is anything small you want to keep with a score (level, character), up to 500 characters.

## Privacy

Players are teenagers: nicknames, never full names or emails on the board. A signed-in player with no
nickname shows as first name + initial ("Marta G.").

# Level design for small browser games

Read when the game has authored levels, rooms, an obstacle course or a map. (For endless or wave
games, `difficulty-and-variety.md` covers most of this.) A level is a short lesson plan made of
space: teach a thing, practice it, twist it, test it.

## 1. Measure the player first

Every gap, ledge and corridor size comes from how the player moves. Compute it from the same
constants the movement code uses, so the level follows when the jump changes:

```js
const RUN = 220, JUMP_V = 650, GRAVITY = 1800;           // the same numbers as the player code
const JUMP_HEIGHT = (JUMP_V * JUMP_V) / (2 * GRAVITY);   // ~117 px
const AIR_TIME = (2 * JUMP_V) / GRAVITY;                  // ~0.72 s
const JUMP_DIST = RUN * AIR_TIME;                         // ~159 px on flat ground
const SAFE_GAP = JUMP_DIST * 0.7;                         // required jumps
const HARD_GAP = JUMP_DIST * 0.95;                        // optional, for a reward
```

These are the ideal numbers. Variable jump height and the player's width change them, so build
one test room with gaps of increasing size and see which ones work for real.

## 2. Grey boxes first, art last

Build the whole level from plain rectangles, play it, fix it, and only then add art. Moving a grey
box is free; redrawing a finished scene isn't. A level in a string is the fastest way to start:

```js
const LEVEL = [
  "..............................",
  "..............................",
  ".........ooo..........E.......",
  "......#######.......#####.....",
  "..P.............^^............",
  "#######....###########...#####",
];
// P = player start, # = solid, o = coin, E = enemy, ^ = spikes, . = empty
const TILE = 32;
const solids = [], coins = [];
LEVEL.forEach((row, y) => [...row].forEach((c, x) => {
  if (c === "#") solids.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
  if (c === "o") coins.push({ x: x * TILE + 16, y: y * TILE + 16, r: 10 });
}));
```

Students can draw levels in the text editor, and the AI can generate a few to try.

## 3. Teach, practice, twist, test

For each new idea (a spike, a moving platform, a new enemy):

1. **Introduce** it where failing doesn't hurt: spikes in a pit you can just walk out of.
2. **Practice:** a couple more, easy.
3. **Twist:** combine it with something known (spikes under a moving platform).
4. **Test:** under pressure, near the end of the level.

Never let the first meeting with a hazard be deadly.

## 4. Pace it

Alternate tension and rest. Write the level as beats before building rooms:

```js
const BEATS = [
  { room: "start",    kind: "teach",  intensity: 0.1 },
  { room: "pits",     kind: "skill",  intensity: 0.4 },
  { room: "view",     kind: "rest",   intensity: 0.1 },   // a coin cache, a nice view
  { room: "gauntlet", kind: "skill",  intensity: 0.8 },
  { room: "safe",     kind: "rest",   intensity: 0.2 },   // checkpoint before the climax
  { room: "boss",     kind: "climax", intensity: 1.0 },
];
```

Read the intensity column: it should rise with dips, never stay high the whole time.

## 5. Lead the eye, don't build walls

When playtesters get lost, add guidance before adding walls: a brighter color for the way forward,
coins in a line that point the path, a landmark visible from far away, the exit framed by the
camera. Keep one color for "you can stand on this" and one for "this hurts", everywhere.

## 6. Check it can be finished

If doors need keys, check in code that every key is reachable before its door. A tiny check run
whenever the map changes catches the level where the key sits behind its own door:

```js
// rooms: { name: { exits: [{ to, needs? }], gives? } }. Grow what's reachable until nothing changes.
function canFinish(rooms, start, goal) {
  const have = new Set(), reached = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of reached) {
      const info = rooms[r] ?? { exits: [] };
      if (info.gives && !have.has(info.gives)) { have.add(info.gives); changed = true; }
      for (const e of info.exits) {
        if ((!e.needs || have.has(e.needs)) && !reached.has(e.to)) { reached.add(e.to); changed = true; }
      }
    }
  }
  return reached.has(goal);
}
```

A bot run (`playtest-with-a-bot.md`) that finishes the level is the even stronger check.

## Checkpoints and deaths

- A checkpoint before every hard section. Dying should cost 10-30 seconds, never the whole level.
- Respawn in under a second. Waiting after a death is when players quit.
- Telegraph one-way drops: the player should choose them knowingly.

## Pitfalls

- Art before the layout plays well.
- Gaps sized by eye instead of by the jump numbers.
- The hardest part first because it was the most fun to build.
- A level only the builder can finish: watch someone else play it (`/playtest`).

---

Sources: rewritten for the browser from the level-design discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0).

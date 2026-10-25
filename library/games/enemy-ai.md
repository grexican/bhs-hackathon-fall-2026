# Enemy AI: states, steering, paths, and the Pac-Man ghosts

Read when anything in the game chases, flees, patrols, shoots or ambushes. Good enemy AI is not
"smart". It is **readable** (the player can learn it) and **varied** (each enemy type asks the
player to do something different).

Split every enemy into three small parts and keep them apart:

1. **Decide** what it wants (a state machine): chase, flee, wind up, attack, rest.
2. **Path** around walls (a grid search), only if the map has walls.
3. **Steer** toward the next point smoothly.

## 1. Decide: a state machine in a table

Two to five states with clear rules is plenty. Keep each state's logic and its exits together.

```js
const STATES = {
  chase: {
    update(e, dt) {
      steerToward(e, player, dt);
      if (dist(e, player) < 80) return "windup";       // close enough: get ready to strike
    },
  },
  windup: {                                             // the TELEGRAPH: stop, flash, then lunge
    enter(e) { e.timer = 0.5; e.flash = true; },
    update(e, dt) { e.timer -= dt; if (e.timer <= 0) return "lunge"; },
    exit(e) { e.flash = false; },
  },
  lunge: {
    enter(e) { aimAt(e, player); e.timer = 0.3; },
    update(e, dt) { e.x += e.dirX * 500 * dt; e.y += e.dirY * 500 * dt; e.timer -= dt; if (e.timer <= 0) return "rest"; },
  },
  rest: {                                               // the punish window: the player's turn
    enter(e) { e.timer = 0.8; },
    update(e, dt) { e.timer -= dt; if (e.timer <= 0) return "chase"; },
  },
};

function think(e, dt) {
  const next = STATES[e.state].update(e, dt);
  if (next) {
    STATES[e.state].exit?.(e);
    e.state = next;
    STATES[next].enter?.(e);
  }
}
```

`windup → lunge → rest` is the pattern behind almost every fair attack: warn, strike, then leave
an opening. Draw `e.state` above each enemy while tuning (`?debug`).

## 2. Enemy types that differ

Speed and HP alone make a weak enemy roster. Give each type a different **job**:

| Type | Behavior | Speed / HP | Asks the player to |
|---|---|---|---|
| Swarmer | chases straight at you | fast / 1 hit | keep moving |
| Brute | slow, wind-up charge | slow / 5 hits | sidestep the telegraph |
| Shooter | keeps distance, fires on a rhythm | medium / 2 hits | close the gap |
| Ambusher | aims where you're going | medium / 2 hits | change direction |
| Splitter | splits into two swarmers on death | slow / 3 hits | think before you kill it |

Introduce one new type at a time, each in a calm moment first (`level-design.md`).

## 3. Steer: smooth movement toward a target

```js
// Seek: turn the current velocity toward the desired one, a little each step.
function steerToward(e, target, dt) {
  const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1;
  const wantX = (dx / d) * e.speed, wantY = (dy / d) * e.speed;
  const turn = Math.min(1, e.agility * dt);          // agility ~3-10: how fast it can turn
  e.vx += (wantX - e.vx) * turn;
  e.vy += (wantY - e.vy) * turn;
  e.x += e.vx * dt; e.y += e.vy * dt;
}
```

Low `agility` = enemies overshoot and curve, which the player can exploit (that's good). Flee is
the same with the target direction flipped. Add a small push away from nearby enemies so a crowd
spreads out instead of stacking into one blob.

## 4. Path: around walls on a grid

For a grid map, one **breadth-first search from the player** gives every enemy its next step at
once (a "flow field"). Run it when the player enters a new tile, not every frame.

```js
// dist[y][x] = steps from the player's tile. Enemies move to the neighbor with the smallest number.
function flowField(grid, px, py) {
  const H = grid.length, W = grid[0].length;
  const dist = grid.map((row) => row.map(() => Infinity));
  const queue = [[px, py]]; dist[py][px] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (grid[ny][nx] === 1 || dist[ny][nx] !== Infinity) continue;   // 1 = wall
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}
```

Need different costs per tile (mud, water)? Then it's A*, but most hackathon maps don't.

## Worked example: the Pac-Man ghosts

Four enemies with the same body and the same movement rule, and the game still feels like four
different opponents. The whole trick is **each one picks a different target tile**.

**The movement rule (same for all):** ghosts move tile by tile. At each intersection a ghost picks
the open direction whose next tile is closest (straight-line distance) to its target tile. It never
turns around on its own. That's all. No pathfinding needed.

**The targets (chase mode):**

| Ghost | Role | Target tile |
|---|---|---|
| Red | **Chase** | the player's tile |
| Pink | **Ambush** | 4 tiles ahead of the player, in the direction the player faces |
| Cyan | **Pincer** | take the tile 2 ahead of the player; draw a line from Red to it; double that line. Cyan ends up on the far side, trapping the player between itself and Red |
| Orange | **Shy** | the player's tile when more than 8 tiles away; its scatter corner when closer |

**Scatter / chase phases:** ghosts don't chase all the time. A timer switches all of them between
**scatter** (each one heads to its own corner and circles it) and **chase**. On the first level it
runs about: scatter 7 s, chase 20 s, scatter 7 s, chase 20 s, scatter 5 s, chase 20 s, scatter 5 s,
then chase forever. The scatter beats are the rests in the difficulty curve. When the mode switches,
every ghost **reverses direction**: that's the player's visible cue.

**Frightened:** after a power pellet, ghosts turn blue, slow down and pick random directions at
intersections. They flash before it ends (a telegraph).

```js
const CORNERS = { red: [25, -3], pink: [2, -3], cyan: [27, 31], orange: [0, 31] };

function targetFor(g, mode, pac, ghosts) {
  if (mode === "scatter") return CORNERS[g.name];
  const ahead = (n) => [pac.tx + pac.dirX * n, pac.ty + pac.dirY * n];
  switch (g.name) {
    case "red": return [pac.tx, pac.ty];
    case "pink": return ahead(4);
    case "cyan": {
      const [ax, ay] = ahead(2), red = ghosts.red;
      return [ax + (ax - red.tx), ay + (ay - red.ty)];
    }
    case "orange":
      return Math.hypot(g.tx - pac.tx, g.ty - pac.ty) > 8 ? [pac.tx, pac.ty] : CORNERS.orange;
  }
}

// At an intersection: every open direction except reversing, pick the one nearest the target.
function chooseDir(g, target, isOpen) {
  let best = null, bestD = Infinity;
  for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {      // up, left, down, right (tie order)
    if (dx === -g.dirX && dy === -g.dirY) continue;                   // no U-turns
    if (!isOpen(g.tx + dx, g.ty + dy)) continue;
    const d = Math.hypot(g.tx + dx - target[0], g.ty + dy - target[1]);
    if (d < bestD) { bestD = d; best = [dx, dy]; }
  }
  return best ?? [-g.dirX, -g.dirY];   // dead end: turning around is the only way
}

// Mode timer, in seconds: [mode, duration], then chase forever.
const PHASES = [["scatter", 7], ["chase", 20], ["scatter", 7], ["chase", 20], ["scatter", 5], ["chase", 20], ["scatter", 5]];
```

Corner tiles sit outside the maze on purpose: a ghost can never reach its target, so it loops
around that corner. **Use the idea in any game:** give each enemy type a different target rule
(where you are, where you'll be, the far side of an ally, retreat when close) and a shared phase
timer that gives the player rests. Four simple rules read as teamwork.

## When to use an AI model instead

Rules are free and instant, so use them for anything that runs every frame. For an occasional
decision that rules can't judge well ("is this player turtling?", "which of these three taunts?"),
use Jev (`jev-decisions`): a label in about half a second, with a rule fallback. Never put a chat
model in the frame loop.

## Pitfalls

- Every enemy uses the same rule at a different speed: it reads as one enemy.
- Attacks with no wind-up: hits feel random, not fair.
- Recomputing paths every frame for every enemy: compute one flow field, share it.
- Enemies that stack into one blob: add separation.
- No "stuck" check: if an enemy hasn't moved in 2 s, push it to a new state.

---

Sources: rewritten for the browser from the game-ai discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0). Ghost rules: the original 1980 arcade game, as documented in Jamey Pittman's "The Pac-Man Dossier".

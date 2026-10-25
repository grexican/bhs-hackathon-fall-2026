# Physics and collision (enough for a browser game)

Read when things move and touch: bullets hit enemies, the player lands on platforms, coins get
picked up. Most hackathon games need no physics library. Circles and boxes cover almost everything.
For real 3D physics (stacking, ragdolls) a library is worth it; for three.js scenes, collide with
simple shapes anyway, never with the detailed mesh.

## Two shapes cover most games

```js
// Circle vs circle: compare squared distances (no square root needed).
function circlesHit(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

// Box vs box (axis-aligned, x/y = top-left corner).
function boxesHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

Make hitboxes **smaller than the sprite** for the player (near misses feel great) and a bit
**larger** for things the player wants to touch (coins, pickups). That's the "fair" feeling.

## Moving and landing (platformer)

Move one axis at a time, and resolve each axis right after moving it. Then the player slides
along walls instead of sticking to them.

```js
const GRAVITY = 1800, JUMP_V = 650, RUN = 220;   // px/s², px/s, px/s

function updatePlayer(p, dt, solids) {
  p.vx = input.x * RUN;
  p.vy += GRAVITY * dt;

  p.x += p.vx * dt;
  for (const s of solids) if (boxesHit(p, s)) p.x = p.vx > 0 ? s.x - p.w : s.x + s.w;

  p.y += p.vy * dt;
  p.onGround = false;
  for (const s of solids) if (boxesHit(p, s)) {
    if (p.vy > 0) { p.y = s.y - p.h; p.onGround = true; } else p.y = s.y + s.h;
    p.vy = 0;
  }

  // Coyote time + jump buffer: two small forgivenesses that make jumping feel "right".
  p.coyote = p.onGround ? 0.1 : p.coyote - dt;         // can still jump 0.1 s after leaving a ledge
  p.buffer = input.pressed ? 0.1 : p.buffer - dt;     // a press just before landing still counts
  if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP_V; p.buffer = 0; p.coyote = 0; }

  // Variable jump: let go early = shorter jump.
  if (!input.action && p.vy < 0) p.vy += GRAVITY * dt;  // double gravity while rising without the button
}
```

How high and far can the player jump? `height = JUMP_V² / (2 × GRAVITY)`, and air time is
`2 × JUMP_V / GRAVITY`. Use these numbers to size gaps (`level-design.md`).

## Fast things go through walls (tunneling)

A bullet moving 30 px per step passes straight through a 10 px wall. Fixes, simplest first:
make walls thicker than the fastest thing moves per step; split the move into smaller sub-steps
(`const n = Math.ceil(speed * dt / 8)`); or, for bullets, test the line from old to new position.

## Many things touching many things

100 bullets × 100 enemies = 10,000 checks per step, which is still fine. At 1,000 × 1,000 it isn't.
Then use a grid: put each enemy in a cell (`Math.floor(x / 64)`), and check a bullet only against
its own cell and the neighbors. Measure first (`performance.md`).

## Knockback and bounce

Knockback is a velocity, not a teleport: `e.vx += nx * 400` along the hit direction, then let
friction (`e.vx *= Math.pow(0.001, dt)`) slow it. Bounce off a wall: flip that axis and lose a
little energy, `b.vx = -b.vx * 0.8`.

## Pitfalls

- Colliding detailed meshes or pixel-perfect sprites. Circles and boxes, always.
- Changing an array while looping over it (removing hit bullets). Loop backwards, or mark
  `dead = true` and filter once per step.
- Physics per frame instead of per fixed step: jumps get higher on slow phones. See `game-loop-and-input.md`.

---

Sources: written for this kit (standard 2D game techniques).

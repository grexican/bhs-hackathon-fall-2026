# Performance: hitting 60 fps in the browser (and on phones)

Read when the game stutters, drops frames, gets hot on a phone, or before it goes to real players.
Performance is measuring, not guessing: **measure, find the one biggest cost, fix it, measure again.**

## The budget

60 fps = **16.7 ms per frame** for everything: your update, the drawing, and the browser's own
work. Aim for your code to take under 8 ms on a laptop, because a mid-range phone is 3-5x slower.
A steady 30 fps feels better than a 60 that drops to 20 when the screen fills up.

## Measure first

**A frame-time counter in `?debug`:**

```js
const times = [];
let lastT = performance.now();
function measure(now) {
  times.push(now - lastT); lastT = now;
  if (times.length > 120) times.shift();
  const sorted = [...times].sort((a, b) => a - b);   // debug only: this copy is garbage every frame
  debugEl.textContent = `avg ${(times.reduce((s, v) => s + v, 0) / times.length).toFixed(1)} ms · worst ${sorted.at(-1).toFixed(1)} ms`;
}
```

Watch the **worst** frame, not the average: stutter is a few slow frames. Time one suspect part with
`performance.now()` before and after it.

**The browser's profiler:** Chrome DevTools → Performance → record 5 seconds of play. Look for:
long yellow blocks (your JavaScript), purple (layout: something in the page changes size every
frame), and saw-tooth memory with "Minor GC" (you create garbage every frame). Turn on
"CPU: 4x slowdown" to feel what a phone feels.

**Bots can measure it too:** `playtest-with-a-bot.md` records frame times at phone size.

## The fixes that matter most, in order

1. **Do less work.** Is something running every frame that could run on change, or every 10th
   frame? Pathfinding, sorting, HUD text, searching all enemies for the nearest one.
2. **Stop making garbage every frame.** `new` objects, `[...spread]`, `.map()/.filter()` in the
   frame loop fill memory, and the cleanup causes a stutter every few seconds. Reuse objects.
3. **Pool what spawns a lot** (bullets, particles, damage numbers): make them once, reuse them.

```js
const bullets = Array.from({ length: 300 }, () => ({ alive: false }));
function fire(x, y, vx, vy) {
  const b = bullets.find((b) => !b.alive);   // fine at this size; a free list if it grows
  if (b) Object.assign(b, { alive: true, x, y, vx, vy, life: 1.5 });
}
// "Remove" = b.alive = false. Never splice arrays in the loop.
```

4. **Canvas drawing:**
   - Cap the pixel ratio at 2 (`game-loop-and-input.md`): a 3x phone has 2.25x the pixels of 2x.
   - Draw the static background once to an offscreen canvas, then `drawImage` it each frame.
   - Fewer state changes: group draws by color/style; set `ctx.fillStyle` once per group.
   - Avoid `shadowBlur` and big `filter`s per object: they're very slow. Pre-draw a glow sprite.
   - Text on the canvas is slow-ish; HTML HUD is better (`game-ui.md`).
5. **three.js:**
   - Watch `renderer.info.render.calls` (draw calls). On phones keep it to a few hundred.
   - Many copies of one thing (trees, coins, bricks) → `InstancedMesh`: one draw call for all.
   - Share materials and geometries; don't create them per object or per frame.
   - Real-time shadows are expensive: one shadow-casting light, small shadow map, or fake a blob
     shadow under the player.
   - `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
   - See `threejs-fundamentals` and `gsap-performance` for the deeper notes.

## An automatic safety net

If frames stay slow, step the quality down by itself:

```js
let slowFrames = 0;
function guard(frameMs) {
  slowFrames = frameMs > 22 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
  if (slowFrames > 90 && quality > 0) { quality--; applyQuality(); slowFrames = 0; }  // ~1.5 s of slow frames
}
// applyQuality: lower pixel ratio, fewer particles, no glow, shorter draw distance.
```

## Phones get hot

A game that holds 60 fps for two minutes can drop after five, when the phone heats up and slows
itself down. Test for at least five minutes on a real phone before calling it done.

## Pitfalls

- Optimizing before measuring. The guess is usually wrong.
- Measuring only on a fast laptop.
- `console.log` every frame: logging itself is slow, and it floods the console.
- Loading big images or 3D models without checking their size: a 20 MB model is a long, blank start on phone data.

---

Sources: the measure-first method and fixes from the performance-optimization discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0), rewritten for canvas and three.js.

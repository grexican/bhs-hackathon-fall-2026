# Game feel ("juice") in a browser game

Read right after the first playable version, and whenever the student says "it works but it's
boring" or "it feels flat". Juice is the extra feedback that makes an action feel strong: the same
hit, with a flash, a pause, a shake, particles and a sound, feels five times bigger.

The kit's `game-feel` skill has the principles in more depth. This doc is the browser version, in
plain JS for a canvas game. For three.js, apply the same ideas to the camera and materials.

## The rule: layer it, and scale it by importance

One event triggers several small effects at once. A small event gets a little; a big one gets a lot.
Keep it in one place so the whole game stays consistent:

```js
const FEEL = {
  hit:   { shake: 0.15, stop: 0,    particles: 6,  flash: 0.08 },
  kill:  { shake: 0.3,  stop: 0.05, particles: 16, flash: 0.1 },
  hurt:  { shake: 0.5,  stop: 0.1,  particles: 10, flash: 0.15 },
  boss:  { shake: 1.0,  stop: 0.2,  particles: 60, flash: 0.25 },
};

function feel(kind, x, y) {
  const f = FEEL[kind];
  addTrauma(f.shake);
  hitStop(f.stop);
  burst(x, y, f.particles);
  flashTime = f.flash;
  playSfx(kind);                 // audio-and-music.md
}
```

## Screen shake from "trauma"

Shake that decays smoothly feels good; a random jolt every frame feels like a bug.

```js
let trauma = 0;                       // 0..1
const addTrauma = (t) => { trauma = Math.min(1, trauma + t); };

function applyShake(ctx, dt, time) {
  trauma = Math.max(0, trauma - dt * 1.5);         // fades out in under a second
  const s = trauma * trauma;                       // squared: small hits barely move the screen
  const max = reducedMotion ? 3 : 12;              // pixels
  // Smooth wobble instead of pure random: sine waves at odd frequencies.
  const ox = max * s * Math.sin(time * 47), oy = max * s * Math.sin(time * 61 + 1);
  ctx.translate(ox, oy);                           // call inside save()/restore() before drawing the world
}
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Shake the camera (the drawing), never the player's real position. Don't shake the HUD.

## Hit-stop (freeze frames)

Freeze the game for a few hundredths of a second on a big hit. The brain reads it as weight.

```js
let stopTimer = 0;
const hitStop = (s) => { stopTimer = Math.max(stopTimer, s); };
// In the fixed-step loop: skip the rules while stopped, keep drawing.
function update(dt) {
  if (stopTimer > 0) { stopTimer -= dt; return; }
  // ... the normal game update
}
```

0.03-0.08 s for normal kills, up to 0.2 s for a boss. Longer feels like lag.

## Flash, squash and pop

- **Hit flash:** draw the enemy pure white for 0.08 s after it's hit (`ctx.globalCompositeOperation`
  or just a white rectangle in its shape). This is the single cheapest, strongest effect.
- **Squash and stretch:** on a jump, stretch tall and thin; on landing, squash wide and flat, then
  spring back. Keep the area the same: `sx = 1 + k, sy = 1 - k`.
- **Pop with overshoot:** things that appear (coins, score numbers, buttons) scale past 1 and settle.

```js
// easeOutBack: goes a little past the end, then settles. t goes 0..1.
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
// spawn: e.born = time;  draw: const k = easeOutBack(Math.min(1, (time - e.born) / 0.25));
// ctx.scale(k, k)
```

For DOM parts (menus, the score counter) use GSAP (`gsap-core`, `animate`) instead of hand easing.

## Particles, pooled

```js
const parts = Array.from({ length: 400 }, () => ({ life: 0 }));  // made once, reused forever
function burst(x, y, n, color = "#fff") {
  for (const p of parts) {
    if (n <= 0) break;
    if (p.life > 0) continue;
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
    Object.assign(p, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.3, color });
    n--;
  }
}
function updateParts(dt) {
  for (const p of parts) if (p.life > 0) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.9; p.vy *= 0.9;                     // drag: a burst, not a spray
  }
}
```

## More cheap wins

- **Knockback** on hit (`physics-and-collision.md`), for the enemy and a little for the player.
- **Floating damage or score numbers** that pop, rise and fade.
- **Trails** on fast things: draw the last 5 positions at falling opacity.
- **Anticipation:** a small crouch before a jump, a wind-up before an attack.
- **Vibration** on Android for big hits: `navigator.vibrate?.(30)` (iPhone ignores it).
- **Combo feedback:** each hit in a chain plays a slightly higher pitch.

## Pitfalls

- Juice before the game is playable. Get the core loop working first.
- Everything at maximum. If every hit shakes the screen hard, nothing feels big.
- Hit-stop that also freezes input: buffer the press, don't drop it.
- Ignoring `prefers-reduced-motion`: turn shake and flashes down for those players.

---

Sources: rewritten for the browser from the game-feel discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0) (also vendored as the kit's `game-feel` skill).

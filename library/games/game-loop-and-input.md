# Game loop and input (keyboard, touch, gamepad)

Read before writing the first line of a browser game. It sets up the parts every game needs:
a loop that runs the same speed on every screen, input from three kinds of device, and a canvas
that is sharp on a phone.

## The loop: fixed steps for the rules, every frame for drawing

`requestAnimationFrame` runs at the screen's rate (60, 90, 120 Hz or slower). If the game moves
"5 pixels per frame", it runs twice as fast on a 120 Hz phone. Update the rules in fixed steps,
and draw once per frame.

```js
const STEP = 1 / 60;              // the rules always advance 1/60 s at a time
let acc = 0, last = performance.now(), paused = false;

function frame(now) {
  // Cap the gap: after a tab switch, don't run 500 steps to catch up.
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (!paused) {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pause when the tab is hidden or the phone locks.
document.addEventListener("visibilitychange", () => { paused = document.hidden; last = performance.now(); });
```

Inside `update(dt)`, every speed is per second: `p.x += p.vx * dt`. Fixed steps also make
collisions stable and let a bot run the game faster (`playtest-with-a-bot.md`).

## A sharp canvas on every screen

```js
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const W = 360, H = 640;           // the game's own units: design for a phone held upright

function fit() {
  // Fit the game area into the window, keep its shape, and use real pixels on phones.
  const scale = Math.min(innerWidth / W, innerHeight / H);
  const dpr = Math.min(devicePixelRatio || 1, 2);   // 3x phones: cap at 2, it's much cheaper
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); // now draw in game units
}
addEventListener("resize", fit); fit();
```

CSS for a game page: `html, body { margin: 0; height: 100%; overflow: hidden; }`, and
`canvas { touch-action: none; display: block; margin: auto; }`. `touch-action: none` stops the
browser from scrolling or zooming when the player drags.

## Input: turn every device into the same "intent"

The game reads one object, `input`, and never cares where it came from.

```js
const input = { x: 0, y: 0, action: false, pressed: false };   // x, y in -1..1; pressed = went down this step
const keys = new Set();
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault(); // no page scroll
});
addEventListener("keyup", (e) => keys.delete(e.code));

// Touch: a virtual stick wherever the thumb lands on the left half, tap on the right = action.
let stick = null;   // { id, x0, y0, x, y }
canvas.addEventListener("pointerdown", (e) => {
  if (e.clientX < innerWidth / 2) stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
  else input.tap = true;
});
canvas.addEventListener("pointermove", (e) => { if (stick && e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; } });
canvas.addEventListener("pointerup", (e) => { if (stick && e.pointerId === stick.id) stick = null; });

function readInput() {
  let x = 0, y = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
  let action = keys.has("Space") || input.tap;
  input.tap = false;

  if (stick) {                                  // 40 px of drag = full speed
    x = Math.max(-1, Math.min(1, (stick.x - stick.x0) / 40));
    y = Math.max(-1, Math.min(1, (stick.y - stick.y0) / 40));
  }
  const pad = navigator.getGamepads?.()[0];     // gamepads are read, not evented
  if (pad) {
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);  // dead zone: worn sticks drift
    x = dz(pad.axes[0]) || x; y = dz(pad.axes[1]) || y;
    action = action || pad.buttons[0]?.pressed;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }          // diagonals aren't faster
  input.pressed = action && !input.action;     // true for one step only: jumps, shots, menu picks
  Object.assign(input, { x, y, action });
}
```

Call `readInput()` once at the top of each `update`. Draw the touch stick (a circle at
`x0, y0` and a dot at `x, y`) so players can see it. Show the right hint for the device:
"Drag to move" on touch (`matchMedia("(pointer: coarse)").matches`), "WASD / arrows" on a laptop.

## Game states

Keep one `state` variable: `"title" | "playing" | "paused" | "over"`. `update` and `draw` switch on
it. A restart resets the game objects; it never reloads the page.

## Pitfalls

- Speeds per frame instead of per second: the game runs at a different speed on every screen.
- `keydown` repeat: holding a key fires `keydown` many times. Use the `keys` set for "is it held",
  and act on the first press only for one-shot actions (`if (!e.repeat)`).
- Audio and fullscreen need a tap first. Start them from the first `pointerdown` or key.
- iPhone: no vibration API, and `prefers-reduced-motion` should turn screen shake down.

---

Sources: written for this kit.

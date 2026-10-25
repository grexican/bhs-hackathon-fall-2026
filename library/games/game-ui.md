# Game UI: HUD, menus, pause and game over

Read when the game needs a score, health, a start screen, pause, game over, or settings. The kit's
`game-ui-ux` skill has the principles in depth; this is the browser version. Run it past
`design-director` like any other screen.

## HTML on top of the canvas

Draw the game on the canvas. Put text, buttons and menus in normal HTML on top of it. HTML text is
sharp, buttons are accessible and tappable for free, and CSS (or GSAP) animates them.

```html
<div id="game">
  <canvas></canvas>
  <div id="hud"><span id="score">0</span><span id="hp"></span></div>
  <div id="menu" class="screen">
    <h1>Lantern Run</h1>
    <button id="play" autofocus>Play</button>
    <p id="best"></p>
  </div>
</div>
```

```css
#game { position: relative; height: 100dvh; }
#hud, .screen { position: absolute; inset: 0; pointer-events: none; }
.screen button { pointer-events: auto; min-height: 48px; min-width: 48px; }  /* thumb-sized */
#hud {
  display: flex; justify-content: space-between; align-items: start;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left));
}
```

`env(safe-area-inset-*)` keeps the HUD clear of the notch and rounded corners. It needs
`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

## Update the HUD on change, not every frame

Writing to the page 60 times a second is slow and makes text flicker. Update when the value changes:

```js
let shownScore = -1;
function syncHud() {
  if (score !== shownScore) { scoreEl.textContent = score; shownScore = score; pop(scoreEl); }
}
const pop = (el) => el.animate([{ transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
```

Health as icons (three hearts) reads faster than a number. Put the most important thing where the
eye already is: near the player, or the top corners. Nothing important at the bottom on phones:
thumbs cover it.

## Screens as one state

```js
function show(state) {          // "title" | "playing" | "paused" | "over"
  game.state = state;
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== state;
  document.querySelector(`#${state} button`)?.focus();   // keyboard and gamepad start on a button
}
```

- **Title:** the name, one big Play button, the best score, a one-line control hint for this device.
- **Pause:** Esc / P / the Start button, and a pause button in a corner on touch. Auto-pause when the tab hides.
- **Game over:** the score, the best score, what killed you (it teaches), the seed, and **Play again**
  focused, so Enter / Space / A restarts immediately. Under a second from death to playing again.

## Gamepad and keyboard in menus

A focused button responds to Enter and Space by itself. For a gamepad, map the D-pad to moving
focus and A to click:

```js
function padMenu(pad) {
  const buttons = [...document.querySelectorAll(".screen:not([hidden]) button")];
  const i = buttons.indexOf(document.activeElement);
  if (pressedOnce(pad, 13)) buttons[(i + 1) % buttons.length]?.focus();                   // D-pad down
  if (pressedOnce(pad, 12)) buttons[(i - 1 + buttons.length) % buttons.length]?.focus();  // D-pad up
  if (pressedOnce(pad, 0)) document.activeElement?.click();                               // A
}
const prev = {};
function pressedOnce(pad, b) { const now = pad.buttons[b]?.pressed; const was = prev[b]; prev[b] = now; return now && !was; }
```

Make focus visible (`button:focus-visible { outline: 3px solid ...; }`): with a controller, it's the
only cursor.

## Best score and settings

Keep them in `localStorage` (wrap it in `try/catch`: private windows can block it). A shared,
online leaderboard needs the server and sign-in; check what the kit offers first.

Settings worth one small screen: sound on/off, music volume, reduce shake and flashes.

## Pitfalls

- Text drawn on the canvas at small sizes: blurry on phones. Use HTML.
- A menu that needs a mouse. Test it with only the keyboard, then only a thumb.
- "Game over" with no reason and no instant restart.
- HUD in the browser's safe zone on desktop, under the notch on phones. Check with `npm run shot`.

---

Sources: rewritten for the browser from the game-ui-ux discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0) (also vendored as the kit's `game-ui-ux` skill).

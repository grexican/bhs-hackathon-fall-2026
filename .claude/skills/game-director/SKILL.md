---
name: game-director
description: Use before building or changing ANY game - 2D or 3D, arcade, puzzle, platformer, shooter, clicker, runner, "make me a game". Picks the engine, commits to an art style, palette and asset source before the game loop, starts from the kit's game starter, then gets juice, game screens and a scored look before done. Routes to the game-feel, game UI, three.js and motion skills.
---

# Game Director

Your job: no game in this repo looks like coloured rectangles on a black canvas. Run the phases in order.
The always-on minimum is the game floor (`.claude/rules/game.md`); this skill is how you get past it.

## Phase 1: the verb and the engine

1. Ask one question: "What does the player DO, second to second?" (dodge, aim, jump, match, steer). Build that verb first.
2. Pick the engine (say the choice and its trade-off in one line):

| The game is | Use |
|---|---|
| Any 2D game with characters, enemies or pickups | **Phaser 3**: `npm run new-app -- <codename> --game` (title, HUD, pause, game over, juice, CC0 art, palette) |
| A tiny toy you'll finish in under an hour (one mechanic, no menus) | Plain `<canvas>` in the `--plain` starter |
| A 2D game inside an app with accounts and pages | The React starter, the game in one `<canvas>` component (or Phaser mounted in a component) |
| 3D (a world, a runner, an obstacle course) | three.js on Vite; read `.claude/skills/threejs-fundamentals/SKILL.md` first |

The `--game` starter is the default for 2D. Change its idea, keep its structure (scenes, `juice.ts`, `palette.ts`).

## Phase 2: art direction, before the loop

Write these in the app's `DESIGN.md` (a `## Game look` section) before gameplay code:

- **Style** (one): pixel art, flat vector, low-poly 3D, neon-on-dark, paper/hand-drawn. Mixed styles look broken.
- **Palette** (5 roles): background, the hero (a color nothing else uses, so the player always finds themselves),
  danger (enemies, hazards), reward (score, pickups), neutral (terrain, rocks). Put them in `src/game/palette.ts`;
  every color in the game comes from there. Page theme to match: `npm run theme` (e.g. `arcade-neon`).
- **Asset source** (one): a CC0 pack (Kenney first), the kit's `image` AI tier with the palette locked in the prompt,
  or hand-made sprites. How, and the license rules: `library/games/art-and-assets.md`.
- **Signature moment:** the one thing a player will remember (a slow-motion final hit, a screen-filling combo).

## Phase 3: first playable, with real art

Sprites from the start, never "rectangles for now". Read only what the step needs from `library/games/start-here.md`
(loop and input, physics, enemy AI). Show it running in the browser before adding more.

## Phase 4: feel and screens

- **Juice:** read `.claude/skills/game-feel/SKILL.md` and `library/games/game-feel.md`. Pass 8 of the 12 items in
  the game floor. In the starter, add effects to the `FEEL` table in `src/game/juice.ts`; every event calls `feel(...)`.
- **Screens and HUD:** read `.claude/skills/game-ui-ux/SKILL.md` and `library/games/game-ui.md`: title, HUD, pause,
  game over, safe areas, touch targets.
- **Sound:** `library/games/audio-and-music.md`. Every action has a sound.
- **Motion in menus:** `gsap-core`, `animate`. 3D look: `threejs-materials`, `threejs-lighting`, `threejs-postprocessing`.

## Phase 5: verify

1. Play one full round in the browser (`verify-in-browser`): start, score, lose, restart. Zero console errors.
2. Phone: 375px, touch works, no scroll or zoom (`npm run shot -- <url>` or `/on-my-phone`).
3. `npm run critique -- <url> --tap` from the kit root: 7/10 or more, or `--accept "<the student's reason>"`.
   Apply the three fixes it gives you; you don't need to see the screenshots to do that.
4. Then a real person: `/playtest`. Tuning with numbers: `library/games/playtest-with-a-bot.md`.

## Rules

- Look before loop. Sprites before mechanics pile up. One style, one palette, one asset source per game.
- Every new asset gets a row in `public/assets/LICENSE.md`. CC0, or CC-BY with credit. Never GPL, NC or "unknown".
- Explain each choice in plain words so the student learns why it works.

# Start here: your first browser game

Read this first when a student wants to make a game. It gives the reading order, the checklist
that makes a game fun, and what "done" means for a game in this kit.

## 1. Pick the shape, then the stack

Ask one question: "What does the player DO, second to second?" (dodge, aim, jump, match, steer).
Build only that verb first. The engine (same answer as `stack-picker` and `game-director`):

| The game is | Use |
|---|---|
| Any 2D game with characters, enemies or pickups (dodger, shooter, platformer, arena) | **Phaser**: `npm run new-app -- <codename> --game`. Title, HUD, pause, game over, juice, CC0 sprites and a palette are already there |
| A tiny toy finished in under an hour (one mechanic, no menus) | Plain `<canvas>` in the `--plain` starter |
| 2D inside an app with accounts and pages around it | The React starter, the game in one component |
| 3D (a world, a runner, an obstacle course) | three.js (`threejs-fundamentals` first) |

Don't hand-roll a 2D engine to draw sprites: Phaser already does loading, scenes, input, physics, tweens,
particles and sound. And never ship rectangles as characters, whatever the engine: decide the look first
(`art-and-assets.md`).

## 2. Reading order for a first game

Read only what the current step needs:

0. `art-and-assets.md`: one style, one palette, one asset source. Before any gameplay code. Always.
1. `game-loop-and-input.md`: the loop, delta time, keyboard + touch + gamepad, a sharp canvas on phones. Always
   for plain canvas; with Phaser (the `--game` starter) the loop and input are done, read it for the ideas.
2. `physics-and-collision.md`: as soon as things move and touch.
3. `enemy-ai.md`: when anything chases, flees or shoots.
4. `game-feel.md`: from the first playable version (the `--game` starter already has `juice.ts`). This is where
   "works" becomes "fun".
5. `difficulty-and-variety.md`: when it plays, but every run feels the same or it's too easy or too hard.
6. `level-design.md`: if the game has authored levels or rooms.
7. `game-ui.md`: score, health, start screen, pause, game over.
8. `audio-and-music.md`: sound effects first, music second.
9. `performance.md`: when it drops below 60 fps, or before it goes on phones.
10. `playtest-with-a-bot.md`: before every checkpoint, and to tune difficulty with numbers.
11. `multiplayer.md`: only if the idea needs two players. Same-device first.

For 3D, also the kit's `threejs-*` skills. For menus and screen transitions, `gsap-*` and `animate`.

## 3. The fun checklist

Go through it after the first playable version. Each "no" is a candidate next step.

- [ ] **Meaningful choices.** The player decides something every few seconds (risk vs safety,
      which target, when to use the special move). If holding one key wins, it isn't a game yet.
- [ ] **Enemies that differ.** At least two kinds that differ in **behavior** (chase, ambush,
      shoot, flee), not only in color: also in **speed** and **HP**. See `enemy-ai.md`.
- [ ] **Telegraphs.** Every dangerous thing warns before it hits (a flash, a wind-up, a line on
      the ground, a sound). Getting hit should feel fair: "I saw it and I was too slow".
- [ ] **A difficulty curve.** Easy first 20 seconds, then it rises in waves with short rests.
- [ ] **Variety per run.** A seed changes spawns, layout or upgrades, so run 5 isn't run 1.
- [ ] **Juice.** Hits shake, flash, pop and make a sound. See `game-feel.md`.
- [ ] **A reason to replay.** A best score, a time, an unlock, "one more wave".
- [ ] **Teach without text.** The first thing that can hurt you shows up when it can't kill you yet.

## 4. Definition of done (a game)

A game is done for a checkpoint when all of these are true. Show the evidence, don't claim it.

- [ ] **Plays on a phone.** Touch controls work at 375px wide, no page scroll or pinch-zoom while
      playing, the HUD is clear of the notch. Check with `/on-my-phone` or `npm run shot`.
- [ ] **Keyboard works on a laptop.** Gamepad is a bonus.
- [ ] **No console errors** (`npm run shot -- <url>` lists them, `verify-in-browser`).
- [ ] **60 fps target.** Measured, not guessed (`performance.md`). 30 fps steady beats 60 that stutters.
- [ ] **Bot-testable.** `?debug` exposes the game state and a start function, and a bot run
      finishes with a survival time (`playtest-with-a-bot.md`).
- [ ] **Starts, ends, restarts.** A start screen, a game over with the score, a restart that doesn't need a page reload.
- [ ] **Pauses when hidden.** Switching tabs or locking the phone pauses the game.
- [ ] **Looks like a game.** Sprites, one palette, the juice checklist in `.claude/rules/game.md` (8 of 12), and
      `npm run critique -- <url> --tap` at 7/10 or more (or the student's accepted reason).

After that, a real person: `/playtest`.

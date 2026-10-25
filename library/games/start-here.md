# Start here: your first browser game

Read this first when a student wants to make a game. It gives the reading order, the checklist
that makes a game fun, and what "done" means for a game in this kit.

## 1. Pick the shape, then the stack

Ask one question: "What does the player DO, second to second?" (dodge, aim, jump, match, steer).
Build only that verb first. Then pick the stack with `stack-picker`:

| The game is | Use |
|---|---|
| Small 2D (snake, dodger, clicker, top-down arena) | Plain `<canvas>` in one HTML file, or the starter's `--plain` page |
| 2D with menus, accounts, a leaderboard page around it | The React starter, with the game in one `<canvas>` component |
| 3D (a world, a runner, an obstacle course) | three.js (`threejs-fundamentals` first) |

One HTML file is a fine game. Don't add a framework to draw rectangles.

## 2. Reading order for a first game

Read only what the current step needs:

1. `game-loop-and-input.md`: the loop, delta time, keyboard + touch + gamepad, a sharp canvas on phones. Always.
2. `physics-and-collision.md`: as soon as things move and touch.
3. `enemy-ai.md`: when anything chases, flees or shoots.
4. `game-feel.md`: right after the first playable version. This is where "works" becomes "fun".
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

After that, a real person: `/playtest`.

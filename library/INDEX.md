# Library index

Scan this before building something non-trivial by hand. If a line fits the task, read that doc
first. One line per doc: `path — when to read it`.

## Games

- `library/games/start-here.md` — any game: engine choice, reading order, the fun checklist, a game's definition of done
- `library/games/art-and-assets.md` — before gameplay code; the game shows rectangles or emoji; picking a style, palette, CC0 packs, AI sprites, licenses
- `library/games/game-loop-and-input.md` — writing the game loop; keyboard, touch or gamepad controls; a sharp canvas on phones
- `library/games/physics-and-collision.md` — things move and touch: hitboxes, jumping and landing, bullets through walls
- `library/games/enemy-ai.md` — anything chases, flees, patrols or attacks; enemy types that differ; the Pac-Man ghost targeting pattern
- `library/games/game-feel.md` — it works but feels flat: screen shake, hit-stop, flash, particles, pop
- `library/games/difficulty-and-variety.md` — too easy, too hard, or every run the same: waves, seeds, upgrades, procedural rooms
- `library/games/level-design.md` — authored levels, rooms or an obstacle course: jump metrics, pacing, teaching, can-it-be-finished check
- `library/games/game-ui.md` — score, health, title, pause, game over, menus with a gamepad, the notch
- `library/games/audio-and-music.md` — sound effects or music: Web Audio synth SFX, ducking, loops, layers
- `library/games/performance.md` — stutter, dropped frames, a hot phone, three.js draw calls
- `library/games/playtest-with-a-bot.md` — tune difficulty with numbers, find crashes and exploits: Playwright bots and a `?debug` hook
- `library/games/multiplayer.md` — two or more players: same device first, then turn-based, then real-time

## Web app features

- `library/web/camera.md` — taking a photo in the app: phone camera vs laptop webcam, the NotFoundError-without-a-prompt trap, error messages
- `library/web/integrations.md` — the app needs another service: free keyless APIs, one API key, users' own accounts (Nango, Activepieces, Composio, n8n), safety rules

Skills already in the kit for games (`.claude/skills/<name>/SKILL.md`):

- `game-director` — any game: engine, art direction, juice, screens, a scored look (start here)
- `stack-picker` — before scaffolding: plain canvas, Phaser (`new-app --game`), or three.js
- `game-feel` · `game-ui-ux` — the principles behind the game-feel and game-ui docs, in depth (routed by `game-director`: read their SKILL.md)
- `threejs-fundamentals` — any 3D game; then `threejs-geometry`, `-materials`, `-lighting`, `-textures`, `-loaders` (models), `-animation`, `-interaction` (picking, controls), `-shaders`, `-postprocessing` (bloom, glow) as needed
- `gsap-core` · `gsap-timeline` · `gsap-performance` — animated menus, title screens, score pops (`gsap-react` in the React starter)
- `animate` · `animation-vocabulary` · `review-animations` — designing motion that feels right, naming it, critiquing it
- `algorithmic-art` — generative visuals with seeded randomness (backgrounds, title art)
- `jev-decisions` — an AI decision for the game that rules can't make (never per frame)
- `verify-in-browser` · `playwright-cli` — screenshots, console errors, driving the game from the terminal
- `/on-my-phone` · `/make-it-an-app` — play it on a phone, install it to the home screen
- `/playtest` — a real person plays it; the bot can't tell you if it's fun

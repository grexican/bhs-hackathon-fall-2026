---
description: Game floor for every game in apps/. Attached automatically when game or scene code changes.
paths:
  - "apps/**/src/game/**"
  - "apps/**/src/scenes/**"
  - "apps/**/*game*.js"
  - "apps/**/*game*.ts"
  - "apps/**/*Game*.tsx"
---

# Game floor (every game)

The minimum for any game in `apps/`. `game-director` goes further; nothing ships below this.

1. **Decide the look before the loop.** One art style (pixel, flat vector, low-poly, neon-on-dark, paper), one
   palette file (`src/game/palette.ts`), one asset source. Write the three in the app's `DESIGN.md`. A new 2D game
   starts from `npm run new-app -- <codename> --game`: it already has all of this, plus the screens and juice below.
2. **Sprites, not rectangles.** The player, enemies and pickups are images (CC0 packs such as Kenney's, or the
   kit's `image` AI tier), tinted from the palette. Plain shapes only for particles, debug and UI panels. Every new
   asset gets a row in `public/assets/LICENSE.md`: CC0, or CC-BY with the credit; never GPL, NC or "unknown".
   How: `library/games/art-and-assets.md`.
3. **The juice checklist.** A hit without feedback is a bug. Pass at least 8 of 12 before "done":
   - [ ] hit-stop on kills (30–120 ms)
   - [ ] screen shake that decays, bigger for bigger events
   - [ ] a white flash on whatever was hit
   - [ ] particles on hits, deaths and pickups
   - [ ] squash and stretch, or a scale pop, on jumps, landings and pickups
   - [ ] eased motion (tweens), never linear UI moves
   - [ ] a sound for every action: shoot, hit, hurt, pickup, UI clicks
   - [ ] screen transitions (fade or slide), no hard cuts
   - [ ] the score pops or counts up when it changes
   - [ ] from death to playing again in under 1 second, no page reload
   - [ ] the camera or HUD reacts to big moments (zoom, pulse, lead)
   - [ ] teach by level: the first danger shows up when it can't kill you yet
   The game starter already passes ten: `src/game/juice.ts` holds the effects in one table (`FEEL`), one call (`feel(...)`).
4. **Screens.** A title, a HUD, pause (also when the tab is hidden), and game over with the score and the best.
5. **Phones.** Touch controls at 375px, no page scroll or zoom while playing, HUD clear of the notch, 60 fps target.
6. **Done = played and scored.** Play one full round in the browser (`verify-in-browser`), zero console errors,
   then `npm run critique -- <url> --tap` from the kit root: **7/10 or more**, or `--accept "<the student's reason>"`.

Deeper: `game-director` (engine, art direction, juice, game UI). Docs: `library/games/start-here.md`.

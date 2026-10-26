# Changelog

## Phase 1: design and game floor (2026-10-26)

Students' agents had the design and game skills but rarely used them, so apps looked default and games
were rectangles. This release puts the know-how where an agent can't miss it: defaults, rules attached by
file path, and a "done" that scores the look.

- **Rules attached by file path** (`.claude/rules/ui.md`, `.claude/rules/game.md`, mirrored to
  `.cursor/rules/*.mdc` by `npm run agents:sync`): a design floor for every screen and a game floor
  (art style first, sprites not rectangles, a 12-item juice checklist) load whenever UI or game files change.
- **`AGENTS.md`:** a short look-and-feel floor and a "make me a game" route near the top. The Locker
  plumbing detail moved to `docs/locker.md` (same rules, linked from a short summary).
- **Game starter:** `npm run new-app -- <codename> --game` (also `new_app` with `game: true`). Phaser 3 on the kit's
  server: title, HUD, pause (also when the tab is hidden), game over, `juice.ts` (shake, hit-stop, flash,
  particles, squash, popping text, sounds), one palette file, scores in SQLite, a `?debug` bot hook, and CC0
  sprites and sounds from Kenney (`public/assets/LICENSE.md`).
- **`npm run critique -- <url> [--tap]`:** screenshots go to the kit's vision tier on the app's own key; a
  score out of 10 and three concrete fixes come back as text. `/ship`, `verify-in-browser` and
  `design-director` now need 7/10, or the student's reason recorded with `--accept`. Logged in
  `apps/<codename>/docs/critique.md`.
- **Theme presets:** six palettes and font pairings with type and spacing scales (`kit/themes/`,
  `npm run theme`). Every starter begins on one (`--theme <preset>`), so nothing starts gray.
- **Fewer competing skills:** 12 design and game skills are now routed (not auto-picked) by two directors,
  `design-director` and the new `game-director`. Nothing was removed; each still runs as `/name`.
- **Library:** `library/games/art-and-assets.md` (style, palette, CC0 sources, AI sprites, licenses),
  `library/web/integrations.md` (free APIs, Nango, Activepieces, Composio, n8n, safety rules), and
  `games/start-here.md` now agrees with `stack-picker` (Phaser for 2D games with sprites).
- **`npm run doctor`** checks for Python (the design lookups) and warns when the kit is behind the event branch.

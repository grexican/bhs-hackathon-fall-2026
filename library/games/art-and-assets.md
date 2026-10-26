# Art and assets: make a game look like a game

Read before the first gameplay code of any game, and whenever a game shows plain rectangles, circles or
emoji as its characters. Looks come from three decisions made early: one style, one palette, one source.

## 1. Pick one style

| Style | Looks like | Fits | Assets from |
|---|---|---|---|
| **Flat vector** | Clean shapes, no outlines or thin ones, crisp at any size | Space, puzzle, casual, phones | Kenney (Simple Space, Shape Characters), AI image tier |
| **Pixel art** | Chunky pixels, limited colors | Retro, platformers, RPGs | Kenney (Pixel Platformer, Tiny Dungeon), OpenGameArt |
| **Neon on dark** | Glowing lines and shapes on near-black | Shooters, rhythm, arcade | White sprites tinted bright + additive particles |
| **Low-poly 3D** | Few polygons, flat-shaded, soft light | three.js worlds, runners | Kenney 3D packs, Quaternius (CC0 models) |
| **Paper / hand-drawn** | Wobbly outlines, paper texture | Story games, cozy games | Draw your own (phone photo → trace), AI image tier |

One style per game. A pixel hero in a vector world looks like a bug.

## 2. Lock a palette (five roles)

- **Background:** dark or light, low contrast with itself.
- **Hero:** a color nothing else uses, so players find themselves instantly.
- **Danger:** enemies and hazards (warm reds, magentas read as "hurts").
- **Reward:** score, coins, pickups (yellows and golds).
- **Neutral:** terrain, rocks, walls.

Put them in one file (`src/game/palette.ts` in the game starter). Every color in the game comes from it.
White or gray sprites can take any palette color with `setTint()` in Phaser (or a canvas `globalCompositeOperation`
tint), so one pack can be recolored to fit. Page around the game: a matching theme (`npm run theme`, `arcade-neon`).

## 3. Get the assets (license first)

**CC0 means anyone may use it for anything, no credit required. Prefer it.**

- **Kenney** (kenney.nl/assets): hundreds of packs, all CC0, consistent styles, sprites + sounds + UI + fonts.
  The game starter ships Simple Space, Digital Audio and Impact Sounds from here.
- **Quaternius** (quaternius.com): CC0 low-poly 3D models (characters, nature, vehicles), many animated.
- **OpenGameArt** (opengameart.org): huge, mixed licenses. Check **each file**: CC0 is fine; CC-BY is fine with
  the credit on the title screen; skip GPL, "NC" (non-commercial), "ND" and anything without a clear license.
- **Fonts:** Google Fonts (open licenses). Pixel games: "Press Start 2P", "VT323", "Silkscreen".
- **Sounds:** Kenney's audio packs (CC0); `library/games/audio-and-music.md` makes sound effects in code.

Download from the official site, copy only the files you use into `public/assets/`, and add a row to
`public/assets/LICENSE.md`: file, pack, author, source URL, license. No row, no file.

## 4. AI-made sprites (the kit's `image` tier)

When no pack fits, generate it, from the server or the terminal (it uses the app's AI budget: a few tries, not loops):

```bash
npm run ai -- image "a small round robot, flat vector game sprite, colors #2de2e6 and #140b2e, centered, plain white background, no text" public/assets/sprites/robot.png
```

- Put the **palette's hex colors and the style words** in every prompt, the same words each time, so the set matches.
- Ask for "plain white background", then make it transparent (`npx @imgly/background-removal-node` or remove
  white with a canvas pass), or keep the art on a matching background.
- Generate at 512 px, show it at 64–128 px. Downscale with smoothing off for pixel art (`pixelArt: true` in Phaser).
- Record it in `LICENSE.md` as "AI-generated with the kit's image model, <date>".

## 5. Sprite sheets and animation

- One image per frame is fine for a hackathon. More than ~20 frames: pack them into a sprite sheet or atlas
  (free: TexturePacker's free mode, or Free Texture Packer) and load with `this.load.atlas(...)`.
- Two-frame animations (bob, blink, flap) at 6–8 fps already make a character feel alive.
- Rotate and scale with tweens instead of drawing more frames: squash on landing, tilt into turns.

## 6. Checklist

- [ ] One style, written in `DESIGN.md`.
- [ ] One palette file; no stray colors in scenes.
- [ ] Player, enemies and pickups are sprites, not shapes.
- [ ] The hero is the only thing in the hero color.
- [ ] Every asset has a `LICENSE.md` row; all CC0 or credited CC-BY.
- [ ] Text uses the theme's fonts, with a dark stroke over busy backgrounds.

Sources: the licenses on kenney.nl, quaternius.com and opengameart.org; Creative Commons license texts.

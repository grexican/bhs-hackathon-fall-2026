# Asset licenses

Every file in `public/assets/` is **CC0 1.0 (public domain)**: free to use, change and share in any
project, including commercial ones, with no credit required. Credit is still kind, so the game's
title screen says "Art and sound: Kenney (kenney.nl), CC0".

| Files | Pack | Author | Source | License |
|---|---|---|---|---|
| `sprites/*.png` (the 128 px `Retina` versions, original names) | Simple Space | Kenney | https://kenney.nl/assets/simple-space | CC0 1.0 |
| `audio/shoot` (`laser4`), `hurt` (`lowDown`), `pickup` (`powerUp2`), `gameover` (`phaserDown3`), `click` (`pepSound1`) | Digital Audio | Kenney | https://kenney.nl/assets/digital-audio | CC0 1.0 |
| `audio/hit` (`impactMetal_heavy_000`) | Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds | CC0 1.0 |

Downloaded from kenney.nl on 2026-10-26. The `.mp3` files are the same sounds converted from the
original `.ogg` (older iPhones can't play `.ogg`).

License text: https://creativecommons.org/publicdomain/zero/1.0/

## Adding more art

- **Kenney** (kenney.nl): hundreds of CC0 packs in matching styles. The safest source: everything is CC0.
- **OpenGameArt** (opengameart.org): check the license of **each** file. Use only CC0 (or CC-BY, and
  then add the credit to this table and to the title screen). Skip anything marked GPL, NC or "unknown".
- **AI-made sprites**: `npm run ai -- image "<prompt>" public/assets/sprites/<name>.png`. Ask for
  the palette's hex colors and "plain flat background" so the art matches. See `library/games/art-and-assets.md`.

Every new file gets a row here: what it is, where it came from, and its license.

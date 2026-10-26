// The game: one Phaser game with a scene per screen. Phaser 3 on purpose: AI models know its API best.
//   Boot (loads art and sound) → Title → Play + Hud (side by side) → Pause (over Play) → GameOver
// The game logic is in src/game/scenes/Play.ts; juice (shake, hit-stop, particles) in src/game/juice.ts;
// every color in src/game/palette.ts. The art and sounds are CC0 (public/assets/LICENSE.md).
import Phaser from "phaser"
import "./theme.css"
import "./style.css"
import { FONT_BODY, FONT_DISPLAY, PALETTE } from "./game/palette.ts"
import { Boot } from "./game/scenes/Boot.ts"
import { Title } from "./game/scenes/Title.ts"
import { Play } from "./game/scenes/Play.ts"
import { Hud } from "./game/scenes/Hud.ts"
import { Pause } from "./game/scenes/Pause.ts"
import { GameOver } from "./game/scenes/GameOver.ts"

// The fonts must be loaded before the first text is drawn, or Phaser draws it in a fallback font.
// Offline (no font server), it gives up after 1.5 s and the game uses the fallback font.
await Promise.race([
  Promise.all([document.fonts.load(`16px ${FONT_DISPLAY}`), document.fonts.load(`16px ${FONT_BODY}`)]),
  new Promise((done) => setTimeout(done, 1500)),
]).catch(() => {})

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: PALETTE.night,
  // A portrait play area 480 wide; its height follows the screen's shape (so a phone is filled edge to edge),
  // then it scales to fit with no stretching. Scenes place things by this.scale.width / height, never fixed numbers.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 480, height: Math.round(Math.min(1040, Math.max(720, (480 * innerHeight) / innerWidth))) },
  physics: { default: "arcade", arcade: { debug: false } },
  input: { activePointers: 2 },
  scene: [Boot, Title, Play, Hud, Pause, GameOver],
})

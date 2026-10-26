// Boot: loads every sprite and sound once, with a progress bar, then opens the title screen.
// New art goes in public/assets/ (and a row in public/assets/LICENSE.md), then one line here.
import Phaser from "phaser"
import { PALETTE } from "../palette.ts"

const SPRITES = ["ship_G", "enemy_A", "enemy_C", "enemy_E", "meteor_detailedLarge", "meteor_small", "star_small", "star_tiny", "icon_plusLarge"]
const SOUNDS = ["shoot", "hit", "hurt", "pickup", "gameover", "click"]

export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot")
  }

  preload() {
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2 - 120, height / 2, 0, 6, PALETTE.hero).setOrigin(0, 0.5)
    this.add.rectangle(width / 2, height / 2, 240, 6).setStrokeStyle(1, PALETTE.dim)
    this.load.on("progress", (p: number) => (bar.width = 240 * p))

    for (const key of SPRITES) this.load.image(key, `assets/sprites/${key}.png`)
    // Two formats: the browser picks the one it can play (older iPhones can't play .ogg).
    for (const key of SOUNDS) this.load.audio(key, [`assets/audio/${key}.ogg`, `assets/audio/${key}.mp3`])
  }

  create() {
    // A soft round "spark" for particles, drawn once instead of loaded.
    const g = this.add.graphics()
    for (let r = 8; r > 0; r--) g.fillStyle(0xffffff, (9 - r) / 9).fillCircle(8, 8, r)
    g.generateTexture("spark", 16, 16)
    // The player's shot: a glowing capsule with a white-hot core (reads as a laser, not a bar).
    g.clear()
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(0, 0, 14, 34, 7)
    g.fillStyle(0xffffff, 0.6).fillRoundedRect(3, 3, 8, 28, 4)
    g.fillStyle(0xffffff, 1).fillRoundedRect(5, 6, 4, 22, 2)
    g.generateTexture("bolt", 14, 34)
    g.destroy()
    this.scene.start("Title")
  }
}

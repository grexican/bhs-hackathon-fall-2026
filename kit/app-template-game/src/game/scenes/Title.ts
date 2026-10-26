// The title screen: the name, how to play in one line, the best score, and "tap to start".
import Phaser from "phaser"
import { css, FONT_BODY, FONT_DISPLAY, PALETTE } from "../palette.ts"
import { sfx } from "../juice.ts"
import { addStarfield } from "../starfield.ts"

export const GAME_TITLE: string = {{nameJson}}

export class Title extends Phaser.Scene {
  private drift!: (deltaMs: number, speedUp?: number) => void

  constructor() {
    super("Title")
  }

  create() {
    const { width, height } = this.scale
    this.drift = addStarfield(this)

    // The hero ship floats gently: the first thing that moves tells you what you'll play.
    const ship = this.add.image(width / 2, height * 0.48, "ship_G").setScale(0.9).setTint(PALETTE.hero)
    this.tweens.add({ targets: ship, y: ship.y - 14, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })

    const title = this.add
      .text(width / 2, height * 0.27, GAME_TITLE.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: "30px", color: css(PALETTE.ink), align: "center", wordWrap: { width: width - 48 }, stroke: css(PALETTE.danger), strokeThickness: 6 })
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0)
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: "Back.easeOut" })

    this.add.text(width / 2, height * 0.35, "Drag or use the arrow keys. Your ship fires on its own.", { fontFamily: FONT_BODY, fontSize: "18px", color: css(PALETTE.ink), align: "center", wordWrap: { width: width - 80 } }).setOrigin(0.5).setAlpha(0.9)

    const best = this.add.text(width / 2, height * 0.6, "", { fontFamily: FONT_BODY, fontSize: "18px", color: css(PALETTE.shot) }).setOrigin(0.5)
    fetch("/api/best")
      .then((r) => r.json())
      .then((d) => best.setText(d.best ? `Best on this server: ${d.best}` : "No best score yet. Set one."))
      .catch(() => best.setText(""))

    // The next action looks like a button (not decoration), and breathes so the eye finds it.
    const start = this.add.container(width / 2, height * 0.69)
    const glow = this.add.rectangle(0, 0, 300, 72, PALETTE.shot, 0.18)
    start.add([glow, this.add.rectangle(0, 0, 280, 60, PALETTE.night).setStrokeStyle(3, PALETTE.shot), this.add.text(0, 0, "TAP TO START", { fontFamily: FONT_DISPLAY, fontSize: "18px", color: css(PALETTE.shot) }).setOrigin(0.5)])
    this.tweens.add({ targets: glow, scaleX: 1.08, scaleY: 1.25, alpha: 0, duration: 900, repeat: -1, ease: "Sine.easeOut" })

    this.add.text(width / 2, height - 28, "Art and sound: Kenney (kenney.nl), CC0", { fontFamily: FONT_BODY, fontSize: "13px", color: css(PALETTE.dim) }).setOrigin(0.5).setAlpha(0.7)

    const go = () => {
      sfx(this, "click", 0.6)
      this.cameras.main.fadeOut(180, 0, 0, 0)
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Play"))
    }
    this.input.once("pointerdown", go)
    this.input.keyboard?.once("keydown-SPACE", go)
    this.input.keyboard?.once("keydown-ENTER", go)

    // ?debug: a bot can read and start the game (library/games/playtest-with-a-bot.md).
    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __game: unknown }).__game = { start: go, snap: () => ({ state: "title" }) }
  }

  update(_time: number, delta: number) {
    this.drift(delta)
  }
}

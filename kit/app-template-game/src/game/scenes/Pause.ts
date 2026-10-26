// Pause: a dimmed overlay over the frozen game. Resume with a tap, Space, P or Esc; or quit to the title.
import Phaser from "phaser"
import { css, FONT_BODY, FONT_DISPLAY, PALETTE } from "../palette.ts"
import { sfx } from "../juice.ts"

export class Pause extends Phaser.Scene {
  constructor() {
    super("Pause")
  }

  create() {
    const { width, height } = this.scale
    const shade = this.add.rectangle(0, 0, width, height, PALETTE.deep, 0).setOrigin(0)
    this.tweens.add({ targets: shade, fillAlpha: 0.72, duration: 160 })
    const title = this.add.text(width / 2, height * 0.4, "PAUSED", { fontFamily: FONT_DISPLAY, fontSize: "32px", color: css(PALETTE.ink) }).setOrigin(0.5).setScale(0.7)
    this.tweens.add({ targets: title, scale: 1, duration: 220, ease: "Back.easeOut" })
    this.add.text(width / 2, height * 0.5, "Tap to keep playing", { fontFamily: FONT_BODY, fontSize: "20px", color: css(PALETTE.shot) }).setOrigin(0.5)
    const quit = this.add.text(width / 2, height * 0.62, "Quit to title", { fontFamily: FONT_BODY, fontSize: "18px", color: css(PALETTE.dim), padding: { x: 16, y: 12 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    const resume = () => {
      sfx(this, "click", 0.5)
      this.scene.stop()
      this.scene.resume("Play")
    }
    quit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation()
      this.scene.stop("Hud")
      this.scene.stop("Play")
      this.scene.start("Title")
    })
    this.input.once("pointerdown", resume)
    for (const key of ["SPACE", "P", "ESC"]) this.input.keyboard?.once(`keydown-${key}`, resume)
  }
}

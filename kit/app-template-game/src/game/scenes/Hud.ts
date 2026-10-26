// The HUD: score, lives and combo, drawn on top of Play. It listens for changes (no polling every frame)
// and pops a value when it changes, so the player feels every point. The pause button is 48px: a thumb fits.
import Phaser from "phaser"
import { css, FONT_BODY, FONT_DISPLAY, PALETTE } from "../palette.ts"

export class Hud extends Phaser.Scene {
  constructor() {
    super("Hud")
  }

  create() {
    const { width } = this.scale
    const top = 22
    this.add.text(20, top - 6, "SCORE", { fontFamily: FONT_BODY, fontSize: "12px", color: css(PALETTE.dim) })
    const score = this.add.text(20, top + 10, "0", { fontFamily: FONT_DISPLAY, fontSize: "20px", color: css(PALETTE.ink), stroke: "#000000", strokeThickness: 4 })
    const combo = this.add.text(20, top + 40, "", { fontFamily: FONT_BODY, fontSize: "16px", color: css(PALETTE.shot) })
    const lives = this.add.container(width - 76, top + 10)

    const drawLives = (n: number) => {
      lives.removeAll(true)
      for (let i = 0; i < n; i++) lives.add(this.add.image(-i * 26, 0, "ship_G").setScale(0.17).setTint(PALETTE.hero))
    }

    // The pause button (top right): a tap target of 48px, with a visible icon.
    const pause = this.add.container(width - 30, top + 10)
    const hit = this.add.rectangle(0, 0, 48, 48, PALETTE.deep, 0.4).setStrokeStyle(1, PALETTE.dim, 0.6)
    pause.add([hit, this.add.rectangle(-5, 0, 4, 16, PALETTE.ink), this.add.rectangle(5, 0, 4, 16, PALETTE.ink)])
    hit.setInteractive({ useHandCursor: true }).on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation()
      ;(this.scene.get("Play") as unknown as { pauseGame: () => void }).pauseGame()
    })

    const pop = (t: Phaser.GameObjects.Text) => this.tweens.add({ targets: t, scale: { from: 1.35, to: 1 }, duration: 160, ease: "Back.easeOut" })
    const onChange = (_parent: unknown, key: string, value: number) => {
      if (key === "score") (score.setText(String(value)), pop(score))
      if (key === "lives") drawLives(value)
      if (key === "combo") (combo.setText(value > 1 ? `COMBO x${value}` : ""), value > 1 && pop(combo))
    }
    drawLives(this.registry.get("lives"))
    this.registry.events.on("changedata", onChange)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off("changedata", onChange))
  }
}

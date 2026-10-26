// Game over: the score counts up, the best score, and one big "play again" (no page reload, under a second).
import Phaser from "phaser"
import { css, FONT_BODY, FONT_DISPLAY, PALETTE } from "../palette.ts"
import { sfx } from "../juice.ts"
import { addStarfield } from "../starfield.ts"

export class GameOver extends Phaser.Scene {
  private drift!: (deltaMs: number, speedUp?: number) => void

  constructor() {
    super("GameOver")
  }

  create(data: { score: number; best: number; saved?: Promise<number> }) {
    const { width, height } = this.scale
    this.drift = addStarfield(this)
    this.cameras.main.fadeIn(200, 0, 0, 0)
    const isBest = data.score > 0 && data.score >= data.best

    this.add.text(width / 2, height * 0.22, "GAME OVER", { fontFamily: FONT_DISPLAY, fontSize: "30px", color: css(PALETTE.danger), stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5)
    const score = this.add.text(width / 2, height * 0.38, "0", { fontFamily: FONT_DISPLAY, fontSize: "44px", color: css(PALETTE.ink) }).setOrigin(0.5)
    // The score counts up instead of just appearing: the payoff for the run.
    this.tweens.addCounter({ from: 0, to: data.score, duration: Math.min(900, 200 + data.score / 10), ease: "Cubic.easeOut", onUpdate: (t) => score.setText(String(Math.round(t.getValue() ?? 0))) })

    const best = this.add.text(width / 2, height * 0.47, isBest ? "NEW BEST!" : `Best: ${data.best}`, { fontFamily: isBest ? FONT_DISPLAY : FONT_BODY, fontSize: isBest ? "18px" : "20px", color: css(PALETTE.shot) }).setOrigin(0.5)
    if (isBest) this.tweens.add({ targets: best, scale: 1.12, duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })
    data.saved?.then((serverBest) => this.sys.isActive() && serverBest > data.score && this.add.text(width / 2, height * 0.52, `Best on this server: ${serverBest}`, { fontFamily: FONT_BODY, fontSize: "16px", color: css(PALETTE.dim) }).setOrigin(0.5))

    // One big button at thumb height.
    const button = this.add.container(width / 2, height * 0.7)
    const bg = this.add.rectangle(0, 0, 280, 64, PALETTE.danger).setStrokeStyle(3, PALETTE.ink)
    button.add([bg, this.add.text(0, 0, "PLAY AGAIN", { fontFamily: FONT_DISPLAY, fontSize: "18px", color: css(PALETTE.deep) }).setOrigin(0.5)])
    button.setScale(0.6).setAlpha(0)
    this.tweens.add({ targets: button, scale: 1, alpha: 1, delay: 250, duration: 300, ease: "Back.easeOut" })
    this.add.text(width / 2, height * 0.79, "or press Space", { fontFamily: FONT_BODY, fontSize: "15px", color: css(PALETTE.dim) }).setOrigin(0.5)

    const again = () => {
      sfx(this, "click", 0.6)
      this.scene.start("Play")
    }
    // A short guard so a tap meant for the last dodge doesn't skip this screen.
    this.time.delayedCall(250, () => {
      bg.setInteractive({ useHandCursor: true }).once("pointerdown", again)
      this.input.keyboard?.once("keydown-SPACE", again)
      this.input.keyboard?.once("keydown-ENTER", again)
    })
  }

  update(_time: number, delta: number) {
    this.drift(delta)
  }
}

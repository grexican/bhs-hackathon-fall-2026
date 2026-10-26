// A drifting starfield in three layers (far = small, dim, slow): depth for free, behind everything.
import Phaser from "phaser"
import { PALETTE } from "./palette.ts"

export function addStarfield(scene: Phaser.Scene, count = 70) {
  const { width, height } = scene.scale
  // A soft glow band near the top so the background isn't one flat color (it fades in and out: no hard edge).
  const glow = scene.add.graphics().setDepth(-11)
  glow.fillGradientStyle(PALETTE.danger2, PALETTE.danger2, PALETTE.danger2, PALETTE.danger2, 0, 0, 0.3, 0.3)
  glow.fillRect(0, 0, width, height * 0.18)
  glow.fillGradientStyle(PALETTE.danger2, PALETTE.danger2, PALETTE.night, PALETTE.night, 0.3, 0.3, 0, 0)
  glow.fillRect(0, height * 0.18, width, height * 0.45)

  const stars = Array.from({ length: count }, () => {
    const layer = Phaser.Math.Between(0, 2)
    const star = scene.add
      .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), layer === 2 ? "star_small" : "star_tiny")
      .setScale([0.08, 0.12, 0.14][layer])
      .setAlpha([0.35, 0.6, 0.95][layer])
      .setTint(layer === 2 ? PALETTE.ink : PALETTE.dim)
      .setDepth(-10)
    return { star, speed: [18, 40, 90][layer] }
  })

  /** Call from update(); speedUp > 1 makes the stars rush (a dash, a boss, a level-up). */
  return (deltaMs: number, speedUp = 1) => {
    for (const s of stars) {
      s.star.y += (s.speed * speedUp * deltaMs) / 1000
      if (s.star.y > height + 8) {
        s.star.y = -8
        s.star.x = Phaser.Math.Between(0, width)
      }
    }
  }
}

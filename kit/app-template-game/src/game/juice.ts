// Juice: the feedback that makes an action feel strong (library/games/game-feel.md).
// One event triggers several small effects at once, scaled by how much it matters. Keep every
// effect in this file and call feel("kill", x, y) from the game, so the whole game stays consistent.
import Phaser from "phaser"
import { PALETTE } from "./palette.ts"

// People who ask their device for less motion get gentler shakes and no flashes.
const CALM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

export const FEEL = {
  hit: { shake: 0.004, stop: 0, particles: 6, sound: "hit" },
  kill: { shake: 0.008, stop: 45, particles: 18, sound: "hit" },
  hurt: { shake: 0.02, stop: 120, particles: 24, sound: "hurt" },
  pickup: { shake: 0, stop: 0, particles: 14, sound: "pickup" },
  death: { shake: 0.035, stop: 260, particles: 60, sound: "gameover" },
} as const
export type Feel = keyof typeof FEEL

/** Shakes the camera; intensity is a fraction of the screen (0.01 = 1%). */
export function shake(scene: Phaser.Scene, intensity: number, ms = 180) {
  if (intensity <= 0) return
  scene.cameras.main.shake(ms, CALM ? intensity * 0.25 : intensity)
}

/** Hit-stop: freezes the action for a few milliseconds so a hit lands. Tweens and timers pause too. */
export function hitStop(scene: Phaser.Scene, ms: number) {
  if (ms <= 0 || scene.physics.world.isPaused) return
  scene.physics.world.pause()
  scene.tweens.timeScale = 0.05
  scene.time.timeScale = 0.05
  // A real-time timeout: the scene's own clock is the thing that's frozen.
  window.setTimeout(() => {
    if (!scene.sys.isActive()) return
    scene.physics.world.resume()
    scene.tweens.timeScale = 1
    scene.time.timeScale = 1
  }, ms)
}

/** A white flash on a sprite (it "blinks" when hit). */
export function flash(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, ms = 60) {
  if (CALM || !sprite.active) return // a destroyed sprite (killed mid-tween) has no scene any more
  sprite.setTintFill(0xffffff)
  sprite.scene.time.delayedCall(ms, () => sprite.active && sprite.clearTint().setTint(sprite.getData("tint") ?? 0xffffff))
}

/** A burst of particles in a color, from the "spark" texture made in Boot. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count: number) {
  const emitter = scene.add.particles(x, y, "spark", {
    speed: { min: 80, max: 340 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.9, end: 0 },
    lifespan: { min: 250, max: 600 },
    tint: [color, PALETTE.ink],
    blendMode: "ADD",
    emitting: false,
  })
  emitter.setDepth(20)
  emitter.explode(count)
  scene.time.delayedCall(800, () => emitter.destroy())
}

/** Squash and stretch: a quick scale pop that settles back (pickups, landing, firing). */
export function squash(target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text, amount = 0.25) {
  if (!target.active) return
  const { scaleX: sx, scaleY: sy } = target
  target.scene.tweens.add({ targets: target, scaleX: sx * (1 + amount), scaleY: sy * (1 - amount), duration: 60, yoyo: true, ease: "Quad.easeOut", onComplete: () => target.setScale(sx, sy) })
}

/** Floating text that pops up and fades ("+100", "1UP"). */
export function popText(scene: Phaser.Scene, x: number, y: number, text: string, color: number, font: string) {
  const label = scene.add.text(x, y, text, { fontFamily: font, fontSize: "16px", color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setDepth(30).setScale(0.4)
  scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: "Back.easeOut" })
  scene.tweens.add({ targets: label, y: y - 48, alpha: 0, delay: 220, duration: 520, ease: "Cubic.easeIn", onComplete: () => label.destroy() })
}

/** Plays a sound with a little random pitch, so repeats don't sound robotic. */
export function sfx(scene: Phaser.Scene, key: string, volume = 0.5) {
  if (!scene.cache.audio.exists(key)) return
  scene.sound.play(key, { volume, detune: Phaser.Math.Between(-120, 120) })
}

/** All of it at once, scaled by importance: feel("kill", x, y, PALETTE.danger). */
export function feel(scene: Phaser.Scene, kind: Feel, x: number, y: number, color: number) {
  const f = FEEL[kind]
  shake(scene, f.shake)
  hitStop(scene, f.stop)
  burst(scene, x, y, color, f.particles)
  sfx(scene, f.sound, kind === "death" ? 0.7 : 0.45)
}

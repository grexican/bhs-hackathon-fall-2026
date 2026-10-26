// The game itself. Second to second, the player DODGES (drag or arrow keys) while the ship fires on its own.
// Four enemy kinds that differ in behavior, a difficulty curve, a +1 life drop, and juice on every hit.
// Replace the enemies and the verb with your own idea; keep the structure (spawn → move → hit → feel).
import Phaser from "phaser"
import { FONT_DISPLAY, PALETTE } from "../palette.ts"
import { feel, flash, popText, sfx, squash } from "../juice.ts"
import { addStarfield } from "../starfield.ts"

type Kind = "drone" | "weaver" | "diver" | "rock" | "pebble"
// Each kind: its sprite, color, hit points, points, size. Behavior is in moveEnemy().
const KINDS: Record<Kind, { sprite: string; tint: number; hp: number; points: number; scale: number }> = {
  drone: { sprite: "enemy_A", tint: PALETTE.danger, hp: 1, points: 100, scale: 0.45 },
  weaver: { sprite: "enemy_C", tint: PALETTE.danger2, hp: 2, points: 200, scale: 0.45 },
  diver: { sprite: "enemy_E", tint: PALETTE.danger, hp: 2, points: 300, scale: 0.5 },
  rock: { sprite: "meteor_detailedLarge", tint: PALETTE.rock, hp: 4, points: 150, scale: 0.6 },
  pebble: { sprite: "meteor_small", tint: PALETTE.rock, hp: 1, points: 50, scale: 0.4 },
}

const START_LIVES = 3
const MAX_LIVES = 5
const FIRE_MS = 170

export class Play extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private arrows!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>
  private drift!: (deltaMs: number, speedUp?: number) => void
  private target: Phaser.Math.Vector2 | null = null
  private elapsed = 0 // GAME seconds survived (not wall-clock), for the difficulty curve
  private nextSpawn = 0
  private nextShot = 0
  private invulnerableUntil = 0
  private over = false

  constructor() {
    super("Play")
  }

  create() {
    const { width, height } = this.scale
    this.over = false
    this.elapsed = 0
    this.nextSpawn = 0.8
    this.nextShot = 0
    this.invulnerableUntil = 0
    this.registry.set({ score: 0, lives: START_LIVES, combo: 1 })
    this.cameras.main.fadeIn(200, 0, 0, 0)
    this.drift = addStarfield(this)

    this.player = this.physics.add.sprite(width / 2, height * 0.82, "ship_G").setScale(0.5).setTint(PALETTE.hero).setData("tint", PALETTE.hero).setCollideWorldBounds(true).setDepth(10)
    // A forgiving hitbox (smaller than the art): near misses feel like skill, not bad luck.
    this.player.setCircle(34, 30, 34)

    this.bullets = this.physics.add.group({ maxSize: 40 })
    this.enemies = this.physics.add.group()
    this.pickups = this.physics.add.group()

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.hitEnemy(b as Phaser.Physics.Arcade.Image, e as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hurtPlayer(e as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.player, this.pickups, (_p, k) => this.collect(k as Phaser.Physics.Arcade.Image))

    // Touch or mouse: the ship follows your finger, a little above it so the finger doesn't hide it.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => (this.target = new Phaser.Math.Vector2(p.x, p.y - 60)))
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => p.isDown && (this.target = new Phaser.Math.Vector2(p.x, p.y - 60)))
    this.input.on("pointerup", () => (this.target = null))
    const kb = this.input.keyboard!
    this.arrows = kb.createCursorKeys()
    this.wasd = kb.addKeys("W,A,S,D") as typeof this.wasd
    kb.on("keydown-P", () => this.pauseGame())
    kb.on("keydown-ESC", () => this.pauseGame())
    // Switching tabs or locking the phone pauses the game.
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.pauseGame, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.HIDDEN, this.pauseGame, this))

    this.scene.launch("Hud")
    this.exposeDebug()
  }

  pauseGame() {
    if (this.over || !this.scene.isActive()) return
    this.scene.pause()
    this.scene.launch("Pause")
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000
    this.drift(delta, this.over ? 0.3 : 1)
    if (this.over) return
    this.elapsed += dt
    this.movePlayer(dt)
    this.autoFire()
    this.spawnWaves()
    for (const e of this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]) this.moveEnemy(e, dt)
    this.cleanUp()
    if (this.registry.get("combo") > 1 && this.elapsed > (this.registry.get("comboUntil") ?? 0)) this.registry.set("combo", 1)
  }

  private movePlayer(dt: number) {
    const speed = 420
    const { arrows: k, wasd: w } = this
    const x = (k.right.isDown || w.D.isDown ? 1 : 0) - (k.left.isDown || w.A.isDown ? 1 : 0)
    const y = (k.down.isDown || w.S.isDown ? 1 : 0) - (k.up.isDown || w.W.isDown ? 1 : 0)
    if (x || y) {
      this.target = null
      this.player.setVelocity(x * speed, y * speed)
    } else if (this.target) {
      // Ease toward the finger: fast when far, gentle when close (no jitter).
      const dx = this.target.x - this.player.x
      const dy = Math.max(this.scale.height * 0.35, this.target.y) - this.player.y
      this.player.setVelocity(Phaser.Math.Clamp(dx * 12, -900, 900), Phaser.Math.Clamp(dy * 12, -900, 900))
    } else {
      this.player.setVelocity(0, 0)
    }
    // Lean into the turn: a tiny tilt sells the motion.
    this.player.setRotation(Phaser.Math.Linear(this.player.rotation, ((this.player.body?.velocity.x ?? 0) / 900) * 0.35, Math.min(1, dt * 12)))
  }

  private autoFire() {
    if (this.time.now < this.nextShot) return
    this.nextShot = this.time.now + FIRE_MS
    const b = this.bullets.get(this.player.x, this.player.y - 34, "bolt") as Phaser.Physics.Arcade.Image | null
    if (!b) return
    b.setActive(true).setVisible(true).setScale(1).setTint(PALETTE.shot).setDepth(9).setBlendMode(Phaser.BlendModes.ADD)
    b.enableBody(true, this.player.x, this.player.y - 34, true, true)
    b.setVelocity(0, -760)
    sfx(this, "shoot", 0.12)
  }

  // The difficulty curve: easy for the first 20 seconds, then more enemies and nastier kinds.
  private spawnWaves() {
    if (this.elapsed < this.nextSpawn) return
    const t = this.elapsed
    this.nextSpawn = t + Math.max(0.32, 1.1 - t * 0.012) * Phaser.Math.FloatBetween(0.7, 1.3)
    const roll = Math.random()
    const kind: Kind = t < 12 ? (roll < 0.8 ? "drone" : "rock") : t < 30 ? (roll < 0.45 ? "drone" : roll < 0.75 ? "weaver" : roll < 0.9 ? "rock" : "diver") : roll < 0.3 ? "drone" : roll < 0.55 ? "weaver" : roll < 0.75 ? "diver" : "rock"
    this.spawnEnemy(kind, Phaser.Math.Between(40, this.scale.width - 40), -40)
  }

  private spawnEnemy(kind: Kind, x: number, y: number) {
    const k = KINDS[kind]
    const e = this.enemies.create(x, y, k.sprite) as Phaser.Physics.Arcade.Sprite
    e.setScale(k.scale).setTint(k.tint).setData({ kind, hp: k.hp, tint: k.tint, born: this.elapsed, baseX: x, phase: "in" })
    e.setCircle(e.width * 0.36, e.width * 0.14, e.height * 0.14)
    const speedUp = 1 + Math.min(0.8, this.elapsed / 90)
    if (kind === "drone") e.setVelocity(0, Phaser.Math.Between(120, 170) * speedUp)
    if (kind === "weaver") e.setVelocity(0, 110 * speedUp)
    if (kind === "diver") e.setVelocity(0, 160)
    if (kind === "rock" || kind === "pebble") e.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(80, 120) * speedUp).setAngularVelocity(Phaser.Math.Between(-90, 90))
    return e
  }

  // How each kind moves: chase, weave, telegraph-then-dive, tumble.
  private moveEnemy(e: Phaser.Physics.Arcade.Sprite, _dt: number) {
    const kind = e.getData("kind") as Kind
    if (kind === "weaver") e.x = e.getData("baseX") + Math.sin((this.elapsed - e.getData("born")) * 3) * 80
    if (kind === "diver" && e.getData("phase") === "in" && e.y > 140) {
      // Telegraph: it stops and flashes before it dives, so getting hit feels fair.
      e.setData("phase", "warn").setVelocity(0, 0)
      this.tweens.add({ targets: e, scale: e.scale * 1.25, duration: 120, yoyo: true, repeat: 2, onRepeat: () => e.active && flash(e, 50) })
      this.time.delayedCall(700, () => {
        if (!e.active) return
        e.setData("phase", "dive")
        this.physics.moveToObject(e, this.player, 420)
        e.setRotation(Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y) - Math.PI / 2)
      })
    }
  }

  private hitEnemy(bullet: Phaser.Physics.Arcade.Image, e: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !e.active) return
    bullet.disableBody(true, true)
    const hp = e.getData("hp") - 1
    e.setData("hp", hp)
    if (hp > 0) {
      flash(e)
      e.y -= 4 // knockback: a hit pushes back a little
      feel(this, "hit", bullet.x, bullet.y, PALETTE.shot)
      return
    }
    const kind = e.getData("kind") as Kind
    // A combo: kills close together multiply the points (up to x5).
    const combo = Math.min(5, this.registry.get("combo") + (this.elapsed < (this.registry.get("comboUntil") ?? 0) ? 1 : 0))
    this.registry.set({ combo, comboUntil: this.elapsed + 1.2 })
    const points = KINDS[kind].points * combo
    this.registry.inc("score", points)
    feel(this, "kill", e.x, e.y, e.getData("tint"))
    popText(this, e.x, e.y, combo > 1 ? `+${points} x${combo}` : `+${points}`, PALETTE.shot, FONT_DISPLAY)
    if (kind === "rock") for (const dx of [-18, 18]) this.spawnEnemy("pebble", e.x + dx, e.y).setVelocity(dx * 6, 140)
    if (Math.random() < 0.07 && this.registry.get("lives") < MAX_LIVES) this.dropPickup(e.x, e.y)
    e.destroy()
  }

  private dropPickup(x: number, y: number) {
    const k = this.pickups.create(x, y, "icon_plusLarge") as Phaser.Physics.Arcade.Image
    k.setScale(0.32).setTint(PALETTE.heal).setVelocity(0, 110).setDepth(8)
    this.tweens.add({ targets: k, angle: 360, duration: 1600, repeat: -1 })
  }

  private collect(k: Phaser.Physics.Arcade.Image) {
    if (!k.active) return
    k.destroy()
    this.registry.set("lives", Math.min(MAX_LIVES, this.registry.get("lives") + 1))
    feel(this, "pickup", this.player.x, this.player.y, PALETTE.heal)
    popText(this, this.player.x, this.player.y - 40, "1UP", PALETTE.heal, FONT_DISPLAY)
    squash(this.player, 0.3)
  }

  private hurtPlayer(e: Phaser.Physics.Arcade.Sprite) {
    if (this.over || this.time.now < this.invulnerableUntil) return
    e.destroy()
    const lives = this.registry.get("lives") - 1
    this.registry.set({ lives, combo: 1 })
    if (lives <= 0) return this.die()
    feel(this, "hurt", this.player.x, this.player.y, PALETTE.hero)
    flash(this.player, 120)
    // A second of safety after a hit, shown by blinking.
    this.invulnerableUntil = this.time.now + 1200
    this.tweens.add({ targets: this.player, alpha: 0.25, duration: 100, yoyo: true, repeat: 5, onComplete: () => this.player.setAlpha(1) })
  }

  private die() {
    this.over = true
    feel(this, "death", this.player.x, this.player.y, PALETTE.hero)
    this.player.setVisible(false).disableBody(true, false)
    this.cameras.main.flash(250, 255, 61, 187)
    const score = this.registry.get("score") as number
    const localBest = Math.max(score, Number(localStorage.getItem("best") ?? 0))
    localStorage.setItem("best", String(localBest))
    // Save the run on the server (the title screen shows the best); the game over screen doesn't wait for it.
    const saved = fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score }) })
      .then((r) => r.json())
      .then((d) => Number(d.best) || localBest)
      .catch(() => localBest)
    // Restart under a second: a short beat to see what happened, then straight to the score.
    this.time.delayedCall(500, () => {
      this.scene.stop("Hud")
      this.scene.start("GameOver", { score, best: localBest, saved })
    })
  }

  private cleanUp() {
    const h = this.scale.height
    for (const b of this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]) if (b.active && b.y < -20) b.disableBody(true, true)
    for (const e of this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]) if (e.y > h + 60 || e.x < -80 || e.x > this.scale.width + 80) e.destroy()
    for (const k of this.pickups.getChildren() as Phaser.Physics.Arcade.Image[]) if (k.y > h + 40) k.destroy()
  }

  // ?debug: a bot can read the state and play (library/games/playtest-with-a-bot.md).
  private exposeDebug() {
    if (!new URLSearchParams(location.search).has("debug")) return
    ;(window as unknown as { __game: unknown }).__game = {
      start: () => {},
      snap: () => ({
        state: this.over ? "over" : "playing",
        time: Math.round(this.elapsed * 10) / 10,
        score: this.registry.get("score"),
        hp: this.registry.get("lives"),
        player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
        enemies: (this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]).map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), kind: e.getData("kind") })),
      }),
    }
  }
}

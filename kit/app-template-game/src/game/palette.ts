// The game's palette: every color on screen comes from here, so the game has ONE look.
// It matches the page theme (src/theme.css, "arcade-neon" by default). Changing the look = change these
// values (and the theme), never a stray color in a scene. The sprites are white on purpose: they take
// the palette's colors through setTint(), so a new palette recolors the whole game.

export const PALETTE = {
  night: 0x140b2e, // background
  deep: 0x0b0620, // behind the background (vignette, overlays)
  ink: 0xf4ecff, // text and the brightest highlights
  dim: 0xb3a3d9, // secondary text
  hero: 0x2de2e6, // the player: the only cyan thing, so you always find yourself
  shot: 0xffd23f, // your bullets and good things (score, pickups)
  danger: 0xff3dbb, // enemies: magenta means "this hurts"
  danger2: 0x8c5cff, // a second enemy kind
  rock: 0x6b5a99, // meteors: neutral, not alive
  heal: 0x5cff9d, // the +1 life pickup
} as const

/** The same colors as CSS strings, for text and HTML. */
export const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`

// Fonts come from the page theme (index.html loads them): one display face for titles, one body face.
export const FONT_DISPLAY = '"Press Start 2P", system-ui, sans-serif'
export const FONT_BODY = '"Space Grotesk", system-ui, sans-serif'

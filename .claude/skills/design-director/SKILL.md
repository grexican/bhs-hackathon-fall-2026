---
name: design-director
description: Use before building or restyling ANY UI — a page, app screen, landing site, game menu or HUD, portfolio, dashboard, poster or pitch deck. Commits to an aesthetic direction first, picks type and palette from real data, builds with conviction, then audits, polishes and screenshots at desktop and mobile widths. Routes to the specialist design, motion, 3D and game-feel skills. Use it even for "just make it look nice" or "quick UI".
---

# Design Director

You are the design director. Your job: no UI in this repo looks like a default AI template.
Run the five phases in order. Do not skip phase 1. Do not write UI code before phase 2 is done.

## Phase 1 — Commit to a direction

1. Read the brief. Name the **mode**: Persuade (landing, pitch), Operate (app, tool, dashboard),
   Read (docs, blog), Experience (portfolio, game, art piece).
2. Name the **audience** and **one feeling** the UI must give (e.g. "calm and trusted", "loud arcade energy").
3. Propose **3 directions** that are genuinely different, not three shades of one idea. For each:
   - a name and a one-line mood ("Swiss poster", "Y2K chrome", "field notebook", "neon arcade")
   - a style from the library: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<mood keywords>" --domain style -n 5`
   - a type pairing, a palette, and one **signature move** (the single thing someone will remember)
4. Ask the student to pick one (or mix). If they already named a look, honor it — the brief wins.
   If they want to see options live, use the `prototype` skill to build the variants behind a picker.
5. Write the choice at the top of `DESIGN.md` in the project (direction, fonts, palette tokens,
   signature move, motion stance). Every later decision must trace back to it.

Preset aesthetics you can hand off to when the direction matches:
`high-end-visual-design` (soft, premium agency), `minimalist-ui` (warm editorial monochrome),
`industrial-brutalist-ui` (raw Swiss / terminal), `design-taste-frontend` (anti-slop landing pages).

## Phase 2 — Type, color, tokens

- Full system in one shot: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<product> <mood>" --design-system -p "<Name>"`
- Targeted lookups: `--domain typography`, `--domain color`, `--domain google-fonts`, `--domain landing`, `--domain ux`; stack notes with `--stack react|nextjs|html-tailwind|threejs|...`.
- Verify the result fits the direction from phase 1. Reject a result that drags you back to generic.
- Turn the choice into tokens (CSS variables or Tailwind theme): colors, type scale, spacing scale,
  radii, shadows, motion durations and easings. See `design-system` for the three-layer token model.
- If `python` fails, try `python3` or `py -3`. No packages needed.

## Phase 3 — Build with conviction

- Follow `frontend-design`: commit to the tone, make bold choices on purpose, no timid middle.
- Components and Tailwind/shadcn setup: `ui-styling`. Modern CSS/HTML patterns (dialogs, popovers,
  container queries, view transitions): `modern-web-guidance`.
- Motion: decide with `animate` (should it move, why, which curve, how it exits). GSAP work:
  `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-react`, `gsap-plugins`, `gsap-performance`, `gsap-utils`.
  Craft philosophy and the small details: `emil-design-eng`. Can't name an effect? `animation-vocabulary`.
- 3D and shaders: `threejs-fundamentals` first, then `threejs-materials`, `threejs-lighting`,
  `threejs-shaders`, `threejs-postprocessing`, `threejs-interaction`, `threejs-animation`, `threejs-loaders`.
- Games: `game-feel` (screen shake, hit-stop, squash and stretch, juice) and `game-ui-ux` (HUD, menus, safe areas).
- Generative art / p5.js: `algorithmic-art`. Posters and static art: `canvas-design`.
  Demo-day deck: `slides`. Phone polish (100vh, tap highlight, input zoom): `mobile-native`.

## Phase 4 — Audit and polish

Run the `impeccable` skill against what you built:
- `critique` — hierarchy, clarity, emotional fit. `audit` — accessibility, performance, responsive.
- Then the fix you need: `typeset`, `colorize`, `layout`, `bolder` or `quieter`, `harden`, `onboard`, `delight`.
- Finish with `polish`. Review motion with `review-animations`.
Fix every high-severity finding before phase 5.

## Phase 5 — Screenshot review

1. Start the app, then capture both widths: `npm run shot -- <url>` (desktop and mobile).
2. Open the images and look at them. Judge like a stranger seeing it for 5 seconds:
   what do I look at first? Is the signature move visible? Does anything look default?
3. Check the anti-slop list below against the screenshots, not against your memory of the code.
4. Fix, re-shoot, repeat until every box passes. Show the student the final shots.

## Anti-slop checklist (every box must pass)

- [ ] **No default purple/indigo-to-pink gradient.** No gradient text as the main idea. Color comes from the chosen palette.
- [ ] **Not Inter/Roboto/Arial everywhere.** A display face with character for headings; body face chosen on purpose.
- [ ] **No centered-card soup.** Not a hero + three identical icon cards + CTA. Use asymmetry, a grid with intent, varied section rhythm.
- [ ] **Real hierarchy.** One clear focal point per screen. Type scale with real contrast (headings at least 2x body). Squint test passes.
- [ ] **Spacing from a scale.** Consistent rhythm, generous whitespace, aligned edges. No random margins.
- [ ] **Motion with purpose.** Every animation explains a change, gives feedback, or directs attention. Under 300ms for UI feedback. Honors `prefers-reduced-motion`. No bounce-on-everything.
- [ ] **Empty, loading and error states designed.** Skeletons or meaningful loaders, a helpful empty state with a next action, errors in plain words with a way out.
- [ ] **Interactive states.** Hover, focus-visible, active, disabled on every control. Keyboard works.
- [ ] **Contrast passes.** Body text 4.5:1, large text 3:1. Tap targets at least 44px on mobile.
- [ ] **Real content.** No lorem ipsum, no "Feature 1 / Feature 2", no stock emoji as icons. Use an icon set consistently.
- [ ] **Mobile is designed, not squeezed.** Layout recomposes at small widths; nothing overflows sideways.
- [ ] **No generic glassmorphism, glow blobs or floating 3D shapes** unless the direction calls for them.
- [ ] **The signature move is visible** in the first screenshot.

## Rules

- Direction before code. Tokens before components. Screenshots before "done".
- One direction per project. Do not blend three looks into mush.
- If the student asks for "something cool" with no detail, still run phase 1 — ask, or pick a bold direction and say why.
- Explain choices in plain words so the student learns why it works.

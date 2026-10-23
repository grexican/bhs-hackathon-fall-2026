---
name: beautiful-components
description: Use when building or polishing any React screen in this kit (the default starter is React + Tailwind + shadcn/ui). Finds and adds ready-made, beautiful components from the galleries already wired into every app (shadcn/ui, React Bits, Magic UI, Aceternity UI), plus Uiverse for plain HTML, good fonts, one-hex palettes, shader backgrounds and illustrations. Use for "make it look amazing", "add an animated hero", "fancy button", "cool background", "landing page", or before hand-writing any UI piece that a gallery already has.
---

# Beautiful components

Don't hand-write what a gallery already does better. Every React app made by `npm run new-app` has
`components.json` set up with four galleries. Each command below copies the component's **source**
into `src/components/` so you can change anything.

`design-director` decides the look first. This skill supplies the pieces.

## The galleries

| Gallery | Best for | Add one |
|---|---|---|
| **shadcn/ui** (ui.shadcn.com) | The basics, done right and accessible: dialog, sheet, tabs, form, select, toast (sonner), drawer, calendar | `npx shadcn@latest add dialog sheet tabs` |
| **React Bits** (reactbits.dev) | Animated text (SplitText, BlurText, ShinyText), backgrounds (Aurora, Particles, Silk), cursors, cards (TiltedCard, Folder) | `npx shadcn@latest add @react-bits/BlurText-TS-TW` |
| **Magic UI** (magicui.design) | Marketing motion: marquee, number ticker, globe, animated beam, shimmer button, bento grid, confetti | `npx shadcn@latest add @magicui/marquee` |
| **Aceternity UI** (ui.aceternity.com) | Hero moments: spotlight, 3D card, background beams, lamp, bento grid, floating dock, card hover effect | `npx shadcn@latest add @aceternity/3d-card` |

Find the exact name first: browse the site, or search from the app folder:

```bash
npx shadcn@latest search @magicui -q "text"
npx shadcn@latest search @aceternity -q "card"
npx shadcn@latest view @react-bits/Aurora-TS-TW
```

React Bits names end with the variant: **always `-TS-TW`** here (TypeScript + Tailwind).
Run every command inside `apps/<codename>/`, never at the kit root. Add `-y` so it never stops to ask.

## How to use them well

1. **Pick 2 or 3 moments, not 20.** One animated headline, one background, one delightful button or
   card. Everything else stays calm shadcn. A page where everything moves feels cheap.
2. **Stack, then unify.** After adding pieces from different galleries, make them one design: the same
   radius, the same accent color (`--primary` in `src/index.css`), the same animation speed and easing.
   Pick one duration (about 0.4-0.6 s) and use it everywhere.
3. **Phone first, always.** Most people open these apps on a phone. Check every component at 375px:
   no hover-only effects (a 3D tilt needs a tap or scroll fallback), tap targets of 44px or more, text
   16px or more in inputs (smaller makes the phone zoom in), and nothing wider than the screen.
4. **Respect reduced motion.** Wrap big motion in `motion-safe:` classes or check
   `window.matchMedia("(prefers-reduced-motion: reduce)")`.
5. **Heavy effects cost battery.** WebGL backgrounds (Aurora, Particles, Silk, globe) are for one hero, not
   every page. Keep one per screen at most and check it on a real phone (`/on-my-phone`).
6. **Screenshot before "done":** `npm run shot -- http://localhost:<port>` (desktop and phone).

If a component needs a package the CLI didn't install, the error names it: `npm install <name>`.

**Gotcha with `cn()`:** it drops a `leading-*` (line height) that comes BEFORE a text size like `text-[clamp(...)]`
or `text-5xl`. Put line height last: `cn("font-bold", size, "leading-tight")`. Symptom: huge gaps between the lines of
a big heading.
If two galleries both have one (bento grid), pick the one that matches the chosen direction.

## Plain HTML apps (`--plain` starter, no React)

- **Uiverse** (uiverse.io): buttons, loaders, toggles, checkboxes, inputs and cards as plain HTML + CSS.
  Copy the HTML into the page and the CSS into `public/style.css`. Rename its classes to fit.
- Motion: `gsap-*` skills (GSAP is free, load it from a CDN) or plain CSS transitions.

## Assets that make it look designed

- **Fonts:** Fontshare (fontshare.com, free for commercial use): Satoshi, General Sans, Cabinet Grotesk,
  Clash Display, Switzer. Add its `<link>` to `index.html`, then set `--font-sans` / `--font-heading`
  in `src/index.css`. Or Google Fonts. `ui-ux-pro-max` has tested pairings.
- **Colors:** one brand hex → a full 50-950 scale at uicolors.app, then set `--primary` (and friends) in
  `src/index.css`. Don't invent ten colors: one accent plus neutrals.
- **Icons:** `lucide-react` is already installed (`import { Heart } from "lucide-react"`).
- **Shader backgrounds:** Paper Shaders, zero dependencies: `npm i @paper-design/shaders-react`
  (shaders.paper.design). Mesh gradients, grain, liquid metal.
- **Illustrations:** unDraw (undraw.co), free SVGs recolored to your accent.

## Video from code

- **HyperFrames** (in the kit: `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`):
  write HTML and CSS, render an MP4. Good for a promo clip or a demo-day intro.
- **Remotion** (videos as React components): add its official skills inside the app folder with
  `npx skills add remotion-dev/skills`. Free for students, individuals and small teams.

## Licenses (fine for these apps)

shadcn/ui, Magic UI, Uiverse, Lucide: MIT. React Bits: MIT + Commons Clause (use it in your app; don't sell
the components themselves). Aceternity UI: free components (some paid templates). GSAP: free, including
commercial use. Fontshare: free for commercial use.

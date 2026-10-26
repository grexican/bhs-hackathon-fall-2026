---
description: Design floor for every screen a person sees in apps/. Attached automatically when a page, component or stylesheet changes.
paths:
  - "apps/**/src/**/*.tsx"
  - "apps/**/src/**/*.jsx"
  - "apps/**/src/**/*.css"
  - "apps/**/public/**/*.html"
  - "apps/**/public/**/*.css"
  - "apps/**/index.html"
---

# Design floor (every screen)

The minimum for any UI in `apps/`. `design-director` goes further; nothing ships below this.

1. **A theme, never the default.** Every starter begins on a theme preset (`src/theme.css`, or `public/theme.css`
   in the plain starter). Use its tokens: `var(--primary)` / `bg-primary`, `text-muted-foreground`, `rounded-lg`.
   Never raw hex in components, never `gray-*`, `slate-*`, `zinc-*` or `neutral-*` classes. Change the whole look with
   `npm run theme -- <preset> <codename>` (`npm run theme` lists 6) or by editing theme.css. No `DESIGN.md` in the
   app yet? Run `design-director` first and write one.
2. **A real type scale.** Headings in the display font (`font-heading`) at least 2x body: `text-display` (hero),
   `text-title` (screen titles), `text-lead` (intro line). Body 16px or more. One font pair, from the theme.
3. **Spacing from the scale.** Tailwind spacing steps or `var(--space-1)`…`var(--space-8)`. No one-off pixel margins.
   Align edges. Leave more space between sections than inside them.
4. **One accent per screen.** `--primary` marks the one main action. Other actions are quieter (outline, ghost, link).
5. **Every state designed.** Anything that loads or lists has a loading state (skeleton, or a spinner with words), an
   empty state (one sentence + the button for the next step) and an error state (plain words + "Try again"). Every
   control has hover, `focus-visible`, active and disabled styles.
6. **Phone first.** Design 375px wide first: one column, the main action at thumb height, tap targets 44px or more,
   inputs 16px or more (no zoom on focus), nothing scrolls sideways.
7. **Real content.** No lorem ipsum, no "Feature 1", no emoji as icons (use `lucide-react`, or one icon set).
8. **Banned defaults.** Purple-to-pink gradients, gradient text as the main idea, Inter/Roboto/Arial headings,
   hero + three identical cards, glass blobs and glow orbs with no reason.
9. **Done = seen and scored.** `npm run shot -- <url>` (zero console errors), then `npm run critique -- <url>` from the
   kit root. Done needs **7/10 or more**, or `--accept "<the student's reason>"`. Apply its three fixes first.

Deeper: `design-director` (direction, tokens, polish; it routes to the specialist design skills).

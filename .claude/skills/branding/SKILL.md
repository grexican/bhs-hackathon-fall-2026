---
name: branding
description: Give the student's app a brand in a few quick questions - vibe words, audience, a palette, a font pairing and a logo - and save it as apps/<codename>/brand/ (tokens.css, brand.md, logo files). Use when a student types /branding, asks for a logo, colors or fonts, or says "make it feel like a real brand".
argument-hint: "[codename]"
---

# /branding: a look that's yours

**One question per turn**, short, with a marked recommendation. Say once at the start: "All of this
can change later." Read `docs/idea.md` (and `DESIGN.md` if it exists) first so you don't re-ask.

1. **Vibe:** "Give me 3 words for how it should feel." (Offer 3 examples that fit the idea.)
2. **Who it's for:** confirm from `docs/idea.md` in one line, or ask.
3. **Palette:** offer 3 **named** palettes that fit the words. Find them with
   `py -3 .claude/skills/ui-ux-pro-max/scripts/search.py "<3 words> <audience>" --domain color -n 5`
   (try `python` or `python3` if `py` is missing). Show each as text:
   `Lunch Rush: #1B1F3B ink · #FF6B35 tang · #FFF4E0 cream · #2EC4B6 mint`
4. **Fonts:** 3 Google Fonts pairings (heading + body), each with one line on its feel
   (`--domain google-fonts` or `--domain typography`). No Inter, Roboto or Arial for headings.
5. **Logo:** make 3 options, then let them pick:
   - `npm run ai -- image "<prompt>" apps/<codename>/brand/logo-1.png` (then `-2`, `-3`). Prompt:
     the name, the vibe words, the palette hexes, "simple flat logo mark, plain background, no
     mockup". Images cost money: 3 tries, no loops.
   - No AI key (it saves an `.svg` placeholder)? Write 3 SVG **wordmarks** by hand instead: the name in
     the heading font, palette colors, one small shape. Save as `logo-1.svg` etc.
   - Open the files so they can see them. Keep their pick as `logo.png`/`logo.svg`, delete the rest.

## Save it to `apps/<codename>/brand/`

- `tokens.css`: CSS variables, e.g. `--color-ink`, `--color-accent`, `--color-bg`, `--color-muted`,
  `--font-heading`, `--font-body`, plus the Google Fonts `@import` line at the top.
- `brand.md`: the 3 words, who it's for, palette (names + hex), fonts, which logo and why. 10 lines max.
- The logo file.

Then import `tokens.css` in the app and use the variables (`design-director` takes it from there).
Show a screenshot of the app with the new look (`npm run shot -- <url>`).

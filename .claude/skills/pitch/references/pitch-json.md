# `docs/pitch.json`: the deck, as data

`npm run pitch -- build <codename>` turns this file into `apps/<codename>/pitch/index.html`.
Change the JSON and build again. Never edit the HTML: the next build overwrites it.

## Top level

| Field | What it is |
|---|---|
| `name` | The app's name (the "after" label on `compare`, the page title). |
| `minutes` | The time slot. The build warns when there are too many slides for it. |
| `local` | Where the app runs on the laptop, for `shots` (e.g. `http://localhost:4817`). |
| `url` | The live address. Optional: read from `APP_URL` in the app's `.env` after `/connect`. Used by the demo button, the **D** key and the QR code. |
| `theme` | Optional colors and fonts: `bg`, `panel`, `ink`, `muted`, `accent`, `accentInk`, `display`, `body`. Without it: `brand/tokens.css`, then a dark default. |
| `logo` | Optional path inside the app folder. Default: `brand/logo*.png`, then `public/icon.svg`. `false` for none. |
| `shots` | The screenshots (below). |
| `slides` | The slides, in order (below). |

Text fields are plain text. `**word**` turns that word the accent color: use it once per slide, on
the word that matters.

## Shots: goals, not recipes

```json
{ "id": "wrong-answer", "device": "phone", "path": "/",
  "steps": [{ "click": "text=Use sample notes" }, { "click": "text=Make my quiz" }, { "waitFor": "text=Question 1" }, { "click": ".choice >> nth=1" }],
  "expect": "Not quite",
  "goal": "The red pen catching a wrong answer, with the one-line why." }
```

- `goal`: what the picture must **prove**. Read it again when you look at the picture.
- `device`: `phone` (default, 390x844) or `desktop` (1440x900, shown in a browser frame).
- `path`: where to start. `steps`, in order: `{ "click": sel }`, `{ "fill": [sel, text] }`,
  `{ "press": "Enter" }`, `{ "waitFor": sel }`, `{ "wait": ms }`, `{ "scroll": px }`, `{ "goto": "/path" }`.
  Selectors are Playwright's: `text=Make my quiz`, `#notes`, `.choice >> nth=1`.
- `expect`: text that is only on the screen you want. The shot fails without it, so a wrong screen
  never sneaks into the deck.

## Slide kinds

Every slide has `kind` and `say` (the speaker notes: what they say on this slide). `eyebrow` (a small
label above the title) works on most kinds.

| Kind | Fields | Use it for |
|---|---|---|
| `title` | `title`, `line` | The first slide: the name and one line. |
| `big` | `big`, `small` | The hook: one big sentence, a moment everyone has lived. |
| `shot` | `title`, `shots` (1–3 ids), `caption`, `points` (optional list) | Showing a screen. One phone shot + 2–3 points is the strongest. One desktop shot fills the slide. |
| `demo` | `title`, `steps` (what you'll do, 2–4), `backup` (shot ids) | The live demo. Has the "Open the app" button (or press **D**); the backup shots sit in the corner in case it breaks. |
| `quote` | `quote`, `who` | A tester's own words. `who` describes them ("Year 11, eats in the cafeteria daily"), no full names without asking. |
| `changes` | `rounds`: `[{ "saw", "changed" }]`, `title` | What playtests showed and what you changed. Judges love this one: it proves you listen. |
| `numbers` | `items`: `[{ "value", "label" }]` (2–3), `source`, `title` | Real numbers only, with where they came from. |
| `compare` | `before` / `after`: `{ "label", "items" }`, `title` | Today vs. with your app. |
| `ask` | `title`, `ask`, `next` | The last slide: what you want from this room, what's next. Shows the QR code and the link. |

## A full example (2 minutes)

```json
{
  "name": "NoteSprint",
  "minutes": 2,
  "local": "http://localhost:5224",
  "shots": [
    { "id": "home", "path": "/", "expect": "Make my quiz", "goal": "Where it starts: one box for your notes, one button." },
    { "id": "question", "path": "/", "steps": [{ "click": "a[href^='#/quiz/']" }], "expect": "Quit", "goal": "A real question from someone's notes, four choices, one thumb." },
    { "id": "board", "device": "desktop", "path": "/", "expect": "class board", "goal": "The class board: every quiz your class made." }
  ],
  "slides": [
    { "kind": "title", "title": "NoteSprint", "line": "Paste your notes. Get quizzed in **5 seconds**.", "say": "Hi, we're the NoteSprint team." },
    { "kind": "big", "eyebrow": "11:40 pm", "big": "The test is tomorrow. Your notes are **six pages long.**", "small": "Re-reading feels like studying. It isn't.", "say": "Everyone here has done this." },
    { "kind": "shot", "title": "One box. One button.", "shots": ["home"], "points": ["Paste your notes", "Get 5 questions on **your** notes", "Red pen tells you why"], "say": "Paste, tap, get quizzed." },
    { "kind": "demo", "title": "Let's make a quiz from real notes", "steps": ["Paste tonight's history notes", "Make my quiz", "Get one wrong on purpose"], "backup": ["home", "question"], "say": "Watch the red pen on the one I get wrong." },
    { "kind": "changes", "rounds": [{ "saw": "3 of 4 playtesters looked for a **Start** button", "changed": "The button now says **Make my quiz**" }], "say": "We watched four classmates use it. Here's what we changed." },
    { "kind": "ask", "title": "Try it before your next test", "ask": "Scan it, paste tonight's notes, tell us if the questions were fair.", "next": "Next: a photo of handwritten notes.", "say": "Find us after." }
  ]
}
```

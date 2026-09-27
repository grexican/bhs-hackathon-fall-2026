# AI Builder Hackathon

You describe it. You make the calls. An AI agent, loaded with the best design and engineering
skills we could find, builds it with you.

You don't need to know how to code. You need an idea and opinions about it.

## What to install (all free)

1. **Cursor** ([cursor.com](https://cursor.com)) or **Claude Code** ([claude.com/download](https://claude.com/download))
2. **Node.js 22.18+** ([nodejs.org](https://nodejs.org))
3. **Git** ([git-scm.com/downloads](https://git-scm.com/downloads))
4. **Python 3** (optional, [python.org](https://python.org)), which powers the design search

## Get started

Each hackathon has its own branch. Clone yours (your organizer will tell you the name):

```bash
git clone -b fall-2026 <repo-url> my-hackathon
cd my-hackathon
npm run setup      # tools, the screenshot browser, safety checks (one time, ~1 min)
npm run onboard    # your name, your own branch, your first commit (~2 min)
```

Open the folder in Cursor or Claude Code and type:

```
/start a study app that quizzes me on the stuff I got wrong last time
```

It will research your idea, ask you sharp questions (the answers are yours to make), pick the
right tools for *your* app, design it properly, build a first version, and screenshot it to prove
it works.

## Commands you'll use

| Type this | It does |
|---|---|
| `/start <idea>` | Idea → questions → design → first working version |
| `/wrap` | Saves your work with a clear commit message (`/wrap push` also uploads it) |
| `/demo <idea>` | The two-builds experiment: a plain AI vs. this setup, side by side |
| `/caveman` | Short answers, to save credits |

Everything else (design direction, animation, 3D, games, testing, security) kicks in by
itself when you need it. See [`.claude/skills/CATALOG.md`](.claude/skills/CATALOG.md) for the full list.

## How your app is built

- **Works on day one, with no accounts.** Anything your app talks to (WhatsApp, payments, email)
  starts as a **simulator** inside your app, labelled "Simulated", so you can test everything now
  and switch to the real service later with one setting.
- **AI by job, not by brand.** Your app asks for a *kind* of model (`fast`, `smart`, `vision`…).
  Try it: `npm run ai -- models`, `npm run ai -- ask fast "hi"`, `npm run ai -- decide "i was charged twice"`.
- **Deploy** to Railway (apps with a server) or GitHub Pages (static sites).

## Rules of the road

- Work on **your branch**. Never on `main`.
- **See it work, then save it.** Run it, look at it, then `/wrap`.
- Secrets (API keys) go in `.env` only. The commit check blocks them anywhere else.
- Stuck? Paste the exact error. Screenshots help.

## For organizers

- `docs/organizers/events.md`: one branch per event, and how to start the next one.
- `docs/organizers/fair-demo.md`: running `/demo` at a table.
- `npm run skills:outdated` / `npm run skills:sync`: keep the vendored skills current.

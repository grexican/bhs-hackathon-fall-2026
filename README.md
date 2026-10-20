# AI Builder Hackathon

**BHS Hackathon · Sat Oct 24 (10:00–20:00) – Sun Oct 25 (11:00–16:00), 2026 · Barcelona High School**

> AI agent asked to set a student up: clone this repo and follow [`SETUP.md`](SETUP.md).

## Start here (3 steps)

1. **Install [Cursor](https://cursor.com/download)** and sign in. Buy a plan at [cursor.com/pricing](https://cursor.com/pricing): **Plus** ($8/mo) at least, **Premium** ($30/mo) if you can (cancel after).
2. **Open an empty folder** in Cursor (File → Open Folder), then open the **Agent** chat.
3. **Paste this** and press Enter:

```
Set me up for the BHS hackathon: https://github.com/grexican/bhs-hackathon-fall-2026
```

The agent installs what's missing, sets up your branch, and asks for the OpenRouter key we hand you.
Then type your idea:

```
/start a study app that quizzes me on the stuff I got wrong last time
```

### Setting up by hand (or if the paste didn't work)

1. Install three things: **[Node.js LTS](https://nodejs.org)** (the green button), **[git](https://git-scm.com/downloads)**
   (all default options are fine) and **[Cursor](https://cursor.com/download)**. Then open a new terminal.
2. In Cursor's terminal:

   ```
   git clone https://github.com/grexican/bhs-hackathon-fall-2026 hackathon
   cd hackathon
   npm run setup
   npm run doctor
   ```

3. `npm run doctor` checks everything and prints **one fix for each ✗**. Fix, run it again, until it's all ✓.

No Docker, no database to install: your app's database is a file, built into Node.
**Windows, "running scripts is disabled on this system"?** Run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force` in PowerShell once, or type `npm.cmd` instead of `npm`.

## Commands

| Type | It does |
|---|---|
| `/start <idea>` | Idea (no idea yet? it helps) → questions → design → first working version |
| `/connect` | Your app's own web address, AI key and email, from the BHS Incubator |
| `/ship` | Puts your app online |
| `/on-my-phone` | Opens it on your phone and makes it installable, like a real app |
| `/test-with-a-friend` | Watch someone use it, then pick the one fix |
| `/share-it` | Nice link previews, a QR code, and a count of who came back |
| `/whats-next` | Picks the next thing to build, from what testers did |
| `/pitch` | Gets you ready for Demo Day |
| `/wrap` | Saves your work (`/wrap push` also uploads it) |
| `/caveman` | Short answers, saves credits |

## Rules

- Work on **your branch**, never `main`.
- **See it work, then `/wrap`.**
- Keys go in `.env` only.
- Stuck? Paste the exact error or a screenshot.

<sub>Claude Code works too. Organizers: `docs/organizers/`.</sub>

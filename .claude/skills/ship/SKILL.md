---
name: ship
description: Put the student's app online through their BHS Incubator hosting slot. Checks the deploy rules (PORT, DATABASE_PATH, /health, no Docker), runs npm run deploy -- <codename>, then verifies the live address in a browser. Use when a student types /ship, says "deploy it", "put it online", "publish", or a deploy failed.
argument-hint: "[codename]"
---

# /ship: put it online

Needs `/connect` first (`apps/<codename>/.env` has `RAILWAY_TOKEN`). If not, run `/connect`.
One line to the student per step. Fix the app, not the platform.

## 1. Check the deploy rules

Read the code and fix what's missing (one line each on what you changed):

- **Railway builds from source.** No Dockerfile. `package.json` needs a `start` script that runs the
  production server (and a `build` script if the stack needs one).
- **Listen on `process.env.PORT`**, host `0.0.0.0`. Never a fixed port.
- **Database:** SQLite at `process.env.DATABASE_PATH`, default `./data/app.db` locally (create the
  folder). On Railway it's `/data/app.db`, a disk the hub made that survives deploys. **Never write
  the database anywhere else in production**: it vanishes on the next deploy.
- **A `/health` route** that answers `ok` with status 200.
- **Static sites** ship here too: copy `kit/locker/` into the app as `locker/` and use
  `"start": "node locker/static.mjs dist"` (or `.` for plain HTML). It serves `/health` and can put
  the BHS sign-in gate in front. GitHub Pages is fine if they prefer it.
- **Only for BHS people?** Ask once: "Should only people with a school account be able to open it?"
  Yes → copy `kit/locker/` into the app (if not there yet), call `gate(req, res)` first in the
  server (see the top of `locker/gate.mjs`; static sites already do), and set `LOCKER_GATE=1` in the
  app's `.env` and on Railway (`npm run locker:env -- <codename>` shows how). Visitors then sign in
  with their school Google account; no login code to write.
- **Secrets** come from env vars. The hub already set them on the server; `.env` is never uploaded.

Run it once the production way (`npm run build`, then `npm start` with a `PORT`) and open it.

## 2. Deploy

From the kit root: `npm run deploy -- <codename>`. It uploads the folder; Railway builds it in 1–3
minutes. A failure? Read `npm run locker:logs -- <codename> --build`, explain the cause in one
sentence, fix, deploy again. Two failed fixes: tell them to raise a hand.

## 3. Prove it's live

After the build, use **`verify-in-browser`** on the live address (`APP_URL` in the app's `.env`):
`/health` says ok, phone and desktop screenshots, zero console errors. Only then say "It's live" and
give them the link to share. Errors while running: `npm run locker:logs -- <codename>`.
Then suggest `/wrap`.

---
name: ship
description: Put the student's app online through their BHS Incubator hosting slot. Checks the deploy rules (PORT, DATABASE_PATH, /health, no Docker), runs npm run deploy -- <codename>, then verifies the live address in a browser. Use when a student types /ship, says "deploy it", "put it online", "publish", or a deploy failed.
argument-hint: "[codename]"
---

# /ship: put it online

Needs `/connect` first (`apps/<codename>/.env` has `RAILWAY_TOKEN`). If not, run `/connect`.
One line to the student per step. Fix the app, not the platform.
If the `bhs-locker` tools are available, use them (they keep keys out of the chat); otherwise use the npm commands.

**Working as a team:** both of you can deploy the same project. Agree who ships. Commit and `git pull`
first so you don't overwrite each other's changes.

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
  the BHS sign-in gate in front (of everything, or only of some folders). GitHub Pages is fine if they prefer it.
- **Sign-in?** Ask once: "Should people sign in to use all of it, some of it (like 'My list' or an
  admin page), or none of it?" Copy `kit/locker/` into the app (if not there yet), call
  `gate(req, res)` first in the server (see the top of `locker/gate.mjs`; static sites already do),
  and pick a mode with `npm run locker:set -- <codename> LOCKER_GATE=...` (sets it on the server and
  in the app's `.env`; it applies on the next deploy):
  - `LOCKER_GATE=1`: **every page** needs sign-in.
  - `LOCKER_GATE=lazy`: the app is **public**; `gate()` returns the user if they're signed in (else
    `undefined`), and only the pages you choose need sign-in:
    ```js
    const user = await gate(req, res); if (user === null) return;
    if (url.pathname.startsWith("/my")) { const u = requireUser(req, res); if (!u) return; /* u.sub ... */ }
    ```
    Express: `const signedIn = (req, res, next) => { const u = requireUser(req, res); if (u !== null) { req.user = u; next(); } };`
    then `app.get("/my", signedIn, ...)`. A "Sign in" button links to `signInUrl("/my")`, "Sign out" to
    `/_locker/logout`. A fetch() or form POST that needs sign-in gets 401 `{ error: "sign_in_required", signIn }`:
    send the page to `signIn`. Static sites: `LOCKER_GATE_PATHS=/admin,/my` lists the folders that
    need sign-in, and `fetch("/_locker/me")` says who is signed in.
  - not set (or `0`): off. `gate()`, `currentUser()` and `requireUser()` return `undefined` and let everyone in.

  No login code to write. Who may sign in is the app's audience on the hub: "school" (school accounts
  only) or "everyone" (parents and guests too), so don't assume the user is a student: `user.domain`
  tells you. On the laptop the app acts signed in as `LOCKER_GATE_USER` (a test user `locker:set` adds
  to `.env`; change the name to try someone else), so local testing never needs the hub. With `lazy`,
  `/_locker/logout` shows the signed-out app there too.
- **Secrets** come from env vars. The hub already set them on the server; `.env` is never uploaded.

Run it once the production way (`npm run build`, then `npm start` with a `PORT`) and open it.

## 2. Deploy

From the kit root: `npm run deploy -- <codename>`. It uploads the folder; Railway builds it in 1–3
minutes. Until the build is done, the address says "Application not found" (or still shows the old
version): that's normal, not a failure. Wait for `<APP_URL>/health` to answer `ok` (check every ~10 s,
up to 5 min) before you open it or tell the student anything. A failure? Read `npm run locker:logs -- <codename> --build`, explain the cause in one
sentence, fix, deploy again. Two failed fixes: tell them to raise a hand.

**Which address? Ask the hub, don't assume.** A new app's friendly address (`<codename>.apps.bhslabs.org`)
needs a security certificate, and on a first deploy that can take a few minutes, sometimes longer. Until it
exists, the friendly address shows a certificate error. That is not your app's fault and waiting on it does
nothing. The hub hands out the address that works: `npm run locker:status -- <codename>` prints it as "Live
address" (the `*.up.railway.app` one while the certificate is coming, the friendly one once it's ready). Give
the student THAT address, and test with it. Sign in with BHS works on both. The hub checks every 10 minutes and
switches on its own; `--check` asks it right now. Never tell a student their app is broken because the friendly
address fails while the "Live address" works.

**Not sure what state it's in?** Ask the hub first: `npm run locker:status -- <codename> --check` (or the
`locker_status` tool with the codename and `check: true`). It answers "Live and answering in N ms",
"Building…", "The last deploy failed to build" with the error lines, "isn't answering", or "Never
deployed yet", plus hints like "Last 2 deploys failed". Start from that, not from guesses.

## 3. Prove it's live

Only after `/health` says ok, use **`verify-in-browser`** on the live address (`APP_URL` in the app's `.env`):
`/health` says ok, phone and desktop screenshots, zero console errors. Only then say "It's live" and
give them the link to share.

**What's new (one optional question).** Then ask exactly this, once: "Anything new people should know? (one
line, or skip)". If they answer, send their words as they wrote them (trim to one line, 140 characters max):
`locker_whats_new` tool, or `npm run locker:whatsnew -- <codename> "<their line>"`. It shows on the app's hub
page ("What's new") and in Apps. Skip means skip: never write it for them, never use a commit message. (When they
say the line before you deploy, `npm run deploy -- <codename> --note "<their line>"` sends it in one go.)

**Reading what happened.** Every deploy turns on request logging (`locker/otel.mjs`, added for you):
one line per page load and per call the app makes (AI, APIs), red-flagged when it fails, plus the
full error when it crashes. `npm run locker:logs -- <codename> --errors` shows only what broke;
`--find "/api/order"` narrows to one page or message. Read them yourself before asking the student
what they saw; quote the one line that explains it. (`LOCKER_OTEL=0` in the app's `.env` turns it off.)
Then suggest `/wrap`. First deploy? Offer `/on-my-phone` (install it on your phone) and `/share-it` (link preview, QR code, Locker listing).

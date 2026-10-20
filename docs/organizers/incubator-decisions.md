# Incubator decisions (organizers)

The questions you asked, each with the decision and why. Short on purpose.

**a. Is the kit repo where students work, or a separate repo per app?**
The kit is the workspace ("agency mode"). Cursor opens the kit; each app is its own git repo in
`apps/<codename>/` (the kit gitignores `apps/`).
Why: kit updates arrive with `git pull`, and the app's history stays the student's and can leave with them.

**b. Apps, web apps, websites, combos?**
All are web apps on Railway. Servers run through `start`; static sites through `kit/locker/static.mjs`.
Native mobile is out of scope for now: build a web app or PWA instead.
Why: one deploy path means one thing to teach and to fix.

**c. Exporting a tool and skill catalog?**
A curated `docs/skill-shelf.md` the student installs from on demand. We do not vendor everything.
Why: a small kit stays current, and agents read less.

**d. Which skills are seeded?**
`/start` (Idea Lab aware), `/connect`, `/ship`, `/branding`, `/bring-my-app`, `/think-it-through`,
`/council`, `/research`, `/wrap`, `/demo`, plus the design and testing skills (frontend design,
UI/UX, animation, accessibility, Playwright, verify-in-browser).
Why: these cover idea, build, ship and show. The rest is on the shelf.

**e. Email?**
The hub relays it (`/api/email/send`) over Brevo's free tier: 300 a day, one verified sender. We use
Brevo's HTTP API because Railway blocks SMTP. It is simulated until the organizer finishes Brevo's
phone verification. Apps never hold email keys.
Why: one sender to protect, nothing for students to leak.

**f. Shared providers?**
The hub is the only place that holds provider accounts: the Railway workspace token, the OpenRouter
management key, and email. Students get per-project credentials only: a project deploy token, a
capped AI key, and an app secret.
Why: a leaked student key can only hurt one project, with a spending cap.

**g. Docker?**
Not needed. Railway builds from source. SQLite is Node's built-in `node:sqlite` (Node 22.18+, nothing
to install) on a persistent `/data` volume the hub attaches to every project. Verified: data survives
redeploys. If Docker is ever needed, Podman Desktop or OrbStack (Mac) are lighter than Docker Desktop.
Why: Docker Desktop is heavy and a classic first-day blocker.

**h. Locker inside the kit or separate?**
Separate private repo, `grexican/bhs-locker`. The kit holds only the client scripts, the skills and
the `kit/locker` helpers.
Why: the hub is long-lived infrastructure with organizer secrets; the kit is public-ish and changes per event.

**i. Sign-in default for student apps?**
No accounts in v1. School-only app: the sign-in gate (one setting, `LOCKER_GATE=1`) or "Sign in with
BHS" per page. Public app (families, expats): its own simple sign-in. Students never write OAuth.
Why: auth is the most common way a weekend project dies.

**j. Cursor or Claude Code?**
Both work. `CLAUDE.md` points at `AGENTS.md`, and both read `.claude/skills`.
Why: students pick the tool they like; the instructions stay in one place.

**k. Students arriving with an existing app?**
`/bring-my-app`: it clones their repo into `apps/<codename>/` and gets it ready to ship.
Why: no one should restart a project to join the incubator.

**l. Teams?**
One owner plus teammates per project, up to 6 people. The owner adds teammates by school email on the
hub page `/p/<codename>`. The project counts toward the owner's 3; teammates keep their own 3. Teammates
get the code via GitHub (`/bring-my-app`), then `npm run locker:join -- <codename>`. Naming is per
project: the Railway project is `bhs-<codename>` and the AI key is named after the codename.
Why: shared work without shared accounts, and you can always tell what costs what.

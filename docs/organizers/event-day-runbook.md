# Event-day runbook (hub + hosting)

For organizers. What to check the day before, what to watch during the event, and the fixes for the
problems we expect. The hub is **BHS Locker** at https://locker.bhslabs.org; its organizer page is
`/admin`.

## The day before

1. **Try one real school account.** Sign in to https://locker.bhslabs.org with a student's
   `@bhsschools.org` Google account (not an organizer's Gmail). School Google Workspace admins can
   block apps they haven't approved; if the sign-in shows "access blocked" / "app not approved",
   ask the school's IT to allow the OAuth client of the hub's Google Cloud project `bhs-locker`
   (Admin console → Security → API controls → App access control → trust it). Do this before
   anything else: without it, nobody can `/connect`.
2. **Fill the spare pool.** Railway lets a workspace create **one project every 30 seconds**. The hub
   keeps spare project slots ready so `/connect` takes seconds even when everyone does it at once.
   Set `POOL_TARGET` on the hub's Railway service to about the number of builders (it fills one
   every ~35 s, so 40 spares take ~25 minutes). `/admin` shows "Spare project slots ready: N of M".
   Empty spares cost nothing.
3. **Check the project cap.** The workspace holds at most **100 projects** (spares included);
   `/admin` shows how many are in use. If builders × projects-per-builder + spares could pass that,
   lower `MAX_PROJECTS_PER_STUDENT` (default 3) or ask Railway to raise the cap.
4. **Decide on approval.** `/admin` → "Require approval" makes project creation organizer-approved
   (approved builders get an email). Leave it off if every signed-in student may build.
5. **Mentors and guests** without a school account: invite them on `/admin` → People outside the
   school.
6. **AI budget:** each project's OpenRouter key has a monthly cap (`AI_MONTHLY_LIMIT_USD`, $5). Raise
   a single project on `/admin` (the AI cap field) or on its project page.
7. **Smoke test:** in a kit clone, `npm run doctor`, then `npm run new-app -- zz-smoke`, `/connect`,
   `npm run locker:project -- zz-smoke`, `npm run deploy -- zz-smoke`, open
   `https://zz-smoke.apps.bhslabs.org`, `npm run locker:logs -- zz-smoke`. Delete it afterwards on
   `/admin` (Delete, type the codename).

## During the event

- **Students are stuck at `/connect`:** their laptop shows a code; the page
  `locker.bhslabs.org/connect` takes it (also on a phone). Inside Instagram/TikTok browsers Google
  blocks sign-in; the page tells them to open it in a real browser.
- **"You're in line…"** after `locker:project`: the spare pool ran out and projects are being made
  one per 30 s. It finishes by itself; raise `POOL_TARGET` for next time.
- **"The hub couldn't finish setting up this project":** running `npm run locker:project -- <codename>`
  again retries it.
- **"Works on my laptop, broken online":** `npm run locker:logs -- <codename> --errors` shows every
  failed request, failed AI/API call and crash, one line each. Usual causes: fixed port instead of
  `PORT`, files saved outside `/data`, a setting missing online (`npm run locker:set`), no `start`
  script.
- **The app's AI stopped answering:** the project hit its AI budget. Raise it on `/admin`.
- **Builds are slow:** the workspace builds 10 apps at a time; the rest wait their turn.
- **Costs:** `/admin` shows AI and hosting per project, refreshed hourly ("Refresh costs now" for a
  fresh number).

## Data and safety

- Each app keeps its data in SQLite on its own `/data` volume, with daily and weekly backups
  (restore from the project's volume in the Railway dashboard).
- Student apps send email only through the hub (50 a day per app, from hello@bhslabs.org) and get
  tester feedback through the hub's feedback inbox (200 a day per app).
- Deleting a project on `/admin` removes its hosting, AI key and web address. It can't be undone.

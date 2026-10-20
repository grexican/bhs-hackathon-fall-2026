# The BHS Incubator (organizers)

The hub (the "Locker", `https://locker-production-7e62.up.railway.app`) turns a student's local
app into a live one without them making any account but their school Google sign-in. The
kit talks to it through `scripts/locker.mjs`; the API contract lives with the hub (contract v1).

## The flow

1. **Connect** (`/connect` → `npm run locker:connect`): device flow. The browser opens, the student
   signs in with their `*bhsschools.org` Google account, checks the code, clicks Connect. The kit
   saves `LOCKER_TOKEN` in the kit root `.env`.
2. **Project** (`npm run locker:project -- <codename>`): the hub provisions the app (10–30 s) and the
   kit writes its settings into `apps/<codename>/.env`. Max 3 per student.
3. **Deploy** (`/ship` → `npm run deploy -- <codename>`): `railway up --service … --detach` with the
   project token. Railway builds from source. Logs: `npm run locker:logs -- <codename> [--build]`.
4. **Costs**: `/admin` on the hub (organizer allowlist) shows students, projects, Railway and AI
   spend, refreshed hourly. Students see their own with `npm run locker:status`.

## What the hub creates per project

- A Railway project + service, a volume at `/data` (SQLite lives at `/data/app.db`), a public
  `*.up.railway.app` domain.
- An OpenRouter key with a monthly spend cap (the app's `OPENROUTER_API_KEY`).
- `LOCKER_APP_ID` / `LOCKER_APP_SECRET` for email and sign-in. The hub sets all settings except the
  deploy token on the Railway service itself, so nothing is pasted by hand.
- A Railway invite link: optional, lets a student watch logs in Railway's dashboard (free account).

## Sign-in default

No sign-in until the app needs it. Then: **"Sign in with BHS"** (hub OAuth, stable `sub` per app and
person) for apps only BHS people use; the app's **own simple sign-in** for apps aimed at the public
(families, expats). Locally, a `sim` provider ("Sign in as…") over seeded users.

## Email and auth notes

- Email relay: `POST /api/email/send` with `LOCKER_APP_SECRET`, 50/day per app, one recipient per
  call. With no mail provider configured the hub answers `simulated: true` and shows the message on
  the student's hub page, so apps work before mail is set up.
- OAuth redirect URIs must be `http://localhost:*` or the app's own Railway domain.
- `LOCKER_APP_SECRET` and `RAILWAY_TOKEN` are server-side only. The kit never prints them;
  `npm run check` blocks committing any `.env`.

## If the hub is down

Every `locker:*` command says "can't reach the hub" in plain words and exits. Students keep
building locally: all services have simulators.

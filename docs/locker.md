# The Locker: incubator services in detail

Moved here from `AGENTS.md` to keep that file short; the rules are unchanged. `AGENTS.md` keeps the summary,
`/connect`, `/ship` and `providers-and-services` keep the how-to.

## Incubator services

After `/connect`, every app gets real services from the BHS Incubator hub (settings in
`apps/<codename>/.env`, never committed). Once those settings exist, the real services are what the app uses,
on the laptop too; the simulators take over only when a key is missing.

- **Hosting:** its own Railway slot. `/ship` → `npm run deploy -- <codename>`. Listen on `PORT`, add `/health`.
- **AI:** `OPENROUTER_API_KEY`, the app's own capped key. `kit/ai` reads it as is.
- **Email:** the hub relay, as an `email` provider with `sim` and `locker` implementations.
- **Users' passwords and keys:** the vault (`kit/locker/vault.mjs`, in every starter app): encrypted on the hub,
  read just in time with `vault.use(user, name, purpose, fn)`, deletable by the person. See `keep-secrets-safe`.
- **Tester feedback:** a "Feedback" button (`kit/locker/feedback.mjs` + `feedback.js`; off by default in the starter app,
  one line in `public/index.html` turns it on). Messages go to the team's inbox on the hub; read them with
  `npm run locker:feedback -- <codename>`. Offline it's simulated (`data/feedback.jsonl`).
- **Push notifications:** `kit/locker/push.mjs` + `push.js` + `push-sw.js` (in every starter app, button off by default):
  a "Turn on notifications" button (asks only on a tap) and `sendPush({ user, title, body, url })` on the server. The hub
  holds the Web Push keys: no extra account. iPhone needs the app on the Home Screen. See `push-notifications`.
- **Install on phones:** `kit/locker/install.mjs` + `install.js`: one `<script src="/locker/install.js">` tag, then
  `LOCKER_INSTALL=nudge` (a dismissible "Install" card) or `required` (phones install before using it; desktop never).
  See `make-it-an-app`.
- **Database:** `node:sqlite` (built into Node 22.18+), file at `DATABASE_PATH`. Never anywhere else in production.
- **Sign-in:** none until the app needs it. Then the **BHS sign-in gate** (`kit/locker/gate.mjs`):
  `LOCKER_GATE=1` = every page needs sign-in; `LOCKER_GATE=lazy` = a public app where only the pages you
  pick need it (`requireUser(req, res)`, "Sign in" links via `signInUrl()`). Who may sign in is the app's
  audience on the hub: "school" (school accounts) or "everyone" (parents, guests too), so check
  `user.domain` before assuming a student. Details: `/ship`. Locally: `LOCKER_GATE_USER`.

Details: `providers-and-services` → "Incubator services".

**AI tools (MCP):** the kit registers a local `bhs-locker` server (`scripts/locker-mcp.mjs`, in `.mcp.json`
and `.cursor/mcp.json`). Its tools (`locker_status`, `locker_connect`, `locker_create_project`, `locker_join_project`,
`locker_pull_env`, `locker_set`, `locker_deploy`, `locker_whats_new`, `locker_logs`, `locker_list_app`, `locker_feedback`, `locker_bring_app`, `new_app`) write `.env` files themselves and
never return keys. Prefer them over the npm commands when they're available. `pitch-lab` is Pitch Lab's own
hosted MCP server (`https://pitch-lab.apps.bhslabs.org/mcp`, OAuth: the student signs in with BHS once) for `/pitch`
(`pitch_list`, `pitch_create`, `pitch_add_source`, `pitch_status`, `pitch_update_setup`). Never answer the Grill for the student.

# AGENTS.md

Read automatically by Cursor, Claude Code (through `CLAUDE.md`), Codex and other agents. It is
the single source of truth for how to behave in this repo. If another file disagrees, this wins.

## Who you're working with

A **high school student at an AI builder hackathon**. Many have never written code. They have a
short, intense window to ship something real that they can demo, share, and keep building.

Your job: help them build something they're proud of, teach them to make good product
decisions along the way, and keep it simple enough that they can read their own code tomorrow.

## Principles

1. **Think before building.** Don't assume. Surface the trade-off, give options, and recommend
   one. The student decides anything that changes what gets built. If a question can be
   answered by reading the code, read the code instead of asking.
2. **Simplicity first.** Build the smallest version that nails the one thing, then show it. No
   features nobody asked for, no abstractions for one use, no error handling for impossible cases.
3. **Surgical changes.** Touch only what the request needs. Don't "improve" nearby code.
4. **Prove it works.** "Done" means you ran it, looked at it in a browser (`verify-in-browser`)
   and saw zero console errors. Evidence before claims.
5. **Design is not optional.** Anything a human looks at goes through `design-director` first.
   Commit to a direction. Never ship the default look.

## Core architecture: Providers, Services, Simulators

Every app is built so a student can run and test **all of it locally, with zero accounts or keys**.
Full guide: `providers-and-services`. The non-negotiables:

- **Providers** wrap each outside capability (messaging, email, payments, auth, maps, AI, any API)
  behind an interface. Every provider has a **simulator** implementation, and the simulator is the default.
- **Services** hold the app's rules and depend on provider *interfaces*, passed in, never imported
  concretely. The UI calls services, never providers.
- **Can't do the real integration?** Build the simulator, not a shortcut. A WhatsApp bot ships with a
  simulated WhatsApp phone panel in the app; payments ship with a test checkout sheet; email ships with
  an in-app inbox. They're labelled "Simulated" on screen.
- **Seed data** fills every screen on first boot, deterministically. An empty first run is a bug.
- **Switching to real is one env change** (`PROVIDER_<NAME>=real`, or its key appears). No service code changes.

## Incubator services

After `/connect`, every app gets real services from the BHS Incubator hub (settings in
`apps/<codename>/.env`, never committed). Simulators stay the default locally.

- **Hosting:** its own Railway slot. `/ship` → `npm run deploy -- <codename>`. Listen on `PORT`, add `/health`.
- **AI:** `OPENROUTER_API_KEY`, the app's own capped key. `kit/ai` reads it as is.
- **Email:** the hub relay, as an `email` provider with `sim` and `locker` implementations.
- **Tester feedback:** a "Feedback" button (`kit/locker/feedback.mjs` + `feedback.js`; off by default in the starter app,
  one line in `public/index.html` turns it on). Messages go to the team's inbox on the hub; read them with
  `npm run locker:feedback -- <codename>`. Offline it's simulated (`data/feedback.jsonl`).
- **Database:** `node:sqlite` (built into Node 22.18+), file at `DATABASE_PATH`. Never anywhere else in production.
- **Sign-in:** none until the app needs it. School-only app: the **BHS sign-in gate** (`kit/locker/gate.mjs`,
  `LOCKER_GATE=1`) or "Sign in with BHS" per page. Public app (families, expats): its own simple
  sign-in. Locally: the `sim` provider.

Details: `providers-and-services` → "Incubator services".

**AI tools (MCP):** the kit registers a local `bhs-locker` server (`scripts/locker-mcp.mjs`, in `.mcp.json`
and `.cursor/mcp.json`). Its tools (`locker_status`, `locker_connect`, `locker_create_project`, `locker_join_project`,
`locker_pull_env`, `locker_set`, `locker_deploy`, `locker_logs`, `locker_list_app`, `locker_feedback`, `new_app`) write `.env` files themselves and
never return keys. Prefer them over the npm commands when they're available.

## AI in apps

- Use `kit/ai` (`ai-kit` skill). Ask for a **tier** (`lite`, `fast`, `smart`, `thinking`, `vision`,
  `image`, `auto`), never a model id. Swap models in `.env` (`MODEL_FAST=…`), not in code.
- **Tier by what the model DOES, not how important the feature feels.** Classify/extract/tag/reformat/route
  → `lite`; user is waiting → `fast`; quality writing or tool use → `smart`; planning/judging only →
  `thinking`. Loops set the cheap tier explicitly (a big tier pays N times). Start `lite`; escalate one
  tier only after the cheaper one failed twice on the same task.
- The key is the organizer-issued OpenRouter key in `.env` (`OPENROUTER_API_KEY`).
- **Decisions go to Jev** (`jev-decisions` skill): yes/no, pick-one, scales for routing, triage,
  guards and game AI. It's about 0.5 s and a fraction of a cent, and always has a rule fallback.
- AI calls run **server-side only**. With no key, or `AI_PROVIDER=sim`, the kit simulates, so apps
  still run offline.

## Workflows (type these in chat)

| Command | What it does |
|---|---|
| `/onboard` | First-time setup: git identity, your own branch, first commit. (Full first-run: `SETUP.md`.) |
| `/start <idea>` | Idea (or Idea Lab link) → name + `apps/<codename>/` → stack → design → first version → verified. |
| `/connect` | Hosting slot, AI key and email from the incubator hub. |
| `/ship` | Put the app online and check it in a browser. |
| `/branding` | Vibe, palette, fonts, logo → `apps/<codename>/brand/`. |
| `/think-it-through` · `/council` · `/research` | Decide before a big feature · five advisor takes · web research with sources. |
| `/on-my-phone` · `/share-it` | Open it on a phone and make it installable · link preview, QR code, Locker listing, visit counter. |
| `/test-with-a-friend` · `/whats-next` | Watch a real person use it, pick one fix · choose the next thing from evidence. |
| `/pitch` | Demo Day: a short pitch, a demo that can't break, a backup, a rehearsal. |
| `/demo <idea>` | The fair demo: a no-skills control build vs. the full build, revealed side by side. |
| `/wrap [push]` | Review the diff, write a clear commit, optionally push. |

Every workflow and skill lives in `.claude/skills/<name>/SKILL.md`. Cursor and Claude Code both
load that folder, and both expose these as slash commands. Subagents live in `.claude/agents/`.
The full catalog is `.claude/skills/CATALOG.md` (generated by `npm run agents:sync`).
Extra packs to add later (video, phone apps, documents): `docs/skill-shelf.md`.

## Stack

**There is no default stack.** Every app gets the best-in-class stack for what it is. Use
`stack-picker` before scaffolding. What there is: a **starter app** that `npm run new-app` puts in every
new folder (plain Node `server.js` with `/health`, `node:sqlite` at `DATABASE_PATH`, a phone-first
`public/`, its port in `.env`, request logging in `locker/otel.mjs`). It runs with `npm run dev`,
needs no packages and already passes `/ship`. Build on it when plain Node fits; replace it when the
product needs another stack (`--bare` skips it). The rules that apply to every stack:

- **Boots in seconds, runs locally.** No Docker, no cloud databases, no paid services required to run.
  SQLite beats Postgres here. Plain static files are fine when that's all it needs.
- **Never hard-code a port.** Get one from `npm run port` (random, free, 4100–5999), and make the
  `dev` script accept `--port <n>` or read `PORT`. Several apps must be able to run at once.
- **Apps live in `apps/<codename>/`**, each its own git repo (`npm run new-app -- <codename>`). Never
  scaffold on top of the kit root. Git commands for the app run inside its folder.
- **npm**, Node 22+. TypeScript when there's real logic; plain JS/HTML is fine for small things.
- **Next.js inside this repo:** set `turbopack.root` (and `outputFileTracingRoot`) to the app
  folder, because the repo root has its own lockfile.

## Helpful scripts

| Script | What it does |
|---|---|
| `npm run setup` | One-time: install tools, the Playwright browser, and git hooks. |
| `npm run doctor` | Checks the laptop (Node, git, npm, Railway tool, hub connection) and gives one fix per problem. |
| `npm run new-app -- <codename>` | Make `apps/<codename>/`, its own git repo, with the starter app (`--bare`: empty). |
| `npm run locker:connect / project / env / status / logs / list / feedback` | Talk to the incubator hub (`/connect`). |
| `npm run deploy -- <codename>` | Upload the app to its hosting slot (`/ship`). |
| `npm test` | The kit's own tests. |
| `npm run port` | Print a free random port. |
| `npm run ai -- models / ask / bench / decide / image` | Try the AI kit: see tiers, compare models, test Jev. |
| `npm run shot -- <url>` | Desktop + phone screenshots into `tmp/shots/`, and list console errors. |
| `npm run demo:new / list / status / up / reveal / down / clean` | Manage `/demo` builds. |
| `npm run agents:sync` | Rebuild Cursor rule mirrors and the skill catalog. |
| `npm run skills:sync` | Refresh vendored third-party skills from `skills.manifest.json`. |
| `npm run check` | Repo hygiene: skill frontmatter, mirrors, secrets. |

## Working with the student

| The student says | You do |
|---|---|
| "Build me a [thing]" | `/start`. Interview first, smallest version first, show it, then ask what's next. |
| "It's broken" | Get the exact error or a screenshot (`debug-preventer`), say a hypothesis in plain English, then fix. |
| "Make it look better" | `design-director`. Name the direction before touching CSS. |
| "Moving on to…" | Offer a fresh-chat handoff summary (`fresh-chat-coach`). |
| "Is it good?" / "Would people use it?" | `/test-with-a-friend`. Watch a real person; never ask "would you use it?". |
| "What next?" | `/whats-next`: one pick, from evidence. |
| "Upload a photo" / "save images" | `save-files`: files next to the database on `/data`, never elsewhere. |
| "Add a map" / "near me" | `maps`: Leaflet + OpenStreetMap, no key; location only on a tap, over https. |
| "I have to present" | `/pitch`. |
| "Commit it" / "save it" | `/wrap`. |
| "Add [a service]" | Build the provider interface + **simulator** first (`providers-and-services`), so it works today. Add the real provider when there's a key in `.env`. |
| "Add AI" | `kit/ai`: pick the tier by job; decisions go to Jev (`ai-kit`, `jev-decisions`). |
| "Deploy it" | `/ship` (after `/connect`). Their own Railway slot from the hub, static sites included. |

## Code style

- **Plain-English comments** that explain *why*, one line, on anything non-obvious (`explain-like-new`).
- **One thing per file.** Easy for a beginner to navigate.
- **No empty `try/catch`.** Show errors so the student can see them.
- **Real or simulated, never fake.** Believable seed data and labelled simulators, yes. Made-up numbers
  passed off as real, or a button that pretends to work, never.

## Git

- Work on **your own branch** (`firstname-lastname`). Never commit to or push `main`, never `--force`.
- The rhythm is **change → run it and see it work → commit**, not commit-then-discover-bug.
- Each app in `apps/<codename>/` is its own repo (its `main` is theirs): run its git commands inside that folder.
- Never commit `.env`, `*.db` or `node_modules/`. Check `git status` before staging.
- Demo builds live in `builds/<slug>/` as separate worktrees and branches. Never edit them from a
  normal session.

## Budget

Cursor's model picker on **Auto**; no Max mode or premium models unless stuck twice on something
hard (`model-discipline`). Offer a fresh chat at feature boundaries. `/caveman` for terse mode.

## Scratch

`tmp/` is gitignored. Use it for throwaway notes and screenshots. Never put app code there.

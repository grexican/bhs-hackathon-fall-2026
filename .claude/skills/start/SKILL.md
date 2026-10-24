---
name: start
description: Turn a student's idea into a real first version. Starts with "do you know what you want to build?" (Idea Lab if not, or seeds from an Idea Lab link), names the app and makes apps/<codename>/, interviews them (one sharp question at a time), picks the right stack, commits to a design direction, builds the smallest impressive version, and proves it works in a browser. Use when a student types /start, or says "I want to build…", "my idea is…", "help me make…".
disable-model-invocation: true
argument-hint: "[your idea in one sentence]"
---

# /start: from idea to a first version you're proud of

The student makes the decisions. You make them *good* decisions: you show the options, say
what each one costs, and recommend one. Never silently pick for them on things that change
what gets built.

## What the app gets for real (plan with these from the first question)

Every app here gets **real services from the BHS Locker** through `/connect`, in about a minute. Build
the first version on the real ones, so the student does real work from day one:

- **AI:** the app's own OpenRouter key with a monthly budget. Real answers, not a simulator.
- **Email:** real emails sent through the Locker's relay (50 a day, one recipient per email): sign-up
  confirmations, reminders, receipts.
- **Sign in with BHS:** real school Google accounts (and guests, if the app is open to everyone).
- **Hosting:** a real web address, a database that survives redeploys, and a disk for uploaded files.
- **The vault** for passwords and keys from the app's users, and a **Feedback button** for testers.

So when an idea needs AI, email, accounts or a web address, say **"yes, for real"**, not "simulated for
now". Simulators are only for what the Locker can't give (payments, WhatsApp/SMS, a third-party API
with no key yet), and they stay as the fallback when the laptop is offline or in tests.

## 0. Do they know what to build?

If `$ARGUMENTS` already holds an idea or an Idea Lab link, skip to the matching step. Otherwise ask
just this: **"Do you know what you want to build?"**

- **No / not sure** → "Try the Idea Lab: browse ideas at
  https://ideas.bhslabs.org/examples or make your own at
  https://ideas.bhslabs.org/ — then paste the link here."
- **Pasted an Idea Lab link** (`/s/<id>` or `/c/<id>`) → fetch
  `https://ideas.bhslabs.org/api/session/<id>` (JSON: `idea`, `research`,
  the questions and answers, and `spec` with `name, tagline, for, core, twist, features, screens,
  look, ai, weekend`) and the prototype at `/s/<id>/app`. Seed `docs/idea.md` from it. In step 1,
  **confirm** what the spec already answers ("Your spec says it's for ___. Still right?") instead of re-asking.

## 1. Understand the idea (5 to 8 questions, one at a time)

If there's no idea yet, ask for it in one sentence. Then spend 2 minutes on
research (`/research` if it needs sources): what already exists, and what the best examples do well. Share it in 3 lines.

Ask **one question per turn**, each with 2 to 4 concrete options, your marked recommendation,
and one line on **why it matters**. Only ask questions whose answers change the build:

- Who uses it, and in what moment?
- What's the **one thing** it must nail in version 1? (Everything else goes on a "later" list.)
- What should it **feel** like? Offer three named directions from `design-director`.
- What makes it **different** from what exists?
- A **hard trade-off** with a cost on each side (fun or realistic, solo or shared, saved or instant).
- Does it need to **remember** things (accounts, saved data)? Default: no accounts in version 1.
- Does it talk to the **outside world**? AI, email and sign-in are **real** once connected (see above).
  WhatsApp, SMS, payments and other services get a simulator so they can test everything today, and
  go real when there's a key. Does it need a **password or key from its users**
  (log in to a portal for them, their own API key)? That's fine: it goes in the vault (`keep-secrets-safe`).
- How will we know it works? "A friend can ___ in 30 seconds."

Push back once on vague answers.

## 1b. Name it and make its folder

Confirm the app's **name** ("Lunch Line") and **codename** (`lunch-line`: lowercase, dashes,
3–30 characters; it becomes the web address). Offer one, let them change it. Then run
`npm run new-app -- <codename> --name "<Name>"` and write the result to `apps/<codename>/docs/idea.md`:
the decisions, what was cut to "later", the 30-second test, and the Idea Lab link if there is one.
Everything from here is built in `apps/<codename>/`.

**Then connect it now, before building** (`/connect`: the `bhs-locker` tools, or
`npm run locker:connect` + `npm run locker:project`). About a minute, and the app's `.env` gets its real
AI key, email and sign-in settings, so the first version uses them. Already connected on this laptop?
It's just the project step. No internet or the hub is down? Build on the simulators and connect later:
switching is automatic once the keys are in `.env`.

## 2. Pick the stack

The folder already holds the **React starter** (the default, and the one to lean toward): Vite + React +
TypeScript + Tailwind + **shadcn/ui**, with the component galleries (React Bits, Magic UI, Aceternity UI)
ready to add with one command (`beautiful-components`). Underneath is the same small Node server
(`server.js`) with `/health`, a SQLite database (`db.js`, `node:sqlite` at `DATABASE_PATH`), the AI
route, and its own port in `.env`. `npm run dev` in the folder runs it, and it already passes every
`/ship` check. For almost every app (forms, lists, a feed, a planner, an AI helper, a dashboard)
**build on it**: screens in `src/`, routes in `server.js`, tables in `db.js`.

Lean toward React because that's where the beautiful pieces are. Only switch when the student has a
strong preference or the product truly needs another shape: a 2D game engine, a 3D world, a mostly
static content site. Then use **`stack-picker`**: say the choice and the trade-off in two lines, then
scaffold over the starter, non-interactively. A student who wants no packages at all can start with
`npm run new-app -- <codename> --plain` (plain HTML, CSS and JS). Keep what the host needs: `PORT`, `/health`, `DATABASE_PATH` for data, a `start`
script, and `locker/otel.mjs`. A static-only site serves with `locker/static.mjs` (see `/ship`).
Never hard-code a port: the one in `.env` (or `npm run port`).

## 3. Design before code

Use **`design-director`**: the chosen direction, then type, palette and layout. Pick one
memorable moment. No default look. **Phone first:** most people will open this app on a phone, so
design the 375px screen first (one column, the main action at thumb height, big tap targets), then
let it grow for laptops. Then **`beautiful-components`**: take the 2 or 3 standout pieces (an animated
headline, a background, a card) from the galleries instead of hand-writing them. If they want a name-brand feel (logo, colors, fonts), offer
`/branding`: a few quick taste questions now, the logo can wait until the first version works.

## 4. Architect it: providers, services, simulators

Before feature code, use **`providers-and-services`**: list every outside capability the idea touches
(messaging, payments, email, AI, maps…). Each gets a provider interface. **AI, email and sign-in use the
real Locker services from the start** (the app is connected); their simulators are only the offline and
test fallback. Capabilities the Locker doesn't provide (payments, WhatsApp/SMS, other APIs) get a
**simulator** that works today, labelled "Simulated" on screen. Plus seed data. If it uses AI, `kit/ai`
already reads the app's key (`ai-kit`); decisions and routing go to Jev (`jev-decisions`). If the AI
reads what users type or other outside text, follow `ai-safety` from the first version. Tell the student
which parts are real now, which are simulated, and what "going real" will take for those.

## 5. Build the smallest impressive version

Build the **one thing** from the interview, with real content, and polish it. Stop there and show
it. (`start-simple`)

## 6. Prove it

Use **`verify-in-browser`**: run it, take screenshots at desktop and phone size, check for zero
console errors, and fix what looks wrong. Then show the student the screenshots and ask:
"What's the next thing you want it to do?"

Once the first version works, offer once: "Want it online with a real web address? `/ship` puts it
live." (Not connected yet because the hub was unreachable? `/connect` first.) Before a big next feature, offer `/think-it-through`.
Before adding more features, offer `/playtest`: one real person using it beats any guess.

## 7. Save

Suggest `/wrap` to commit. The app is its own repo: commit inside `apps/<codename>/`.

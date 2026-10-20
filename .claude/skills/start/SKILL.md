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
- Does it talk to the **outside world** (WhatsApp, payments, email)? Explain that we'll build a
  simulator first so they can test everything today.
- How will we know it works? "A friend can ___ in 30 seconds."

Push back once on vague answers.

## 1b. Name it and make its folder

Confirm the app's **name** ("Lunch Line") and **codename** (`lunch-line`: lowercase, dashes,
3–30 characters; it becomes the web address). Offer one, let them change it. Then run
`npm run new-app -- <codename> --name "<Name>"` and write the result to `apps/<codename>/docs/idea.md`:
the decisions, what was cut to "later", the 30-second test, and the Idea Lab link if there is one.
Everything from here is built in `apps/<codename>/`.

## 2. Pick the stack

The folder already holds the **starter app**: a tiny Node server (`server.js`) with `/health`, a
SQLite database (`db.js`, `node:sqlite` at `DATABASE_PATH`), a phone-first page in `public/`, and its
own port in `.env`. `npm run dev` in the folder runs it, and it already passes every `/ship` check.
For most first apps (forms, lists, a feed, an AI helper) **build on it**: add routes to `server.js`,
tables to `db.js`, screens to `public/`.

When the product needs something else (a game engine, 3D, React with many screens), use
**`stack-picker`**: say the choice and the trade-off in two lines, then scaffold over the starter,
non-interactively. Keep what the host needs: `PORT`, `/health`, `DATABASE_PATH` for data, a `start`
script, and `locker/otel.mjs`. A static-only site serves with `locker/static.mjs` (see `/ship`).
Never hard-code a port: the one in `.env` (or `npm run port`).

## 3. Design before code

Use **`design-director`**: the chosen direction, then type, palette and layout. Pick one
memorable moment. No default look. If they want a name-brand feel (logo, colors, fonts), offer
`/branding`: a few quick taste questions now, the logo can wait until the first version works.

## 4. Architect it: providers, services, simulators

Before feature code, use **`providers-and-services`**: list every outside capability the idea touches
(messaging, payments, email, AI, maps…). Each gets a provider interface and a **simulator** that works
today, plus seed data. If it uses AI, copy `kit/ai` into the server code (`ai-kit`); decisions and
routing go to Jev (`jev-decisions`). Tell the student which parts are simulated and what "going real"
will take later.

## 5. Build the smallest impressive version

Build the **one thing** from the interview, with real content, and polish it. Stop there and show
it. (`start-simple`)

## 6. Prove it

Use **`verify-in-browser`**: run it, take screenshots at desktop and phone size, check for zero
console errors, and fix what looks wrong. Then show the student the screenshots and ask:
"What's the next thing you want it to do?"

Once the first version works, offer once: "Want it online with a real web address? `/connect`
gets you a hosting slot, then `/ship` puts it live." Before a big next feature, offer `/think-it-through`.
Before adding more features, offer `/test-with-a-friend`: one real person using it beats any guess.

## 7. Save

Suggest `/wrap` to commit. The app is its own repo: commit inside `apps/<codename>/`.

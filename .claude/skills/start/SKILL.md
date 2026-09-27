---
name: start
description: Turn a student's idea into a real first version. Interviews them (one sharp question at a time), picks the right stack, commits to a design direction, builds the smallest impressive version, and proves it works in a browser. Use when a student types /start, or says "I want to build…", "my idea is…", "help me make…".
disable-model-invocation: true
argument-hint: "[your idea in one sentence]"
---

# /start: from idea to a first version you're proud of

The student makes the decisions. You make them *good* decisions: you show the options, say
what each one costs, and recommend one. Never silently pick for them on things that change
what gets built.

## 1. Understand the idea (5 to 8 questions, one at a time)

If there's no idea in `$ARGUMENTS`, ask for it in one sentence. Then spend 2 minutes on
research: what already exists, and what the best examples do well. Share it in 3 lines.

Ask **one question per turn**, each with 2 to 4 concrete options, your marked recommendation,
and one line on **why it matters**. Only ask questions whose answers change the build:

- Who uses it, and in what moment?
- What's the **one thing** it must nail in version 1? (Everything else goes on a "later" list.)
- What should it **feel** like? Offer three named directions from `design-director`.
- What makes it **different** from what exists?
- A **hard trade-off** with a cost on each side (fun or realistic, solo or shared, saved or instant).
- Does it need to **remember** things (accounts, saved data)? Default: no, not in version 1.
- Does it talk to the **outside world** (WhatsApp, payments, email)? Explain that we'll build a
  simulator first so they can test everything today.
- How will we know it works? "A friend can ___ in 30 seconds."

Push back once on vague answers. Write the result to `docs/idea.md`: the decisions, what was
cut to "later", and the 30-second test.

## 2. Pick the stack

Use **`stack-picker`**. Say the choice and the trade-off in two lines. Scaffold it into a folder
named for the app (not the repo root), non-interactively. The dev server must take its port
from `npm run port` so it never collides with anything else running.

## 3. Design before code

Use **`design-director`**: the chosen direction, then type, palette and layout. Pick one
memorable moment. No default look.

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

## 7. Save

Suggest `/wrap` to commit. The student's branch, never `main`.

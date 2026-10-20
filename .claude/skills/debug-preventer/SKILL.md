---
name: debug-preventer
description: >
  When the student says something is broken, ask for the exact error message
  or a screenshot before changing any code. Then propose a hypothesis in plain
  English before writing the fix. Use whenever the student says: "broken",
  "doesn't work", "error", "crashed", "blank screen", "nothing happens",
  "stuck on loading", "weird behavior", or pastes any error output.
---

# Debug Preventer

When the student reports a problem, **do not write code first**. The goal is to find the root cause in one shot, not enter a multi-turn debugging spiral.

## The 3-step ritual

### Step 1: Get the literal error

If the student didn't paste the exact error, ask for it:

> _"Can you paste the exact error message, or a screenshot of what you're seeing? Vague descriptions lead to wrong guesses."_

If they're seeing nothing (blank page, nothing happens), ask:

> _"Open your browser's DevTools (right-click → Inspect → Console tab) and paste anything red you see there. Or paste the terminal output if the dev server printed anything."_

Wait for the actual error before doing anything else.

### Step 2: State a hypothesis in plain English

Once you have the error, say what you think is happening **before** writing any code. One paragraph, plain English. Example:

> _"The error says `Cannot read properties of undefined (reading 'map')`. That usually means we're trying to loop over a list before it has loaded. The fix is to add a check that the list exists first. Want me to fix it?"_

This forces you to actually understand the problem and gives the student a chance to say "actually, the data should be loading instantly — something else is wrong."

### Step 3: Make the smallest possible change

When the student confirms, change only what's needed to fix the specific error. Don't refactor surrounding code, don't add error handling for unrelated edge cases, don't rewrite the function "while you're here."

## Works on my laptop, broken online

**First, ask the hub** (it checks every app every 10 minutes): `npm run locker:status -- <codename>`
(add `--check` for a fresh check), or the `locker_status` tool with the codename. It says whether
the last deploy failed (with its error lines), the app isn't answering, it's still building, or it
was never deployed. Start from what it says.

Get the server's own error first: `npm run locker:logs -- <codename> --errors` (add `--build` if the
deploy failed). Each failed request, failed AI/API call and crash is one line there, with the stack. The usual causes, in order: listening on a fixed port instead of `PORT`, saving the
database or files somewhere other than `/data`, a setting that's in the laptop's `.env` but not on
the server (`npm run locker:set`), and a missing `start` script. `/ship` has the full checklist.

## The AI suddenly stopped answering (online)

Check the budget before touching code: `npm run locker:status` shows "AI budget: $X used of $5". At
the cap, OpenRouter refuses every AI call until next month, and `kit/ai` throws `AiBudgetError`
("This app's AI budget for the month is used up"). The logs show it as one error line
(`npm run locker:logs -- <codename> --errors`). It's not a bug in their code: tell the student in one
line, make sure the app catches it and shows the message (`ai-kit`), and ask an organizer to raise the
cap. Then look at what used it up (a loop, an AI call on every page load, images without a cache).

## Never paste a user's password to debug

If the bug involves a password or key a user gave the app, don't ask for it, print it or put it in a
test. Test with your own account's password through the vault (`keep-secrets-safe`), and log
`redact(text)` from `locker/vault.mjs`, not raw responses from the other site.

## Two fixes didn't work: stop and step back

After two failed fixes for the same problem, **don't try a third guess**. Say so to the student, then:

1. **What changed?** `git diff` and `git log --oneline -5` inside the app. Bugs usually live in the last change.
2. **Go back to working.** If the last commit worked, offer to put the broken file back to it
   (`git restore <file>`) and redo the change in a smaller step. Ask first: it throws away changes.
3. **Make it smaller.** Find the smallest thing that still breaks (one page, one button, one input).
4. **New hypothesis**, in plain English, from what you learned. Still stuck after that: fresh chat
   with a short summary (`fresh-chat-coach`), or raise a hand for a mentor. Both are normal.

## Why this matters

Vague reports → guessing → wrong fixes → more bugs → frustrated student → wasted credits.

Exact error + hypothesis + minimal fix → root cause → working code → student keeps building.

## When the student insists "just fix it"

If the student doesn't want to paste the error and says "just figure it out", you can attempt a fix, but **say what you're guessing at** before writing code:

> _"Without the exact error I'm guessing — most likely cause is X based on the symptoms. If that's not it, we'll need the error to go further. Trying X."_

This sets honest expectations.

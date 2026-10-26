---
name: verify-in-browser
description: "Prove a UI works before you say it does: start the dev server on its assigned PORT, take desktop and mobile screenshots with npm run shot, look at them, confirm zero console errors, and click through the core flow with Playwright. Use after every UI change, before telling the student something is done, and when a bug report says 'it looks wrong' or 'the button does nothing'."
---

# Verify in Browser

A build that compiles is not a page that works. Evidence comes before "done".
You must see the page, and the console must be clean.

## 1. Start the dev server on its port

```bash
# bash / Git Bash
export PORT=$(npm run -s port)
# PowerShell
$env:PORT = npm run -s port
```

Start the app's dev server with that `PORT` (see the `stack-picker` skill for the
per-framework wiring). Run it in the background, so you can keep working:
in Claude Code use a background shell; in Cursor use a separate terminal.

Wait until the server answers before you continue. The server log prints the URL.
If it says the port is in use, get a new port. Do not kill processes you did not start.

## 2. Take screenshots

```bash
npm run shot -- http://localhost:$PORT            # desktop
npm run shot -- http://localhost:$PORT --mobile   # phone size
```

The script saves PNG files to `tmp/shots/` and prints any console errors.
Use the path of each page you changed, for example `http://localhost:$PORT/scores`.

## 3. Look at the screenshots

Open each PNG with your file-read tool. Do not skip this step. Check:

- The page is not blank, and nothing shows an error overlay.
- The thing you changed is visible and looks as intended.
- Text is readable, nothing overlaps, nothing is cut off.
- On mobile: no horizontal scroll, buttons are big enough to tap, content fits.

If something looks wrong, fix it and take the screenshots again.

## 4. Console errors must be zero

Read the console output that `npm run shot` prints. The target is **0 errors**.
- A red error is a bug. Fix it, even if the page looks fine.
- A warning is not a blocker, but mention it if it is about your change.
- A failed network request (404, 500) counts as an error.

## 4b. Score the look (text, no image reading needed)

```bash
npm run critique -- http://localhost:$PORT          # an app
npm run critique -- http://localhost:$PORT --tap    # a game (also shoots a moment of play)
```

A vision model scores the screenshots out of 10 and gives three concrete fixes as text. Apply them. The look is
done at **7/10 or more**, or when the student accepts a lower score with a reason (`--accept "<reason>"`).
It costs about a cent of the app's AI budget; run it at checkpoints, not after every small edit.

## 5. Click through the core flow

Screenshots show the first view only. Use Playwright to do what a user does.
Use the `playwright-cli` skill for the commands. If `playwright-cli` is not on PATH, use
`npx playwright cli` when Playwright is installed in the project.

```bash
playwright-cli open http://localhost:$PORT
playwright-cli snapshot          # lists elements with refs like e5
playwright-cli click e5          # press the main button
playwright-cli fill e8 "Hello"   # type into an input
playwright-cli snapshot          # confirm the result appeared
playwright-cli console           # check for new console errors
playwright-cli screenshot        # evidence of the end state
playwright-cli close
```

Walk each acceptance check from the plan (Given / When / Then). For a game, play one
round: start, score, lose or win, restart. For a form, submit good input and bad input.
If data should be saved, reload the page and check it is still there.

For flows you will check again and again, write a Playwright test (see the
`e2e-testing` skill or the `e2e-runner` agent).

## 6. Report with evidence

```
VERIFIED
- Desktop: tmp/shots/<file>.png - start screen shows, button visible
- Mobile:  tmp/shots/<file>.png - fits 390px, no horizontal scroll
- Console: 0 errors
- Look:    npm run critique - 7/10 (fixes applied: CTA contrast, heading size)
- Flow:    Start -> play -> score shows 312 ms -> reload -> best score kept
```

If any step fails, report **NOT VERIFIED**, say which step failed and why, and fix it
before you claim anything else.

## Rules

- **Never say "should work".** Say what you saw, with the file path.
- **Screenshots you did not open do not count.**
- **Verify the real dev server**, not a guess from reading the code.
- **Stop the dev server** you started when you are done, unless the student is using it.

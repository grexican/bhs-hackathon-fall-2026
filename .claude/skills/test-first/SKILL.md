---
name: test-first
description: Before writing logic that can be wrong (a calculation, a score, a date rule, parsing, validation, "who wins"), write ONE small test that says what right looks like, watch it fail, then write the code until it passes. Also how to spot a test that can never fail. Uses Node's built-in test runner, no installs. Use when building any function with a right answer, when the student says "calculate", "count", "parse", "check if", "sort by", "due this week", or when a bug in logic came back twice. Not for button wiring or layout.
---

# Test first

For a piece of logic with a right answer, decide what "right" is **before** writing it. One small
test does that. It takes two minutes and saves the "it worked yesterday" bugs.

## When (and when not)

- **Yes:** math, scores, dates ("due this week"), parsing, validation, sorting rules, game rules.
- **No:** a button that calls a function, layout, colors, text. Check those in the browser (`verify-in-browser`).

## The loop

1. **Say it in one sentence** to the student: "`dueThisWeek(tasks)` returns only tasks due in the next 7 days."
2. **Write one test** in `tests/<name>.test.js` (Node's built-in runner, nothing to install):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueThisWeek } from "../lib/tasks.js";

test("only tasks due in the next 7 days", () => {
  const today = new Date("2026-10-24");
  const tasks = [{ title: "Essay", due: "2026-10-26" }, { title: "Project", due: "2026-11-20" }];
  assert.deepEqual(dueThisWeek(tasks, today).map((t) => t.title), ["Essay"]);
});
```

3. **Run it and watch it fail:** `node --test tests/` (add `"test": "node --test tests/"` to `package.json`).
   A test that passes before the code exists tests nothing.
4. **Write the smallest code** that makes it pass. Run it again: green.
5. **One or two edge cases** only if they're real: empty list, today itself, a date in the past.

Pass "today" in as an argument (like above) so the test doesn't change answer tomorrow.

## A test that can't fail is worse than no test

It says "all good" while the feature is broken. Check each test for these:

- **Missing `await`** on something async: the test ends before the check runs.
- **Weak checks:** `assert.ok(result)` passes for almost anything. Check the actual value.
- **`test.only` left in:** the other tests silently stop running.
- **Errors swallowed** with `try { … } catch {}` inside the test.
- **Testing the fake, not the code:** if everything is mocked, nothing real is tested.

Quick proof: break the code on purpose (change `7` to `70`), run the test, see it go red, put it back.

## Done means

The test failed first, passes now, runs with `npm test`, and the student can read it out loud as a
sentence about the app. Then `/wrap`.

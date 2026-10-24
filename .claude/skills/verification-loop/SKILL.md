---
name: verification-loop
description: "The full check (build, typecheck, lint, the WHOLE test suite, secret grep, diff review, PASS/FAIL report), run only at checkpoints: a feature finished, before /ship or a demo, after pulling a teammate's work, after changing shared code (a provider, service, schema or the kit). NOT after every small change: between checkpoints run only the focused test for what you touched. Use when a feature is done, before a commit you will ship, or when asked to verify."
license: MIT
---

# Verification Loop Skill

A comprehensive verification system for Claude Code sessions.

## When to run it (and when not)

**The whole suite is slow; the focused test is fast. At a hackathon, throughput is the product.** Running
everything after every edit turns a 2-second loop into minutes and kills the build. Two speeds:

**Inner loop: every small change. Focused only, seconds:**
- The test file for what you touched: `node --test tests/score.test.js`, or one test by name:
  `node --test --test-name-pattern="due this week" tests/`. One e2e spec, if the change is in that flow:
  `npx playwright test tests/checkout.spec.ts`.
- `npx tsc --noEmit` if you changed types. A UI change: a look in the browser (`verify-in-browser`), not the suite.
- Never the whole suite, never the whole e2e run here.

**Checkpoints: the full run (this skill), and only then:**
- A feature or fix is finished and about to be called done.
- Before `/ship`, before a demo, before a commit someone else will build on.
- After pulling or merging a teammate's work.
- After changing something many parts depend on: a provider or service interface, the database schema,
  shared components, the kit itself, a dependency upgrade.
- A focused test went red in a way that suggests something wider broke.

Run the full suite **in the background** and keep working; check the result before you claim done.
If it fails, go back to the inner loop on the failing test only, then re-run the full suite once at the end.

## Verification Phases

### Phase 1: Build Verification
```bash
# Check if project builds
npm run build 2>&1 | tail -20
# OR
pnpm build 2>&1 | tail -20
```

If build fails, STOP and fix before continuing.

### Phase 2: Type Check
```bash
set -o pipefail
# TypeScript projects
npx --no-install tsc --noEmit 2>&1 | head -30

# Python projects
pyright . 2>&1 | head -30
```

Report all type errors. Fix critical ones before continuing.

### Phase 3: Lint Check
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### Phase 4: Test Suite
```bash
# The whole suite, once, here at the checkpoint
npm test 2>&1 | tail -50
```

Report:
- Total tests: X
- Passed: X
- Failed: X

### Phase 5: Security Scan
```bash
# Check for secrets
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# Check for console.log
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### Phase 6: Diff Review
```bash
# Show what changed
git diff --stat
git diff HEAD~1 --name-only
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Between checkpoints

Not this skill. After each function or component: its focused test (seconds), and a browser look if it has a
UI. Save the full run for the checkpoints above.

## Pair with the browser check

Build and test output prove the code compiles. They do not prove the page works.
For any UI change, also run the `verify-in-browser` skill: screenshots, zero console
errors, and a click-through of the core flow.

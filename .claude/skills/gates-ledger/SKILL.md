---
name: gates-ledger
description: Turns a task's success criteria into an evidence-backed gates file. Use when work has a definition of done that must be verified — a build, a migration, a multi-step change, a feature handed to another agent — and especially before reporting a task complete. Also use when reviewing whether another agent's "done" is real.
license: MIT
---

# Gates ledger

## Why this exists

AGENTS.md principle 4 says: define success criteria, loop until verified. As prose, nothing enforces it. An agent can write "✅ tests pass" without running tests. That is **partial compliance** — the agent reports done on work it half-did — and it is the most common way agent work fails silently.

A gates ledger makes the claim checkable. It is principle #4 as a file the agent cannot lie to.

Adapted from Leonxlnx/unlazy (MIT): the ledger only, kept fast.

## The contract

Each criterion carries three fields. All three are required.

| Field | Meaning |
|---|---|
| `command` | How to check it, executably. A real command, not a description. |
| `expected` | What passing looks like. Concrete: an exit code, a count, a string. |
| `evidence` | The actual output, captured when the command ran. |

**A ticked box with an empty `evidence` field is UNMET.** It is worse than an empty box, because it claims a check that nobody ran. Treat it as a failure and say so.

## Rules

1. Write the ledger **before** you start the work, not after. Criteria written afterward describe what you did, not what was required.
2. One criterion per line. Do not bundle two checks into one box.
3. `command` must be runnable by someone else, from the repo root.
4. Paste real output into `evidence`. Do not summarise it. Truncate long output to the lines that prove the claim.
5. If a criterion cannot be checked by a command, say so in `command` as `MANUAL: <what a human must look at>`. A manual gate is weaker than an automated one. Prefer to convert it.
6. Report a task complete **only** when every gate is met, or you have named the unmet ones explicitly.

## Choosing the checker

Grade each gate on this ladder (higher is stronger):

| Rung | Checker | Use it when |
|---|---|---|
| 0 | The same model grades its own output | **Never.** This is the anti-pattern the ledger exists to stop. |
| 1 | Same model, fresh context, never saw the reasoning | Judgment calls with no deterministic test. Cheap. Always available. |
| 2 | A different model or agent | The call is contested or expensive to get wrong. |
| 3 | Deterministic code — a test, a schema, a linter, `npm run check` | **Prefer this.** It cannot be talked out of its answer. |
| 4 | External reality — a named, fetchable comparable | The standard is comparative, not binary. |

Climb from rung 0 to rung 1 first. It costs nothing and buys the most.

## Format

Write the ledger to `tmp/gates/<task-slug>.md`, or inline in your reply for small work.

```markdown
# Gates — <task>

- [x] The repo check passes on staged files
  - command: `node scripts/check.mjs --staged`
  - expected: exit 0, no ERROR lines
  - evidence: `check: clean (12 files)`
  - rung: 3

- [x] The new skill is discoverable by name
  - command: `ls .claude/skills/gates-ledger/SKILL.md`
  - expected: the path prints
  - evidence: `.claude/skills/gates-ledger/SKILL.md`
  - rung: 3

- [ ] The app does the one thing the student asked for
  - command: `MANUAL: read the For future Claude preamble cold`
  - expected: relevance judgeable in 10 seconds
  - evidence:
  - rung: 1
```

The third gate is honest: unticked, no evidence, and its rung is named. That is the ledger working.

## When to skip it

Trivial, single-step, reversible work. A ledger for a one-line typo fix is ceremony. Use judgment — but note that "this is trivial" is exactly what an agent says right before it skips the check that would have caught the problem.

Related: `karpathy-guidelines`, `verification-loop`, `verify-in-browser`.

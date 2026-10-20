---
name: think-it-through
description: Before building a big feature, settle its open decisions one at a time. Answers from the code first, then quick research, and asks the student only what needs them. Writes the decisions to docs/decisions.md. Use when a student types /think-it-through, or before a feature with real choices in it (accounts, sharing, payments, a new screen flow).
argument-hint: "[the feature]"
---

# /think-it-through: decide before you build

1. **List the open decisions** for the feature in 3–6 short lines (what to save, who sees what,
   what happens on an error, which screen…). Order them so each one only depends on those above it.
   Show the list.
2. **Take them one at a time.** Use the cheapest thing that can answer each:
   - **The code** already decides it? Say so in one line and move on.
   - **A quick search** settles it (how do others do this)? Give the answer and one source.
   - **Only the student can decide** (what they want, who it's for, how it should feel)? Ask
     **one question**: 2–3 options, mark your recommendation, one line on why it matters.
3. **Write each decision** to `docs/decisions.md` in the app folder as you go:
   `- **<decision>**: <choice>. Why: <one line>. (<date>)`
4. End with a 3-line build plan and ask: "Build it?"

A big, hard-to-undo call where they're torn? Offer `/council`.

---
name: whats-next
description: Help the student pick the ONE next thing to work on in their app, from evidence instead of a wish list - reads the idea, the "later" list, tester feedback, visit counts and decisions, then offers 2-3 options with what each one would prove, and a pre-mortem on the pick. Use when a student types /whats-next, says "what should I build next?", "I'm stuck on what to do", "I have too many ideas", at the start of an incubator session, or after a round of testing.
argument-hint: "[codename]"
---

# /whats-next: one thing, picked on purpose

After the first version works, the hard part isn't building: it's choosing. Most student apps
stall because they add features nobody asked for while the one thing people need is still confusing.

## 1. Look at the evidence (you do this, not the student)

Read what exists in `apps/<codename>/docs/`: `idea.md` (the one thing, the "later" list),
`feedback.md` (tests with real people), `decisions.md`, and `/stats` if the app counts visits
(`share-it`). If the app is online, read the Feedback button's inbox too (`locker_feedback` tool, or
`npm run locker:feedback -- <codename>`; `--new` for unread) and quote testers' own words. Then tell the student in 3 lines max: what's working, what's not, and what we
don't know yet.

No tester feedback yet? Say so: the best next step is almost always `/test-with-a-friend`, not a feature.

## 2. Offer 2–3 options

Pick from these kinds, in this order of priority:

1. **Fix what stops people** (a "broken" or "confusing" moment from testing).
2. **Get the one thing to more people** (`/share-it`, `/on-my-phone`).
3. **Test the riskiest guess** the app is still built on, as cheaply as possible.
4. **A new feature**, only if real people asked for it, and only one.

For each option: one line on what it is, one line on **what it would prove**, and rough size
(an hour, an afternoon, a weekend). Mark one **(recommended)** and say why. The student picks.

## 3. Pre-mortem the pick

Ask one question: **"Imagine it's two weeks from now and this didn't help. Why?"** Take their answer
seriously. If it shows a cheaper test, offer it. Then write the pick and the reason in
`docs/decisions.md`, with a date, and how we'll know it worked ("3 of 5 testers rate lunch without help").

Then build it the smallest way (`start-simple`), or `/think-it-through` first if it has open decisions.

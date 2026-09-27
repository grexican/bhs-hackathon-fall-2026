---
name: jev-decisions
description: When and how to use Jev, a fast, cheap DECISION model (yes/no, pick-one-of-N, ordered scale, with calibrated probabilities), instead of a chat LLM. Use for routing, triage, classification, guards/quality gates, moderation, picking which model or tool to use, game AI that decides every tick, and scoring many records fast. Use whenever code is about to ask an LLM a question whose answer is a label, a boolean, or a number on a scale.
---

# Jev: decisions, not words

A chat model writes. Jev **decides**. You give it a state (text or JSON) and typed questions; it
returns calibrated probabilities. No parsing, no prompt-begging for JSON, no hallucinated labels:
the answer is always one of your keys.

**Measured here (2026-09):** three questions (a yes/no, a 4-way choice and a 4-level scale) in one
call took 0.55 to 0.8 s and cost **$0.000018**. That's about 50,000 decisions per dollar. A small chat
model doing the same job is slower, costs 10 to 100 times more, and returns text you still have to parse.

Code: `kit/ai/jev.ts`. Try it: `npm run ai -- decide "i got charged twice"`.

## The three question types

| Type | Answers | Returns | Limits |
|---|---|---|---|
| `noul` | "Is this true?" | `noul`: probability 0–1 (it *is* the confidence) | criteria `{ true, false }` descriptions |
| `choice` | "Which one of these?" | `choice`, `confidence`, `probabilities` for every key (sum to 1) | up to 255 options, criteria `{ key: description }` |
| `score` | "Where on this ordered scale?" | `score` (fractional: 1.8 means "about level 2"), `probabilities`, `confidence` | 2–10 levels, criteria is an **array**, lowest first |

Many questions about the **same state** go in **one request**: they run in parallel and share the
state cost. Ask speculatively, meaning ask things you *might* need and ignore the ones you don't.

## When to reach for Jev (and when not)

| Use Jev | Use a chat tier (`kit/ai` `ask`) |
|---|---|
| Route this message to a team, a page, a bot flow | Write the reply |
| Is this on-topic, safe, spam, urgent, a duplicate? | Explain why |
| Which model tier or tool should handle this request? | Do the task |
| Did this rewrite keep the meaning? (quality gate) | Produce the rewrite |
| Score 700 leads or 2,000 reviews in a minute | Summarize the top 10 |
| Game AI: left, straight or right, every tick | Generate the level |
| Grade a student answer: wrong, partial, right | Give feedback on it |

Jev **cannot**: see images, generate text, do arithmetic you could do in code, or know facts that
aren't in the state. Put what it needs *in the state*.

## Patterns that work

1. **Always have a rule fallback.** Every `kit/ai/jev.ts` helper returns `null` on any failure: no key,
   sim mode, a timeout (4 s), or a vendor error. Write `(await noul(...))?.p ?? ruleBasedGuess(text)`. The
   app never blocks on the decision layer, and sim mode exercises the fallback path for free.
2. **Offer a way out.** A `choice` always answers one of your keys, so include `none: "none of these fit"`.
   Otherwise the model is forced to pick something wrong.
3. **Threshold by cost of being wrong.** Act automatically above a high bar (for example 0.8), escalate or ask
   a human in the middle, and do the safe default below. Log the probabilities while you tune; don't guess.
4. **Guard, then escalate.** A cheap, fast model does the work, and Jev checks it: "Does the output keep
   the main subject of the input?" Below the floor, rerun on a stronger tier. In one pipeline this scored
   faithful rewrites 0.94 to 0.98 and a rewrite that silently dropped the subject 0.08, in about 0.4 s,
   so the expensive model only ran when needed.
5. **Deterministic checks first.** Empty output, wrong length, a missing required word: catch these in code
   before asking Jev. Spend the model on judgment, not on things `if` can see.
6. **Word the question like the real decision.** Rephrasing a guard question to match what actually
   mattered moved its scores a lot. When a threshold feels wrong, check the wording before moving the
   number.
7. **Pick zero or more:** one `noul` per candidate in the same request (`pickMany`), keeping the ones above
   a floor. Alternatively, take the top items of one `choice` and always include `none`.
8. **More than 255 options:** use two stages. First filter cheaply (group choice or per-item `noul`), then
   run a `choice` among the survivors. Or go hierarchical: category first, then item.
9. **Route models with it.** Before calling an expensive tier, ask a `choice` over `{ lite, fast, smart,
   thinking }` with each tier's job as its description, and call only what's needed. The `auto` tier
   (`typesafe/jev-router`) does this for you inside a normal chat call.
10. **Trim the state.** You pay per input token. Send the fields the question needs, not the whole record.

## Shape of a call

```ts
import { decide, noul, choice, score, pickMany } from "./ai/jev.ts";

const d = await decide({ message, customer: { plan, openTickets } }, {
  urgent: { type: "noul", instructions: "Does this need a human in the next hour?", criteria: { true: "needs a human now", false: "can wait" } },
  team:   { type: "choice", instructions: "Which team owns this?", criteria: { billing: "payments, refunds", tech: "bugs, outages", none: "none of these" } },
  mood:   { type: "score", instructions: "How upset is the customer?", criteria: ["calm", "annoyed", "upset", "furious"] },
});
if (!d) return ruleBasedTriage(message);   // always a fallback
```

## Safety and data

Jev is a third-party service reached through OpenRouter. Don't send passwords, secrets, or
sensitive personal data (health, IDs, other people's private messages) in the state. Keep states
to what the decision needs.

## Show the student

Decisions come with probabilities, so show them: "Routed to billing (97% sure)". Seeing the
confidence is the lesson: AI doesn't just answer, it can tell you how sure it is, and good software
acts differently at 97% than at 51%.

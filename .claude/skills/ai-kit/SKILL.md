---
name: ai-kit
description: How apps here use AI. Ask for a KIND of model (lite, fast, smart, thinking, vision, image, auto) through kit/ai, never hard-code a model id; decisions go to Jev; everything runs offline in sim mode. Use whenever a feature calls an LLM, generates images, classifies or routes with AI, or when choosing or swapping models.
---

# The AI kit: ask for a kind of model, not a model

`kit/ai/` is a zero-dependency, provider-shaped AI layer (see `providers-and-services`):

| File | What it gives you |
|---|---|
| `models.ts` | The **tier router**: `lite · fast · smart · thinking · vision · image · auto` → a configured OpenRouter model |
| `llm.ts` | `ask(tier, prompt)`, `askJson(tier, prompt, schema)`, `image(prompt)`, with OpenRouter + **simulator** providers |
| `jev.ts` | `decide / noul / choice / score / pickMany`: fast decisions (see `jev-decisions`) |
| `env.ts` | Finds the nearest `.env` walking up, so apps inside this repo share the root key |
| `cli.ts` | `npm run ai -- models | ask | bench | decide | image` |

## Using it in an app

1. **Copy** `kit/ai/` into the app's **server** code, for example `my-app/src/server/ai/`. It is TypeScript
   with only erasable syntax, so it runs in Next.js, Astro endpoints, Vite SSR, or plain `node file.ts`
   (Node 22.18+).
2. **Call it only from the server.** A route handler or API endpoint; never a React component. The key
   must never reach the browser. A Vite single-page app gets a tiny server route for AI calls.
3. **Pick the tier by job:**

| Tier | Use it for | Measured (2026-09) |
|---|---|---|
| `lite` | Bulk and background: tagging, short summaries, drafts | ~1.4 s, ~$0.00002/call |
| `fast` | Anything a user waits on: chat replies, quick JSON | ~0.3–0.9 s, ~$0.00004 |
| `smart` | Quality writing, tool use, strict structured output | ~2.9 s, ~$0.0005 |
| `thinking` | Hard reasoning, planning, judging other outputs | ~7 s, ~$0.004 |
| `vision` | Reading images, screenshots, PDFs | ~1.3 s |
| `image` | Generating images | ~10 s, **~$0.07 per image**: cache results, never loop |
| `auto` | Let a router pick model + effort per request | varies |
| (`jev.ts`) | Yes/no, pick-one, scales: routing, guards, triage | ~0.5 s, ~$0.00002 |

**Start at `fast`.** Move up only when you can *see* the output isn't good enough; move down for
volume. Decisions (labels, booleans, scores) go to Jev, not to a chat tier.

## Swapping models (experiments)

Never edit code to change models. In `.env`:

```bash
MODEL_FAST=z-ai/glm-5.3-flash      # try a different fast model
MODEL_SMART=openai/gpt-6-sol
MODEL_DECIDE=typesafe/jev-1.13     # pin Jev instead of ~latest
AI_PROVIDER=sim                    # force the offline simulator
```

Then `npm run ai -- models` to confirm, and `npm run ai -- bench fast smart` to compare output, speed and
cost side by side. Model ids come from openrouter.ai/models.

## Simulator mode

No `OPENROUTER_API_KEY`, or `AI_PROVIDER=sim`: `ask` returns a labelled `[Simulated …]` reply,
`askJson` returns the smallest object that fits your schema, `image` returns a labelled placeholder
SVG, and Jev returns `null` (so your rule fallback runs). Every result has `simulated: true`. Show
a small "Simulated AI" tag in the UI when it's true.

## Rules

- **Structured output:** use `askJson` with a JSON schema (`additionalProperties: false`, every field
  `required`). Don't regex JSON out of prose.
- **Stream nothing you don't show.** Short `maxTokens` for short answers keeps `fast` fast.
- **Log `ms` and `cost`** while building; show them in a dev panel. Students learn what AI costs.
- **Cache** expensive results (images, `thinking` answers) by input, in SQLite or a JSON file.
- **Never** put a model id string in app code outside `models.ts`.

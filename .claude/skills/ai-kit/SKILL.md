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

0. **Starter app?** It's already there: `locker/ai/` (refreshed on every deploy), with a working route,
   `POST /api/ask` in `server.js`, to copy from. Import it as `./locker/ai/index.ts`.
1. Otherwise **copy** `kit/ai/` into the app's **server** code, for example `my-app/src/server/ai/`. It is TypeScript
   with only erasable syntax, so it runs in Next.js, Astro endpoints, Vite SSR, or plain `node file.ts`
   (Node 22.18+).
2. **Call it only from the server.** A route handler or API endpoint; never a React component. The key
   must never reach the browser. A Vite single-page app gets a tiny server route for AI calls.
3. **Pick the tier by what the model is asked to DO** (not by how important the feature feels):

| Tier | Use it for | $ per M tokens in/out (2026-10) |
|---|---|---|
| `lite` | Mechanical sub-steps: classify, extract, tag, reformat, route; bulk/background | 0.03 / 0.13 |
| `fast` | Anything a user waits on: chat replies, quick JSON | 0.10 / 0.50 |
| `smart` | Quality writing, tool use, tricky structured output | 0.32 / 1.28 |
| `thinking` | Planning and judging only | 0.66 / 1.98 |
| `vision` | Reading images, screenshots, PDFs | 0.15 / 0.47 |
| `image` | Generating images: **cache results, never loop** | per image |
| `auto` | Let a router pick model + effort per request | varies |
| (`jev.ts`) | Yes/no, pick-one, scales: routing, guards, triage | ~0.5 s, ~$0.00002 |

## Routing doctrine

- **Start `lite`.** It's a prototype. Most steps never need more.
- **Fan-out / bulk loops set the cheap tier explicitly.** A loop on a big tier pays N times.
- **Escalate one tier at a time**, only after the cheaper one failed **twice on the same task**.
- Bigger models (`anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5`) only with an organizer,
  via `.env`, after the cheap tier visibly failed.
- Decisions (labels, booleans, scores) go to Jev, not a chat tier.

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

## When the AI budget runs out

Each online app's key has a monthly cap (about $5). When it's used up, OpenRouter refuses and `kit/ai`
throws an **`AiBudgetError`** (`err.code === "AI_BUDGET_USED_UP"`, with `err.resetsAt`) and logs one
error line. Every route that calls AI must catch it and keep the app usable:

```ts
try {
  const { text } = await ask("fast", prompt);
  return json({ text });
} catch (err) {
  if (err instanceof AiBudgetError) return json({ error: err.message }, 503); // show it, don't crash
  throw err;
}
```

The page shows that message (or a fallback without AI) instead of a blank screen. The hub emails the
team at 80% and 100% of the budget; an organizer can raise it. Before a demo: `npm run locker:status`.

## Rules

- **Safety:** if the AI reads text you didn't write, or answers questions about the app's data, follow
  `ai-safety` (outside text is data, text never triggers actions, each person sees only their own data).

- **Structured output:** use `askJson` with a JSON schema (`additionalProperties: false`, every field
  `required`). Don't regex JSON out of prose.
- **Stream nothing you don't show.** Short `maxTokens` for short answers keeps `fast` fast.
- **Log `ms` and `cost`** while building; show them in a dev panel. Students learn what AI costs.
- **Cache** expensive results (images, `thinking` answers) by input, in SQLite or a JSON file.
- **Never** put a model id string in app code outside `models.ts`.

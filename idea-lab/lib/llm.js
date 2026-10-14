// OpenRouter client. Two tiers on purpose, both cheap:
//   fast  - research summary + interview questions (a person is waiting, small JSON)
//   build - the prototype itself (long HTML output, needs a model that writes good front-end code)
// Swap either in .env without touching code: MODEL_FAST=..., MODEL_BUILD=...
import { simChat } from "./sim.js"; // AI_SIM=1: offline canned answers, no network

export const MODELS = {
  fast: () => process.env.MODEL_FAST || "openai/gpt-6-luna",
  build: () => process.env.MODEL_BUILD || "deepseek/deepseek-v4-pro-0813",
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function chat({ tier, model: override, system, user, json = false, maxTokens = 1200, temperature = 0.7, timeoutMs = 60_000 }) {
  if (process.env.AI_SIM === "1") return simChat({ tier, system, user, json });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = override || MODELS[tier]();
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_URL || "http://localhost",
      "X-Title": "BHS Hackathon idea lab",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      // Fast tier answers right away; build tier can think a little about layout.
      reasoning: { effort: tier === "fast" ? "minimal" : "low", exclude: true },
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content ?? "";
  const usage = { tier, model, ms: Date.now() - started, cost: body.usage?.cost ?? null, out: body.usage?.completion_tokens ?? null };
  return { text, usage, data: json ? parseJson(text) : null };
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

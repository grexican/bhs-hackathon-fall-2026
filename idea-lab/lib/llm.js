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

/**
 * Streaming variant for long outputs (the prototype). Calls onText(textSoFar) as tokens arrive, so
 * the build can report progress, and returns `finish` so a cut-off answer ("length") is never
 * mistaken for a finished one. That cut-off is exactly how a half-written prototype once shipped.
 */
export async function chatStream({ tier, model: override, system, user, maxTokens = 32000, temperature = 0.6, timeoutMs = 300_000, onText }) {
  if (process.env.AI_SIM === "1") {
    const r = await simChat({ tier, system, user, json: false });
    onText?.(r.text);
    return { ...r, finish: "stop" };
  }
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
      stream: true,
      usage: { include: true },
      // Thinking tokens count against max_tokens; keep them small so the file itself fits.
      reasoning: { effort: "minimal", exclude: true },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let text = "";
  let finish = null;
  let usageBody = null;
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // ": OPENROUTER PROCESSING" keep-alives
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      const evt = JSON.parse(data);
      if (evt.error) throw new Error(`OpenRouter stream error: ${JSON.stringify(evt.error).slice(0, 300)}`);
      const choice = evt.choices?.[0];
      if (choice?.delta?.content) {
        text += choice.delta.content;
        onText?.(text);
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (evt.usage) usageBody = evt.usage;
    }
  }
  const usage = { tier, model, ms: Date.now() - started, cost: usageBody?.cost ?? null, out: usageBody?.completion_tokens ?? null, finish };
  return { text, usage, finish };
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

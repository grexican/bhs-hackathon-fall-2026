// LLM calls behind one provider interface. Server-side only: the API key must never reach a browser.
//
//   const { text } = await ask("fast", "Give me 3 names for a study app");
//   const { data } = await askJson("smart", "Plan a 3-day trip to Rome", tripSchema);
//   const { dataUrl } = await image("a neon skateboard, sticker style");
//
// Provider choice: AI_PROVIDER=sim forces the simulator; with no OPENROUTER_API_KEY the simulator
// is used automatically, so every app runs and tests offline. Simulated output is labelled as such.
import { loadEnv } from "./env.ts";
import { env, resolveTier, type Tier } from "./models.ts";

export type Message = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type JsonSchema = Record<string, unknown>;

export interface AskOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * Search the web first (OpenRouter's web search, any model). true = up to 5 results; or { maxResults }.
   * The answer then cites what it found: result.sources lists the pages. Costs about half a cent per call.
   */
  web?: boolean | { maxResults?: number };
  /**
   * askJson only: what a real answer looks like, e.g. (d) => d.questions.length > 0. An answer that fails it is
   * asked for once more, like a cut-off one. Use it for the fields your app can't do without.
   */
  valid?: (data: any) => boolean;
}

/** A page the answer used, when web search was on. */
export interface Source {
  url: string;
  title: string;
}

export interface AskResult {
  text: string;
  model: string;
  ms: number;
  cost: number;
  simulated: boolean;
  /** Which provider OpenRouter sent the call to (one model can be served by several). */
  via?: string;
  /** The web pages the answer cited (only with opts.web). */
  sources?: Source[];
}

export interface LlmProvider {
  name: string;
  chat(tier: Tier, messages: Message[], opts: AskOptions & { schema?: JsonSchema }): Promise<AskResult>;
  image(prompt: string): Promise<{ dataUrl: string; model: string; ms: number; cost: number; simulated: boolean }>;
}

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

const openRouterProvider: LlmProvider = {
  name: "openrouter",
  async chat(tier, messages, opts) {
    const cfg = resolveTier(tier);
    const t0 = Date.now();
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      max_tokens: opts.maxTokens ?? 2000,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(cfg.reasoning && { reasoning: { effort: cfg.reasoning, exclude: true } }),
      // With a schema, only providers that honor it: one that ignores response_format can answer in the right
      // shape with nothing in it ("...", empty strings), which looks like a working answer.
      ...((cfg.sort || opts.schema) && { provider: { ...(cfg.sort && { sort: cfg.sort }), ...(opts.schema && { require_parameters: true }) } }),
      ...(opts.schema && {
        response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: opts.schema } },
      }),
      ...(opts.web && { plugins: [{ id: "web", max_results: typeof opts.web === "object" ? (opts.web.maxResults ?? 5) : 5 }] }),
    };
    let json;
    try {
      json = await post(body);
    } catch (err) {
      if (!(err as { noEndpoint?: boolean }).noEndpoint) throw err;
      // Some models (reasoning ones especially) refuse `temperature`. Drop it and try once more.
      if (body.temperature !== undefined) {
        delete body.temperature;
        console.warn(`[ai] ${cfg.model} doesn't take a temperature; asked again without it.`);
        json = await post(body).catch((again) => {
          throw (again as { noEndpoint?: boolean }).noEndpoint ? cantDoIt(tier, cfg.model, opts) : again;
        });
      } else throw cantDoIt(tier, cfg.model, opts);
    }
    // With web search on, the answer's citations arrive as url_citation annotations.
    const notes: { type?: string; url_citation?: { url?: string; title?: string } }[] = json.choices?.[0]?.message?.annotations ?? [];
    const seen = new Set<string>();
    const sources = notes.flatMap((a) => {
      const url = a.type === "url_citation" ? a.url_citation?.url : undefined;
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ url, title: a.url_citation?.title || url }];
    });
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? cfg.model,
      ms: Date.now() - t0,
      cost: json.usage?.cost ?? 0,
      simulated: false,
      ...(json.provider && { via: json.provider }),
      ...(opts.web && { sources }),
    };
  },
  async image(prompt) {
    const cfg = resolveTier("image");
    const t0 = Date.now();
    const json = await post({ model: cfg.model, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] });
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error(`${cfg.model} returned no image`);
    return { dataUrl: url, model: json.model ?? cfg.model, ms: Date.now() - t0, cost: json.usage?.cost ?? 0, simulated: false };
  },
};

/**
 * The app's AI money for the month has run out (each app's key has a monthly cap). The app should
 * catch it and show a friendly message, not crash:
 *   catch (err) { if (err instanceof AiBudgetError) return res.status(503).json({ error: err.message }); throw err; }
 * `err.code` is always "AI_BUDGET_USED_UP", so `err.code === "AI_BUDGET_USED_UP"` works too.
 */
export class AiBudgetError extends Error {
  code = "AI_BUDGET_USED_UP" as const;
  status: number;
  resetsAt: string | null;
  constructor(message: string, status: number, resetsAt: string | null = null) {
    super(message);
    this.name = "AiBudgetError";
    this.status = status;
    this.resetsAt = resetsAt;
  }
}

/** Turns OpenRouter's "out of budget" answers into an AiBudgetError; anything else gives null. */
export function budgetError(status: number, json: { error?: { message?: string; metadata?: { limit_source?: string } } } | null): AiBudgetError | null {
  const message = json?.error?.message ?? "";
  // 403 "Key limit exceeded (monthly limit) ... resets 2026-11-01T00:00:00.000Z." (checked against OpenRouter)
  if (status === 403 && (json?.error?.metadata?.limit_source === "openrouter_key_limit" || /key limit exceeded/i.test(message))) {
    const resetsAt = message.match(/resets (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/)?.[1] ?? null;
    return new AiBudgetError("This app's AI budget for the month is used up. Ask an organizer to raise it.", status, resetsAt);
  }
  // 402: what's left can't pay for this request ("can only afford ...") or the incubator's credit ran out.
  if (status === 402) {
    return /afford/i.test(message)
      ? new AiBudgetError("This app's AI budget for the month is almost used up. Shorter answers (a lower maxTokens) may still work; ask an organizer to raise it.", status)
      : new AiBudgetError("The incubator's AI credit has run out. Tell an organizer.", status);
  }
  return null;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch(OPENROUTER, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await res.json().catch(() => null);
  const budget = budgetError(res.status, json);
  if (budget) {
    // One error line in the logs (npm run locker:logs -- <codename> --errors), same shape as the request logs.
    console.error(JSON.stringify({ level: "error", message: `AI budget: ${budget.message}`, kind: "ai-budget", status: res.status, resets_at: budget.resetsAt }));
    throw budget;
  }
  // OpenRouter's 404 "No endpoints found that can handle the requested parameters": no provider of that model
  // accepts something in the request. chat() retries without the usual culprit, then explains it plainly.
  if (res.status === 404 && /no endpoints found that can handle/i.test(json?.error?.message ?? "")) {
    throw Object.assign(new Error(`OpenRouter 404: ${json.error.message}`), { noEndpoint: true });
  }
  if (!res.ok || json?.error) throw new Error(`OpenRouter ${res.status}: ${json?.error?.message ?? "request failed"}`);
  return json;
}

/** The plain-English version of OpenRouter's "No endpoints found that can handle the requested parameters". */
function cantDoIt(tier: Tier, model: string, opts: AskOptions & { schema?: JsonSchema }) {
  const what = opts.schema ? "structured JSON (askJson)" : "this request";
  return new Error(`The "${tier}" model (${model}) can't do ${what} with these settings. Try another tier, or another model with MODEL_${tier.toUpperCase()}=… in .env (npm run ai -- models).`);
}

// Deterministic stand-in: same input, same output, no network, no cost.
const simProvider: LlmProvider = {
  name: "sim",
  async chat(tier, messages, opts) {
    const last = messages.at(-1);
    const prompt = typeof last?.content === "string" ? last.content : (last?.content.find((p) => p.type === "text") as { text?: string })?.text ?? "";
    const text = opts.schema
      ? JSON.stringify(sampleFromSchema(opts.schema, prompt))
      : `[Simulated ${tier} reply] ${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}`;
    return { text, model: `sim/${tier}`, ms: 0, cost: 0, simulated: true, ...(opts.web && { sources: [] }) };
  },
  async image(prompt) {
    const label = prompt.replace(/[<&>"]/g, "").slice(0, 40);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#e8e4f0"/><text x="50%" y="46%" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#443">Simulated image</text><text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#776">${label}</text></svg>`;
    return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, model: "sim/image", ms: 0, cost: 0, simulated: true };
  },
};

/** Smallest value that satisfies a JSON schema, seeded from the prompt so it reads plausibly. */
export function sampleFromSchema(schema: JsonSchema, seed = "sample"): unknown {
  const s = schema as { type?: string | string[]; enum?: unknown[]; properties?: Record<string, JsonSchema>; items?: JsonSchema; minItems?: number };
  if (s.enum?.length) return s.enum[0];
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case "object":
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, sampleFromSchema(v, `${k}`)]));
    case "array":
      return Array.from({ length: Math.max(1, s.minItems ?? 2) }, (_, i) => sampleFromSchema(s.items ?? {}, `${seed} ${i + 1}`));
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    default:
      return `Simulated ${seed}`.slice(0, 60);
  }
}

export function provider(): LlmProvider {
  loadEnv();
  if (env("AI_PROVIDER") === "sim" || !env("OPENROUTER_API_KEY")) return simProvider;
  return openRouterProvider;
}

const toMessages = (input: string | Message[], system?: string): Message[] => [
  ...(system ? [{ role: "system" as const, content: system }] : []),
  ...(typeof input === "string" ? [{ role: "user" as const, content: input }] : input),
];

export async function ask(tier: Tier, input: string | Message[], opts: AskOptions = {}): Promise<AskResult> {
  return provider().chat(tier, toMessages(input, opts.system), opts);
}

/** Every string in a JSON value, however deep. */
const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

/**
 * A hollow answer: valid JSON whose text is "..." placeholders. Some providers behind a cheap model do this now and then
 * under a strict schema: the shape is right and nothing is in it. Empty strings don't count (unused fields are often
 * legitimately ""); half or more of the rest being "..." = hollow.
 */
export function hollow(data: unknown): boolean {
  const s = strings(data).filter((x) => x.trim());
  const dots = s.filter((x) => /^\s*(\.{2,}|…)[\s.…]*$/.test(x)).length;
  return dots >= 2 && dots * 2 >= s.length;
}

export async function askJson<T = unknown>(tier: Tier, input: string | Message[], schema: JsonSchema, opts: AskOptions = {}): Promise<AskResult & { data: T }> {
  // The simulator's stand-in answers are minimal on purpose, so only real answers get the hollow and valid checks.
  const parse = (text: string, simulated: boolean) => {
    const data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
    if (simulated) return data;
    if (hollow(data)) throw new Error('hollow (fields were "...")');
    if (opts.valid && !opts.valid(data)) throw new Error("not valid (failed the app's check)");
    return data;
  };
  const result = await provider().chat(tier, toMessages(input, opts.system), { ...opts, schema });
  try {
    return { ...result, data: parse(result.text, result.simulated) };
  } catch (err) {
    // Says which provider misbehaved, so the logs show it when one model keeps failing online.
    const why = err instanceof SyntaxError ? "cut off" : (err as Error).message;
    console.warn(`[ai] ${tier} answer ${why} (${result.model}${result.via ? ` via ${result.via}` : ""}); asked once more.`);
    // Cut off (thinking models spend part of maxTokens on reasoning, so the JSON can stop mid-string) or hollow.
    // Once more with twice the room; then a plain message instead of a JSON parse error or an answer of "...".
    const again = await provider().chat(tier, toMessages(input, opts.system), { ...opts, schema, maxTokens: (opts.maxTokens ?? 2000) * 2 });
    try {
      return { ...again, cost: result.cost + again.cost, data: parse(again.text, again.simulated) };
    } catch {
      throw new Error(`The AI's answer came back empty or cut off twice (${tier} tier). Try again; if it keeps happening, give it a bigger maxTokens or another model for this tier.`);
    }
  }
}

export async function image(prompt: string) {
  return provider().image(prompt);
}

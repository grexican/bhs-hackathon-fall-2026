// The model router: code asks for a KIND of model ("fast", "smart"…), never a model id.
// Swap any tier without touching code: set MODEL_<TIER>=<openrouter model id> in .env,
// e.g. MODEL_FAST=z-ai/glm-5.3-flash. `npm run ai -- models` shows what each tier resolves to.

export type Tier = "lite" | "fast" | "smart" | "thinking" | "vision" | "image" | "auto";

export interface TierConfig {
  model: string;
  /** What this tier is for, in one line. Shown by `npm run ai -- models`. */
  use: string;
  /** Reasoning effort sent to models that think; "none" keeps fast tiers fast. */
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  /** Which OpenRouter host to prefer when a model has several. */
  sort?: "latency" | "throughput" | "price";
}

// Chosen 2026-10 from OpenRouter's live catalog: the cheapest tier that does the job.
// Re-benchmark with `npm run ai -- bench`. Pick the tier by what the model DOES (see ai-kit).
// Moving up (only with an organizer, after the cheap tier visibly failed twice):
//   smart → anthropic/claude-sonnet-5.5   thinking → anthropic/claude-opus-5.5
export const TIERS: Record<Tier, TierConfig> = {
  lite: {
    model: "qwen/qwen3.7-flash", // $0.03 / $0.13 per M tokens in/out
    use: "Bulk and background: tagging, extraction, classification, reformatting",
    reasoning: "minimal",
    sort: "latency",
  },
  fast: {
    model: "openai/gpt-6-luna", // $0.10 / $0.50
    use: "Anything a user waits on: chat replies, rewrites, quick JSON",
    reasoning: "low",
    sort: "latency",
  },
  smart: {
    model: "qwen/qwen3.7-plus", // $0.32 / $1.28
    use: "Quality writing, tool use, tricky structured output",
    reasoning: "low",
  },
  thinking: {
    model: "deepseek/deepseek-v4-pro-0813", // $0.66 / $1.98
    use: "Planning, hard reasoning, judging other models' work",
    reasoning: "high",
  },
  vision: {
    model: "openai/gpt-6-luna", // $0.10 / $0.50; 2026-10-25: 3.6-3.8 s per photo vs 6-23 s for qwen3.8-omni-flash
    use: "Reading images, screenshots, PDFs, video frames",
    reasoning: "low",
    sort: "latency",
  },
  image: {
    model: "google/gemini-3.1-flash-lite-image",
    use: "Generating or editing images",
  },
  auto: {
    model: "typesafe/jev-router",
    use: "Let a router pick the model and effort per request (good default when unsure)",
  },
};

/**
 * Speech to text (transcribe.ts) has its own models: they hear audio and write it down, nothing else.
 * Chosen 2026-10 on Spanish, Catalan and English clips, clean and noisy. Swap with MODEL_TRANSCRIBE / MODEL_TRANSCRIBE_BEST.
 */
export const TRANSCRIBE_MODELS = {
  fast: "mistralai/voxtral-mini-transcribe-3-0", // ~$0.0035 a minute of audio, ~0.5 s for a short clip
  best: "elevenlabs/scribe-v2", // ~$0.0037 a minute, 90+ languages, a touch slower
} as const;

export const transcribeModel = (quality: "fast" | "best" = "fast"): string =>
  (quality === "best" ? env("MODEL_TRANSCRIBE_BEST") : env("MODEL_TRANSCRIBE")) ?? TRANSCRIBE_MODELS[quality];

/** Jev (a decision model, not a chat model) lives in jev.ts; its id is configurable too. */
export const JEV_MODEL = (): string => env("MODEL_DECIDE") ?? "~typesafe/jev-latest";

export function resolveTier(tier: Tier): TierConfig {
  const base = TIERS[tier];
  if (!base) throw new Error(`Unknown model tier "${tier}". Tiers: ${Object.keys(TIERS).join(", ")}`);
  return { ...base, model: env(`MODEL_${tier.toUpperCase()}`) ?? base.model };
}

export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

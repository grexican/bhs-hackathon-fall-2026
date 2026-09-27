// Jev: a DECISION model, not a chat model. State in (text or JSON), calibrated probabilities out.
// ~0.2-0.8s and fractions of a cent per call, many questions answered in parallel in one request.
//
//   const r = await choice({ message }, "Which team should handle this?", { billing: "payments", tech: "bugs", none: "none of these" });
//   if (r && r.confidence > 0.7) route(r.choice); else route(ruleBasedRoute(message));
//
// Every helper returns null on ANY failure (no key, sim mode, timeout, vendor error). Callers must
// always have a rule to fall back on, so the app never blocks on the decision layer.
// Guide: .claude/skills/jev-decisions/SKILL.md
import { loadEnv } from "./env.ts";
import { env, JEV_MODEL } from "./models.ts";

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const TIMEOUT_MS = 4000;

export type Question =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type Answer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "score"; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> };

export interface Decision {
  answers: Record<string, Answer>;
  ms: number;
  cost: number;
}

export function jevEnabled(): boolean {
  loadEnv();
  return env("AI_PROVIDER") !== "sim" && Boolean(env("OPENROUTER_API_KEY"));
}

/** Ask several questions about one state in a single call. They run in parallel and share the state cost. */
export async function decide(state: unknown, questions: Record<string, Question>): Promise<Decision | null> {
  if (!jevEnabled()) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: JEV_MODEL(), state, questions }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { answers?: Record<string, Answer>; usage?: { cost?: number } };
    if (!json.answers) return null;
    return { answers: json.answers, ms: Date.now() - t0, cost: json.usage?.cost ?? 0 };
  } catch {
    return null;
  }
}

/** Is this true? Returns the probability (0-1) that it is. */
export async function noul(state: unknown, instructions: string, criteria: { true: string; false: string }) {
  const d = await decide(state, { q: { type: "noul", instructions, criteria } });
  const a = d?.answers.q;
  return a?.type === "noul" ? { p: a.noul, ms: d!.ms, cost: d!.cost } : null;
}

/** Which one of these? Always include an escape option like `none` so "nothing fits" is sayable. */
export async function choice<K extends string>(state: unknown, instructions: string, criteria: Record<K, string>) {
  const d = await decide(state, { q: { type: "choice", instructions, criteria } });
  const a = d?.answers.q;
  if (a?.type !== "choice" || !(a.choice in criteria)) return null;
  return { choice: a.choice as K, confidence: a.confidence, probabilities: a.probabilities as Record<K, number>, ms: d!.ms, cost: d!.cost };
}

/** Where on this ordered scale (2-10 levels, lowest first)? `score` is fractional: 1.8 means "about level 2". */
export async function score(state: unknown, instructions: string, levels: string[]) {
  const d = await decide(state, { q: { type: "score", instructions, criteria: levels } });
  const a = d?.answers.q;
  return a?.type === "score" ? { score: a.score, level: levels[Math.round(a.score)], confidence: a.confidence, ms: d!.ms, cost: d!.cost } : null;
}

/** Pick zero or more: one yes/no per candidate, in one request. Returns candidates at or above `threshold`. */
export async function pickMany<K extends string>(state: unknown, instructions: string, candidates: Record<K, string>, threshold = 0.6) {
  const questions = Object.fromEntries(
    Object.entries(candidates).map(([key, desc]) => [key, { type: "noul", instructions, criteria: { true: `Yes: ${desc}`, false: `No: not ${desc}` } }]),
  ) as Record<string, Question>;
  const d = await decide(state, questions);
  if (!d) return null;
  const scores = Object.fromEntries(Object.entries(d.answers).map(([k, a]) => [k, a.type === "noul" ? a.noul : 0])) as Record<K, number>;
  return { picked: (Object.keys(scores) as K[]).filter((k) => scores[k] >= threshold), scores, ms: d.ms, cost: d.cost };
}

// The idea lab, in three moves. It is the hackathon's /demo interview, shrunk to fit a phone:
//   1. research  - search the web for what already exists, say it in three short lines
//   2. interview - four questions, one at a time, each one changes what gets built
//   3. build     - write a one-page spec, then an interactive prototype (simulated data, no backend)
import { chat } from "./llm.js";
import { webSearch } from "./search.js";
import { getShowcase, updateShowcase } from "./db.js";

// The interview slots, in order. Each one must change what gets built.
export const SLOTS = [
  { key: "who", brief: "Who uses it, and in what exact moment? (on the bus at 7am, in class, with friends on a Friday night...)" },
  { key: "moment", brief: "The ONE thing it must nail. Everything else gets cut. Offer 3 concrete core features drawn from the idea and the research." },
  { key: "feel", brief: "The feel. Offer exactly 3 named visual directions, each a mood + palette + type personality in one line (e.g. 'Arcade night: neon on black, chunky pixel type'). This decides most of the look." },
  { key: "twist", brief: "The twist: what makes it different from the existing examples found in research? Offer 3 sharp, specific twists." },
];

const SAFETY = `The person is a high school student (14-18). Keep everything school-appropriate.
If the idea involves anything harmful, sexual, hateful, illegal, or targets a real private person, steer it to a safe nearby version and say so briefly.`;

const VOICE = `Talk like a friendly older student who builds apps, not like a teacher. Short sentences. No hype words. Max one emoji, usually zero.`;

export async function runResearch(id) {
  const row = await getShowcase(id);
  const { data: q, usage: u1 } = await chat({
    tier: "fast",
    json: true,
    maxTokens: 300,
    system: `You turn an app idea into web search queries that find existing apps, products or projects close to it. ${SAFETY}
Return JSON: {"queries": ["...", "..."]} with exactly 2 short queries.`,
    user: `Idea: ${row.idea}`,
  });
  const queries = (q.queries ?? [row.idea]).slice(0, 2);
  const results = (await Promise.all(queries.map((query) => webSearch(query, 5)))).flat();
  const unique = [...new Map(results.map((r) => [r.url, r])).values()].slice(0, 8);

  const { data: summary, usage: u2 } = await chat({
    tier: "fast",
    json: true,
    maxTokens: 600,
    system: `You research app ideas for high school students. ${SAFETY} ${VOICE}
From the search results, find 2-3 REAL existing apps/products close to the idea and what the best one does well.
Never invent a product that is not in the results. If results are empty or off-topic, say what kind of thing exists in general terms.
Return JSON: {"lines": ["3 short lines, max 18 words each: what exists, what they do well, the gap this idea could own"], "examples": [{"name": "...", "url": "url from results", "note": "max 10 words"}]}`,
    user: `Idea: ${row.idea}\n\nSearch results:\n${unique.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n") || "(none)"}`,
  });
  const research = {
    queries,
    lines: (summary.lines ?? []).slice(0, 3),
    examples: (summary.examples ?? []).filter((e) => unique.some((r) => r.url === e.url)).slice(0, 3),
  };
  const transcript = [...row.transcript, { role: "assistant", kind: "research", lines: research.lines, examples: research.examples }];
  await updateShowcase(id, { research, transcript, usage: [...row.usage, u1, u2] });
  return nextQuestion(id);
}

/** Generates the question for the current step and appends it to the transcript. */
export async function nextQuestion(id) {
  const row = await getShowcase(id);
  const slot = SLOTS[row.step];
  const { data, usage } = await chat({
    tier: "fast",
    json: true,
    maxTokens: 700,
    system: `You interview a high school student about their app idea, one question at a time, so the prototype is built from THEIR decisions. ${SAFETY} ${VOICE}
Rules for the question:
- It must change what gets built. Build options from this specific idea, the research and their earlier answers.
- Exactly 3 options, each concrete. Short label (max 6 words) and a detail line (max 14 words).
- Mark the one you recommend, and give a one-line "why" this decision matters (max 20 words). That line is the teaching.
Return JSON: {"question": "max 14 words", "why": "...", "options": [{"label": "...", "detail": "..."}], "recommended": 0}`,
    user: `Idea: ${row.idea}
Research: ${(row.research?.lines ?? []).join(" ")}
Answers so far:
${answersSoFar(row) || "(none yet)"}

This question's job: ${slot.brief}`,
  });
  const question = {
    role: "assistant",
    kind: "question",
    slot: slot.key,
    question: String(data.question ?? "").slice(0, 160),
    why: String(data.why ?? "").slice(0, 200),
    options: (data.options ?? []).slice(0, 3).map((o) => ({ label: String(o.label ?? "").slice(0, 60), detail: String(o.detail ?? "").slice(0, 140) })),
    recommended: Math.min(2, Math.max(0, Number(data.recommended) || 0)),
  };
  await updateShowcase(id, { transcript: [...row.transcript, question], usage: [...row.usage, usage] });
  return question;
}

/** Records an answer. Returns the next question, or null when the interview is done. */
export async function answer(id, text) {
  const row = await getShowcase(id);
  const step = row.step + 1;
  await updateShowcase(id, { step, transcript: [...row.transcript, { role: "user", kind: "answer", text }] });
  if (step < SLOTS.length) return nextQuestion(id);
  await startBuild(id);
  return null;
}

/** Re-runs the build for a failed showcase; the interview answers are already saved. */
export async function retryBuild(id) {
  await startBuild(id);
}

async function startBuild(id) {
  await updateShowcase(id, { status: "building", error: null });
  build(id).catch(async (err) => {
    console.error(`[build ${id}]`, err);
    await updateShowcase(id, { status: "failed", error: String(err.message ?? err).slice(0, 500) });
  });
}

function answersSoFar(row) {
  const out = [];
  let q;
  for (const t of row.transcript) {
    if (t.kind === "question") q = t.question;
    if (t.kind === "answer") out.push(`Q: ${q}\nA: ${t.text}`);
  }
  return out.join("\n");
}

export async function build(id, { buildModel } = {}) {
  const row = await getShowcase(id);
  const answers = answersSoFar(row);

  const { data: spec, usage: u1 } = await chat({
    tier: "fast",
    json: true,
    maxTokens: 1200,
    system: `You write a one-page product spec for a high school student's app idea, from their own interview answers. ${SAFETY} ${VOICE}
Return JSON:
{"name": "a catchy 1-2 word app name",
 "tagline": "max 9 words",
 "for": "who + the moment, one sentence",
 "core": "the one thing it nails, one sentence",
 "twist": "what makes it different, one sentence",
 "features": ["3 features, max 8 words each"],
 "screens": ["2-3 screens the prototype shows, max 8 words each"],
 "look": "the visual direction they chose, with 3 hex colors and a Google Font name",
 "ai": "one sentence: how a small cheap AI model could power one part of it, or 'none needed'",
 "weekend": ["4 steps to build it for real at the hackathon, max 10 words each"]}`,
    user: `Idea: ${row.idea}\nBuilder's first name: ${row.first_name || "unknown"}\nResearch: ${(row.research?.lines ?? []).join(" ")}\n\nInterview:\n${answers}`,
  });

  await updateShowcase(id, { spec, usage: [...row.usage, u1] });

  const { text, usage: u2 } = await chat({
    tier: "build",
    model: buildModel,
    maxTokens: 16000,
    temperature: 0.6,
    timeoutMs: 240_000,
    system: `You are a senior product designer who codes. You build a clickable PROTOTYPE of a student's app idea as ONE self-contained HTML file.
${SAFETY}
Hard rules:
- Output ONLY the HTML document, starting with <!doctype html>. No explanations, no markdown fences.
- Everything inline: one <style>, one <script>. Allowed external resources: Google Fonts only. No images from the web; use inline SVG, CSS shapes or emoji.
- Mobile-first, a phone-sized app (max-width 420px, centered, fills the frame height). Must also look right at 1000px wide.
- It must WORK when clicked: real navigation between 2-3 screens, buttons that change state, lists you can add to or tick off. Use in-memory JS state.
- Fill every screen with believable seed data that fits the idea and the audience. An empty screen is a bug.
- Anything that would need a server, an account, payments, messaging or AI is SIMULATED in the page (canned but plausible responses, a short fake delay) and carries a small visible "Simulated" tag. Never pretend it is real.
- Commit to the chosen visual direction: its palette, its font, its mood. Strong type hierarchy, generous spacing, one memorable detail. Do not use the generic purple-gradient SaaS look.
- No alert(), confirm(), prompt(), no localStorage, no network calls.
- Keep it under 600 lines.`,
    user: `Build the prototype for this spec:\n${JSON.stringify(spec, null, 2)}\n\nThe student's own words: "${row.idea}"\n\nInterview:\n${answers}`,
  });

  const html = extractHtml(text);
  if (!html) throw new Error("The build model did not return an HTML document");
  const fresh = await getShowcase(id);
  await updateShowcase(id, { html, status: "ready", usage: [...fresh.usage, u2] });
}

function extractHtml(text) {
  const start = text.search(/<!doctype html|<html/i);
  if (start < 0) return null;
  const end = text.toLowerCase().lastIndexOf("</html>");
  return end > start ? text.slice(start, end + 7) : text.slice(start);
}

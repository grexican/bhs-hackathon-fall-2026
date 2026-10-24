// The AI kit turns "this app's AI money ran out" into one friendly, catchable AiBudgetError
// (payloads below are OpenRouter's real answers for a key over its monthly limit), never a crash text.
import assert from "node:assert/strict";
import { test } from "node:test";
import { AiBudgetError, ask, askJson, budgetError, image } from "../kit/ai/index.ts";
import { hollow } from "../kit/ai/llm.ts";

const KEY_LIMIT = {
  error: {
    message: "Key limit exceeded (monthly limit). Manage it using https://openrouter.ai/workspaces/x/keys/abc $5.00 of $5.00 used; resets 2026-11-01T00:00:00.000Z.",
    code: 403,
    metadata: { limit_source: "openrouter_key_limit" },
  },
};

test("a key over its monthly limit (403) becomes AiBudgetError with the reset date", () => {
  const err = budgetError(403, KEY_LIMIT);
  assert.ok(err instanceof AiBudgetError);
  assert.equal(err.code, "AI_BUDGET_USED_UP");
  assert.match(err.message, /AI budget for the month is used up\. Ask an organizer/);
  assert.equal(err.resetsAt, "2026-11-01T00:00:00.000Z");
});

test("402 is a budget problem too; other errors are not", () => {
  assert.match(budgetError(402, { error: { message: "This request requires more credits, or fewer max_tokens. You requested up to 2000 tokens, but can only afford 120." } }).message, /almost used up/);
  assert.match(budgetError(402, { error: { message: "Insufficient credits" } }).message, /incubator's AI credit/);
  assert.equal(budgetError(403, { error: { message: "Forbidden: moderation" } }), null);
  assert.equal(budgetError(429, { error: { message: "Rate limited" } }), null);
  assert.equal(budgetError(500, null), null);
});

test("ask() and image() throw it (and log one error line) when OpenRouter says the limit is reached", async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const logged = [];
  process.env.OPENROUTER_API_KEY = "sk-or-test-not-real";
  delete process.env.AI_PROVIDER;
  globalThis.fetch = async () => new Response(JSON.stringify(KEY_LIMIT), { status: 403, headers: { "Content-Type": "application/json" } });
  console.error = (line) => logged.push(line);
  try {
    await assert.rejects(ask("fast", "hi"), (err) => err instanceof AiBudgetError && err.status === 403);
    await assert.rejects(image("a dot"), AiBudgetError);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert.equal(logged.length, 2);
  const line = JSON.parse(logged[0]);
  assert.equal(line.level, "error");
  assert.equal(line.kind, "ai-budget");
  assert.doesNotMatch(logged.join("\n"), /sk-or-test-not-real/);
});

// OpenRouter's answer when no provider of the model accepts a parameter (gpt-6-luna + temperature + JSON schema).
const NO_ENDPOINT = { error: { message: "No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection", code: 404 } };

test("askJson with a temperature the model refuses: retried once without it, and it works", async () => {
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  const bodies = [];
  process.env.OPENROUTER_API_KEY = "sk-or-test-not-real";
  delete process.env.AI_PROVIDER;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return "temperature" in body
      ? new Response(JSON.stringify(NO_ENDPOINT), { status: 404 })
      : new Response(JSON.stringify({ model: "m", choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  };
  console.warn = () => {};
  try {
    const { data } = await askJson("fast", "hi", { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }, { temperature: 0.4 });
    assert.deepEqual(data, { ok: true });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].temperature, 0.4);
  assert.equal("temperature" in bodies[1], false);
});

test("no endpoint even without the extras: a plain message that names the tier and the fix", async () => {
  const realFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "sk-or-test-not-real";
  delete process.env.AI_PROVIDER;
  globalThis.fetch = async () => new Response(JSON.stringify(NO_ENDPOINT), { status: 404 });
  try {
    await assert.rejects(askJson("fast", "hi", { type: "object" }), (err) => /"fast" model .* can't do structured JSON/.test(err.message) && /MODEL_FAST=/.test(err.message) && !/provider routing/.test(err.message));
    await assert.rejects(ask("lite", "hi"), /"lite" model .* can't do this request/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("askJson with a hollow answer (every field \"...\"): asked once more, and the real answer is used", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  process.env.OPENROUTER_API_KEY = "sk-or-test-not-real";
  delete process.env.AI_PROVIDER;
  const answers = ['{"note":"...","items":["...","..."]}', '{"note":"A real note","items":["one",""]}'];
  globalThis.fetch = async () => new Response(JSON.stringify({ model: "m", choices: [{ message: { content: answers[calls++] } }] }), { status: 200 });
  try {
    const schema = { type: "object", properties: { note: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["note", "items"], additionalProperties: false };
    const { data } = await askJson("fast", "hi", schema);
    assert.equal(data.note, "A real note");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(hollow({ op: "delete_slide", title: "", text: "", note: "Removed slide 3." }), false, "unused empty fields are not hollow");
  assert.equal(hollow({ title: "Wait...", note: "Hmm... ok" }), false, "an ellipsis inside real text is fine");
});

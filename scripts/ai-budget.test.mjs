// The AI kit turns "this app's AI money ran out" into one friendly, catchable AiBudgetError
// (payloads below are OpenRouter's real answers for a key over its monthly limit), never a crash text.
import assert from "node:assert/strict";
import { test } from "node:test";
import { AiBudgetError, ask, budgetError, image } from "../kit/ai/index.ts";

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

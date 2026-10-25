// Tests the speech kit's testable-without-a-browser parts: voice commands (kit/speech/commands.js), the AI kit's
// transcribe() (format check, simulator, budget errors, the request it sends) and the server route
// (kit/speech/transcribe-route.mjs). The browser engines are checked in a real browser (see kit/speech/README.md).
import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, test } from "node:test";
import { audioFormat, transcribe } from "../kit/ai/transcribe.ts";
import { commandPhrases, matchCommand, normalize, voskGrammar } from "../kit/speech/commands.js";
import { transcribeRoute } from "../kit/speech/transcribe-route.mjs";

const realFetch = globalThis.fetch;
const saved = { key: process.env.OPENROUTER_API_KEY, provider: process.env.AI_PROVIDER };
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [name, value] of [["OPENROUTER_API_KEY", saved.key], ["AI_PROVIDER", saved.provider]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

// The first bytes of each kind of recording (what a browser really sends).
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypM4A "), Buffer.alloc(2000, 1)]);

test("commands: exact, inside a sentence, accents, synonyms, near misses, nothing", () => {
  assert.equal(normalize("¡Sálta YA!"), "salta ya");
  assert.equal(matchCommand("salta", ["salta", "dispara"]).command, "salta");
  assert.equal(matchCommand("vale, ¡dispara ya!", ["salta", "dispara"]).command, "dispara");
  assert.equal(matchCommand("jump left fire twice", ["fire", "twice", "jump"]).command, "jump", "the first one said wins");
  assert.equal(matchCommand("now go left", ["go", "go left"]).command, "go left", "the longer phrase at the same place wins");
  const moves = { left: ["go left", "izquierda", "esquerra"], right: ["go right", "derecha", "dreta"] };
  assert.equal(matchCommand("Izquierda", moves).command, "left");
  assert.equal(matchCommand("dreta", moves).command, "right");
  assert.equal(matchCommand("left", moves).command, "left", "the key itself counts as a way to say it");
  assert.equal(matchCommand("jum", ["jump", "pause"]).command, "jump", "one letter off");
  assert.equal(matchCommand("no", ["go", "pause"]), null, "short commands must be exact");
  assert.equal(matchCommand("jumpp", ["jump", "pause"]).command, "jump");
  assert.equal(matchCommand("what's for lunch", ["jump", "pause"]), null);
  assert.equal(matchCommand("", ["jump"]), null);
  assert.deepEqual(commandPhrases(["go", "go left", "Go"]).map(([p]) => p), ["go left", "go"], "longest first, no duplicates");
  assert.deepEqual(voskGrammar({ left: "Go Left", right: ["dreta"] }), ["go left", "right", "dreta", "left", "[unk]"]);
});

test("audioFormat: knows browser recordings by their bytes, refuses what isn't audio", () => {
  assert.equal(audioFormat(WEBM), "webm");
  assert.equal(audioFormat(MP4), "m4a");
  assert.equal(audioFormat(Buffer.from("OggS....")), "ogg");
  assert.equal(audioFormat(Buffer.from("RIFF....WAVEfmt ")), "wav");
  assert.equal(audioFormat(Buffer.from("ID3....")), "mp3");
  assert.equal(audioFormat(Buffer.from("<html><script>")), null);
  assert.equal(audioFormat(Buffer.from("??????"), "audio/webm;codecs=opus"), "webm", "a clear audio type is the last resort");
});

test("transcribe: simulator (AI_PROVIDER=sim, or no key), labelled, free", async () => {
  process.env.AI_PROVIDER = "sim";
  const r = await transcribe(WEBM, { language: "ca-ES" });
  assert.equal(r.simulated, true);
  assert.match(r.text, /Simulated transcript.*webm.*"ca"/);
  await assert.rejects(transcribe(Buffer.from("not audio at all")), (err) => err.status === 415);
});

test("transcribe: sends base64 audio + format + 2-letter language to OpenRouter's speech-to-text", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  delete process.env.AI_PROVIDER;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body), auth: init.headers.Authorization };
    return new Response(JSON.stringify({ text: " Hola, me llamo Marta. ", usage: { seconds: 4.4, cost: 0.00023 } }), { status: 200 });
  };
  const r = await transcribe(MP4, { language: "es-ES" });
  assert.equal(sent.url, "https://openrouter.ai/api/v1/audio/transcriptions");
  assert.equal(sent.auth, "Bearer test-key");
  assert.equal(sent.body.input_audio.format, "m4a");
  assert.equal(Buffer.from(sent.body.input_audio.data, "base64").equals(MP4), true);
  assert.equal(sent.body.language, "es");
  assert.equal(sent.body.model, "mistralai/voxtral-mini-transcribe-3-0");
  assert.deepEqual({ text: r.text, cost: r.cost, seconds: r.seconds, simulated: r.simulated }, { text: "Hola, me llamo Marta.", cost: 0.00023, seconds: 4.4, simulated: false });
  await transcribe(WEBM, { quality: "best" });
  assert.equal(sent.body.model, "elevenlabs/scribe-v2");
  assert.equal(sent.body.language, undefined, "no language: the model works it out");
});

test("transcribe: an empty AI budget is an AiBudgetError, like every kit/ai call", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Key limit exceeded (monthly limit). Resets 2026-11-01T00:00:00.000Z.", metadata: { limit_source: "openrouter_key_limit" } } }), { status: 403 });
  const quiet = console.error;
  console.error = () => {};
  try {
    await assert.rejects(transcribe(WEBM), (err) => err.code === "AI_BUDGET_USED_UP" && /used up/.test(err.message));
  } finally {
    console.error = quiet;
  }
});

// A tiny server with only the transcribe route, like the line added to an app's server.js.
async function withServer(options, fn) {
  const server = http.createServer(async (req, res) => {
    if (await transcribeRoute(req, res, options)) return;
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test("route: passes the recording and language on; too big, too short and too many are refused kindly", async () => {
  const calls = [];
  const fake = async (audio, opts) => (calls.push({ bytes: audio.length, ...opts }), { text: "salta", simulated: false });
  await withServer({ transcribe: fake, maxBytes: 5000, perMinute: 3 }, async (base) => {
    const post = (body, query = "?language=es-ES") => fetch(`${base}/api/transcribe${query}`, { method: "POST", headers: { "Content-Type": "audio/webm" }, body });
    const ok = await post(WEBM);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { text: "salta", simulated: false });
    assert.deepEqual(calls[0], { bytes: WEBM.length, language: "es-ES", quality: "fast", mimeType: "audio/webm" });
    assert.equal((await post(Buffer.alloc(9000, 1))).status, 413);
    const short = await post(Buffer.alloc(10, 1));
    assert.equal(short.status, 400);
    assert.match((await short.json()).error, /Hold the button/);
    const many = await post(WEBM);
    assert.equal(many.status, 429);
    assert.equal((await fetch(`${base}/api/other`)).status, 404, "other routes pass through");
  });
});

test("route: simulated transcripts say so; an empty budget is a 503 with the kit's message", async () => {
  await withServer({ transcribe: async () => ({ text: "[Simulated transcript]", simulated: true }) }, async (base) => {
    const json = await (await fetch(`${base}/api/transcribe`, { method: "POST", body: WEBM })).json();
    assert.equal(json.simulated, true);
    assert.match(json.note, /\/connect/);
  });
  const broke = async () => {
    throw Object.assign(new Error("This app's AI budget for the month is used up. Ask an organizer to raise it."), { code: "AI_BUDGET_USED_UP" });
  };
  await withServer({ transcribe: broke }, async (base) => {
    const res = await fetch(`${base}/api/transcribe`, { method: "POST", body: WEBM });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "AI_BUDGET_USED_UP");
  });
});

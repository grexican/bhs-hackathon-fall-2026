// Tests scripts/pitch.mjs: pitch.json checks, safe text, and the rendered deck.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSpec, inkFor, renderDeck, rich } from "./pitch.mjs";

const spec = {
  shots: [{ id: "home", goal: "the first screen" }],
  slides: [
    { kind: "title", title: "Snack**Map**", say: "Hi." },
    { kind: "shot", title: "One tap", shots: ["home"], say: "Look." },
    { kind: "demo", title: "Live", steps: ["Open it"], backup: ["home"], say: "Watch." },
    { kind: "ask", title: "Try it", ask: "Scan it.", say: "Bye." },
  ],
};
const ctx = { manifest: {}, url: "https://snackmap.apps.bhslabs.org", name: "SnackMap", goals: {}, theme: "", logo: "", qr: "", p: { shots: "" } };

test("a good pitch.json passes; a shot not taken yet is only a warning", () => {
  const r = checkSpec(spec, {});
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /not taken yet/.test(w)));
  assert.deepEqual(checkSpec(spec, { home: { file: "home.jpg" } }).warnings, []);
});

test("unknown kinds, missing fields and unknown shots are errors", () => {
  const r = checkSpec({ shots: [], slides: [{ kind: "poster" }, { kind: "quote", quote: "Nice" }, { kind: "shot", title: "x", shots: ["nope"] }] });
  assert.ok(r.errors.some((e) => /unknown kind/.test(e)));
  assert.ok(r.errors.some((e) => /needs `who`/.test(e)), "a quote needs who said it");
  assert.ok(r.errors.some((e) => /"nope" is not in `shots`/.test(e)));
});

test("numbers need a source, and the deck warns without a demo or an ask", () => {
  const r = checkSpec({ slides: [{ kind: "numbers", items: [{ value: "9", label: "users" }], say: "x" }] });
  assert.ok(r.errors.some((e) => /needs `source`/.test(e)));
  assert.ok(r.warnings.some((w) => /No `demo`/.test(w)));
  assert.ok(r.warnings.some((w) => /No `ask`/.test(w)));
});

test("text is escaped; **word** is the only markup", () => {
  assert.equal(rich('<img src=x onerror="1"> **hi**'), "&lt;img src=x onerror=&quot;1&quot;&gt; <mark>hi</mark>");
});

test("accent ink: dark text on light accents, white on dark ones", () => {
  assert.equal(inkFor("#ffcf3f"), "#15130b");
  assert.equal(inkFor("#1c2b7a"), "#ffffff");
  assert.equal(inkFor("tomato"), null);
});

test("the deck has every slide, the notes, the demo button and the runtime", () => {
  const html = renderDeck(spec, ctx);
  assert.equal(html.match(/<section class="slide/g).length, 4);
  assert.match(html, /Snack<mark>Map<\/mark>/);
  assert.match(html, /<div class="notes">Watch\.<\/div>/);
  assert.match(html, /data-open-app/);
  assert.match(html, /data-app-url="https:\/\/snackmap\.apps\.bhslabs\.org"/);
  assert.match(html, /snackmap\.apps\.bhslabs\.org<\/div>/, "the ask shows the link");
  assert.match(html, /missing: home/, "a shot not taken yet shows a placeholder, not a broken image");
  assert.match(html, /function fit\(\)/);
  assert.doesNotMatch(html, /<script src=|<link rel="stylesheet"/, "one self-contained file");
});

// Tests scripts/critique.mjs (the text verdict that makes "done" include the look) and scripts/theme.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { buildMessages, findApp, formatResult, PASS, SCHEMA } from "./critique.mjs";
import { listThemes, readTheme } from "./theme.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "critique-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sample = {
  score: 6,
  verdict: "Works, but reads as a template.",
  looksDefault: true,
  strength: "The yellow accent.",
  fixes: [
    { problem: "Heading too small", fix: "h1 font-size: var(--step-4)", where: "phone: title" },
    { problem: "Gray buttons", fix: "bg-primary", where: "desktop: actions" },
    { problem: "Empty list", fix: "add an empty state with a button", where: "phone: list" },
  ],
};

test("the app is found from the URL's port, or by name", () => {
  fs.mkdirSync(path.join(tmp, "apps", "lunch-line"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "apps", "lunch-line", ".env"), "PORT=4817\n");
  assert.equal(findApp("http://localhost:4817/scores", undefined, tmp), "lunch-line");
  assert.equal(findApp("http://localhost:5999", undefined, tmp), null);
  assert.equal(findApp("https://x.example.org", "lunch-line", tmp), "lunch-line");
  assert.equal(findApp("https://x.example.org", "nope", tmp), null);
});

test("the verdict is plain text: score, three numbered fixes, and what done needs", () => {
  const shots = [{ label: "phone", file: path.join(tmp, "a.jpg") }];
  const below = formatResult(sample, { model: "m", cost: 0.001, shots, problems: [] });
  assert.match(below, /^Looks: 6\/10/);
  assert.match(below, /1\. Heading too small\n {5}Fix: h1 font-size/);
  assert.match(below, /3\. Empty list/);
  assert.match(below, new RegExp(`NOT YET \\(below ${PASS}\\)`));
  assert.match(formatResult({ ...sample, score: 7 }, { model: "m", shots, problems: [] }), /PASS/);
  assert.match(formatResult(sample, { model: "m", shots, problems: [], accepted: "demo in 5 min" }), /ACCEPTED below 7: "demo in 5 min"/);
  assert.match(formatResult(sample, { model: "m", shots, problems: ["[phone] console: boom"] }), /Console problems[\s\S]*boom/);
});

test("the request: the rubric, the design notes, and one image per screenshot", () => {
  const file = path.join(tmp, "shot.jpg");
  fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff]));
  const [system, user] = buildMessages([{ label: "desktop", file }, { label: "phone", file }], { design: "Direction: field notebook", note: "a quiz" });
  assert.equal(system.role, "system");
  assert.match(system.content, /7 designed/);
  assert.match(user.content[0].text, /field notebook/);
  assert.equal(user.content.filter((p) => p.type === "image_url").length, 2);
  assert.match(user.content[1].image_url.url, /^data:image\/jpeg;base64,/);
  assert.deepEqual([...SCHEMA.required].sort(), ["fixes", "looksDefault", "score", "strength", "verdict"]);
});

test("theme presets: six, each with a mood, light or dark, fonts and the full token set", () => {
  const themes = listThemes();
  assert.ok(themes.length >= 6);
  for (const t of themes) {
    assert.ok(t.mood && t.fonts && t.fontsHref.startsWith("https://fonts.googleapis.com/"), t.name);
    for (const token of ["--background", "--foreground", "--primary", "--primary-foreground", "--muted-foreground", "--border", "--radius", "--theme-font-display", "--theme-font-body", "--step-4", "--space-8"]) {
      assert.match(t.css, new RegExp(`${token}:`), `${t.name} has ${token}`);
    }
  }
  assert.throws(() => readTheme("nope"), /No theme called/);
});

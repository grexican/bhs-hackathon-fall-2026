// Runs the whole flow once with auto-picked answers, then builds the prototype with each candidate
// model so they can be compared side by side in tmp/bench/. Usage:
//   npm run bench -- "an app that ..." qwen/qwen3.7-plus z-ai/glm-5.3 ...
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { initDb, createShowcase, getShowcase, updateShowcase } from "../lib/db.js";
import { runResearch, answer, build, SLOTS } from "../lib/flow.js";

const [idea = "an app that helps me and my friends split the cost of food when we go out", ...models] = process.argv.slice(2);
await initDb();
const id = randomUUID();
await createShowcase({ id, idea, first_name: "Bench" });
let t = Date.now();
let q = await runResearch(id);
console.log(`research + q1: ${Date.now() - t}ms`);
for (let i = 0; i < SLOTS.length - 1; i++) {
  console.log(`Q${i + 1}: ${q.question}\n   -> ${q.options[q.recommended].label}`);
  t = Date.now();
  q = await answer(id, q.options[q.recommended].label);
  console.log(`   next question: ${Date.now() - t}ms`);
}
// Record the last answer without kicking off the default build.
const row = await getShowcase(id);
await updateShowcase(id, { step: SLOTS.length, transcript: [...row.transcript, { role: "user", kind: "answer", text: q.options[q.recommended].label }] });
console.log(JSON.stringify((await getShowcase(id)).research, null, 1));

mkdirSync("tmp/bench", { recursive: true });
await Promise.all(
  (models.length ? models : [undefined]).map(async (model) => {
    const copy = randomUUID();
    const base = await getShowcase(id);
    await createShowcase({ ...base, id: copy });
    const started = Date.now();
    try {
      await build(copy, { buildModel: model });
      const done = await getShowcase(copy);
      const name = (model ?? "default").replace(/\//g, "_");
      writeFileSync(`tmp/bench/${name}.html`, done.html);
      const u = done.usage.at(-1);
      console.log(`${model}: ${Date.now() - started}ms, ${u.out} tokens out, $${u.cost}, ${done.html.length} chars`);
    } catch (err) {
      console.log(`${model}: FAILED ${err.message}`);
    }
  }),
);
writeFileSync("tmp/bench/spec.json", JSON.stringify((await getShowcase(id)).spec ?? {}, null, 2));
process.exit(0);

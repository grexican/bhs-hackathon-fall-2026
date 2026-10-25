// Try the AI kit from a terminal.
//   npm run ai -- models                       what every tier resolves to
//   npm run ai -- ask fast "name 3 study apps"  one call, with time and cost
//   npm run ai -- bench [tier…]                 same prompt through each tier, side by side
//   npm run ai -- decide "i was charged twice"  a Jev demo: yes/no + pick-one + scale in one call
//   npm run ai -- image "a neon skateboard" [out.png]
//   npm run ai -- transcribe clip.webm [es|ca|en] [best]   speech to text, with time and cost
import fs from "node:fs";
import path from "node:path";
import { choice, decide, jevEnabled } from "./jev.ts";
import { ask, image, provider } from "./llm.ts";
import { JEV_MODEL, resolveTier, TIERS, transcribeModel, type Tier } from "./models.ts";
import { transcribe } from "./transcribe.ts";

const [cmd = "models", ...rest] = process.argv.slice(2);
const money = (n: number) => `$${n.toFixed(6)}`;

async function main() {
  const p = provider();
  if (p.name === "sim") console.log("(simulator: no OPENROUTER_API_KEY, or AI_PROVIDER=sim)\n");

  if (cmd === "models") {
    for (const tier of Object.keys(TIERS) as Tier[]) {
      const cfg = resolveTier(tier);
      console.log(`${tier.padEnd(9)} ${cfg.model.padEnd(34)} ${cfg.use}`);
    }
    console.log(`${"decide".padEnd(9)} ${JEV_MODEL().padEnd(34)} Fast decisions: yes/no, pick-one, scales (see jev.ts)`);
    console.log(`${"hear".padEnd(9)} ${transcribeModel("fast").padEnd(34)} Speech to text (transcribe.ts); quality "best": ${transcribeModel("best")}`);
    return;
  }

  if (cmd === "ask") {
    const [tier, ...words] = rest;
    const r = await ask(tier as Tier, words.join(" "));
    console.log(r.text, `\n\n— ${r.model}, ${r.ms}ms, ${money(r.cost)}`);
    return;
  }

  if (cmd === "bench") {
    const tiers = (rest.length ? rest : ["lite", "fast", "smart", "vision", "auto"]) as Tier[];
    const prompt = "Write a 3-line haiku about a skateboard. Output only the haiku.";
    const results = await Promise.all(
      tiers.map((t) =>
        ask(t, prompt, { maxTokens: 400 })
          .then((r) => ({ t, r }))
          .catch((e: Error) => ({ t, e })),
      ),
    );
    for (const x of results) {
      if ("e" in x) console.log(`${x.t.padEnd(9)} ERROR ${x.e.message.slice(0, 100)}`);
      else console.log(`${x.t.padEnd(9)} ${String(x.r.ms).padStart(6)}ms  ${money(x.r.cost)}  ${x.r.model.padEnd(34)} ${x.r.text.replace(/\s*\n\s*/g, " / ").slice(0, 70)}`);
    }
    return;
  }

  if (cmd === "decide") {
    const message = rest.join(" ") || "yo my wifi keeps dying during my ranked game its so annoying";
    if (!jevEnabled()) return console.log("Jev needs OPENROUTER_API_KEY. Without it every decision returns null and your rule runs instead.");
    const d = await decide(
      { message },
      {
        urgent: { type: "noul", instructions: "Does this person need help right now?", criteria: { true: "needs help now", false: "can wait" } },
        team: { type: "choice", instructions: "Which team should handle it?", criteria: { network: "internet or wifi", billing: "payments or charges", account: "login or account", none: "none of these" } },
        mood: { type: "score", instructions: "How frustrated are they?", criteria: ["calm", "mildly annoyed", "frustrated", "furious"] },
      },
    );
    console.log(JSON.stringify(d?.answers, null, 2), `\n— ${d?.ms}ms, ${money(d?.cost ?? 0)}`);
    const one = await choice({ message }, "Reply tone?", { friendly: "warm and casual", formal: "polite and formal", none: "no reply needed" });
    console.log(`single choice helper: ${one?.choice} (${one?.confidence})`);
    return;
  }

  if (cmd === "image") {
    const [prompt, out = "tmp/image.png"] = rest;
    const r = await image(prompt);
    const [, b64] = r.dataUrl.split(",");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const file = r.simulated ? out.replace(/\.\w+$/, ".svg") : out;
    fs.writeFileSync(file, Buffer.from(b64, "base64"));
    console.log(`saved ${file} — ${r.model}, ${r.ms}ms, ${money(r.cost)}`);
    return;
  }

  if (cmd === "transcribe") {
    const [file, language, quality] = rest;
    if (!file) return console.log("Usage: npm run ai -- transcribe <audio file> [es|ca|en] [best]");
    const r = await transcribe(fs.readFileSync(file), { language, quality: quality === "best" ? "best" : "fast" });
    console.log(r.text, `

— ${r.model}, ${r.seconds}s of audio, ${r.ms}ms, ${money(r.cost)}`);
    return;
  }

  console.log("Usage: npm run ai -- <models|ask|bench|decide|image|transcribe> …");
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});

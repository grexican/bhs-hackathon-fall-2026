// Offline simulator for the AI calls. Turned on with AI_SIM=1 so the whole flow can be clicked
// through without network or credits. It reads the system prompt to tell which step is asking and
// returns canned but plausible output in the same shape the real model would.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (a, b) => a + Math.floor(Math.random() * (b - a));

const QUESTIONS = {
  who: {
    question: "Who opens this first, and when?",
    why: "Knowing the exact moment decides which screen shows up first.",
    options: [
      { label: "Me, on the bus at 7am", detail: "Quick check before school, one hand, thirty seconds max." },
      { label: "My friend group, Friday night", detail: "Several people on their phones at once, deciding together." },
      { label: "A whole class, in the room", detail: "Teacher shows it, everyone joins from their own phone." },
    ],
    recommended: 0,
  },
  moment: {
    question: "What is the one thing it must nail?",
    why: "A prototype that does one thing well beats one that does five things badly.",
    options: [
      { label: "Add something in two taps", detail: "Capture fast, sort it out later." },
      { label: "See today at a glance", detail: "One screen that tells you what matters right now." },
      { label: "Share it with friends", detail: "Send a link, they see it instantly, no account." },
    ],
    recommended: 1,
  },
  feel: {
    question: "Which feel fits it best?",
    why: "The look decides whether people trust it in the first three seconds.",
    options: [
      { label: "Arcade night", detail: "Neon on black, chunky pixel type, little sound-effect energy." },
      { label: "Clean notebook", detail: "White paper, one blue ink color, calm rounded type." },
      { label: "Summer festival", detail: "Sunny yellow and coral, bold rounded type, playful stickers." },
    ],
    recommended: 2,
  },
  twist: {
    question: "What makes yours different from what exists?",
    why: "Your twist is what people will remember and tell their friends about.",
    options: [
      { label: "Streaks with your friends", detail: "Your group keeps a shared streak alive together." },
      { label: "Works with zero typing", detail: "Everything is taps and swipes, nothing to write." },
      { label: "A weekly surprise recap", detail: "Every Sunday it shows you something you didn't notice." },
    ],
    recommended: 0,
  },
};

function nameFrom(idea) {
  const words = idea.toLowerCase().match(/[a-z]{4,}/g) ?? ["idea"];
  const skip = new Set(["that", "with", "when", "where", "which", "helps", "help", "about", "their", "your", "friends", "make", "makes", "from", "into", "what", "like"]);
  const w = words.find((x) => !skip.has(x) && x !== "app") ?? "idea";
  return w[0].toUpperCase() + w.slice(1, 7) + "ly";
}

function pickJson(user, label) {
  const at = user.indexOf(label);
  if (at < 0) return {};
  const start = user.indexOf("{", at);
  let depth = 0;
  for (let i = start; i < user.length; i++) {
    if (user[i] === "{") depth++;
    if (user[i] === "}" && --depth === 0) {
      try {
        return JSON.parse(user.slice(start, i + 1));
      } catch {
        return {};
      }
    }
  }
  return {};
}

function prototype(spec) {
  const colors = (spec.look ?? "").match(/#[0-9a-f]{6}/gi) ?? [];
  const [bg = "#FFF4D6", accent = "#FF5A5F", ink = "#2B1B3D"] = colors;
  const name = String(spec.name ?? "Idea").replace(/[<>&"]/g, "");
  const tag = String(spec.tagline ?? "").replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:${bg};color:${ink};min-height:100vh}
.app{max-width:420px;margin:auto;min-height:100vh;display:flex;flex-direction:column}
header{padding:20px 20px 8px}h1{margin:0;font-size:30px}p.tag{margin:4px 0 0;opacity:.7}
main{flex:1;padding:12px 20px}.item{display:flex;gap:12px;align-items:center;background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;box-shadow:0 2px 0 ${ink}22}
.item input{width:22px;height:22px;accent-color:${accent}}.item.done span{text-decoration:line-through;opacity:.5}
form{display:flex;gap:8px;margin-top:12px}form input{flex:1;padding:12px;border-radius:12px;border:2px solid ${ink}33;font:inherit}
button{font:inherit;border:0;border-radius:12px;padding:12px 16px;background:${accent};color:#fff;font-weight:700;cursor:pointer}
nav{display:flex;border-top:2px solid ${ink}22;background:#fff}nav button{flex:1;background:none;color:${ink};border-radius:0;padding:16px}nav button.on{color:${accent}}
.sim{display:inline-block;font-size:11px;background:${ink};color:#fff;border-radius:6px;padding:2px 6px;margin-left:6px}
.big{font-size:56px;font-weight:800;color:${accent};margin:8px 0}.screen{display:none}.screen.on{display:block}
</style></head><body><div class="app">
<header><h1>${name}</h1><p class="tag">${tag}</p></header>
<main>
<section class="screen on" id="today"><div id="list"></div>
<form id="add"><input id="txt" placeholder="Add something" aria-label="New item"><button>Add</button></form></section>
<section class="screen" id="stats"><p>Done this week</p><div class="big" id="count">0</div>
<p>Friends streak: <b id="streak">4 days</b><span class="sim">Simulated</span></p>
<button id="nudge">Nudge a friend</button><p id="nudged"></p></section>
</main>
<nav><button class="on" data-s="today">Today</button><button data-s="stats">Progress</button></nav>
</div>
<script>
const items=[{t:"Finish bio worksheet",d:false},{t:"Text Marta about Saturday",d:true},{t:"30 min guitar",d:false},{t:"Return library book",d:false}];
const list=document.getElementById("list");
function draw(){list.innerHTML="";items.forEach((it,i)=>{const r=document.createElement("label");r.className="item"+(it.d?" done":"");
const c=document.createElement("input");c.type="checkbox";c.checked=it.d;c.onchange=()=>{it.d=c.checked;draw()};
const s=document.createElement("span");s.textContent=it.t;r.append(c,s);list.append(r)});
document.getElementById("count").textContent=items.filter(i=>i.d).length}
document.getElementById("add").onsubmit=e=>{e.preventDefault();const v=document.getElementById("txt").value.trim();if(v){items.unshift({t:v,d:false});document.getElementById("txt").value="";draw()}};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button,.screen").forEach(x=>x.classList.remove("on"));b.classList.add("on");document.getElementById(b.dataset.s).classList.add("on")});
document.getElementById("nudge").onclick=()=>{const p=document.getElementById("nudged");p.textContent="Sending...";setTimeout(()=>p.textContent="Leo got your nudge (simulated)",800)};
draw();
</script></body></html>`;
}

export async function simChat({ tier, system, user, json }) {
  const started = Date.now();
  let out;
  if (/web search queries/i.test(system)) {
    await wait(between(600, 1000));
    out = { queries: ["apps like " + user.replace(/^Idea:\s*/, "").slice(0, 40), "student app " + nameFrom(user)] };
  } else if (/research app ideas/i.test(system)) {
    await wait(between(800, 1500));
    out = {
      lines: [
        "A few apps do something close, mostly built for adults or big teams.",
        "The best ones keep it to one screen and open in under a second.",
        "Nobody has nailed it for students between classes. That gap is yours.",
      ],
      examples: [],
    };
  } else if (/interview a high school student/i.test(system)) {
    await wait(between(600, 1500));
    const job = user.split("This question's job:")[1] ?? "";
    const key = /^\s*Who/.test(job) ? "who" : /ONE thing/.test(job) ? "moment" : /feel/i.test(job) ? "feel" : "twist";
    out = QUESTIONS[key];
  } else if (/one-page product spec/i.test(system)) {
    await wait(between(800, 1500));
    const idea = (user.match(/Idea: (.*)/) ?? [, "an app"])[1];
    out = {
      name: nameFrom(idea),
      tagline: "Your day, sorted before the bell rings",
      for: "Students on the bus at 7am who want to know what today needs.",
      core: "One screen that shows what matters today, and lets you tick it off.",
      twist: "Your friend group keeps a shared streak alive together.",
      features: ["Two-tap add from the home screen", "Tick things off with one tap", "Shared streak with your friends"],
      screens: ["Today list with quick add", "Progress screen with friend streak"],
      look: "Summer festival: #FFF4D6 background, #FF5A5F coral, #2B1B3D ink, font Baloo 2",
      ai: "A small model could turn a messy voice note into a clean to-do item.",
      weekend: ["Sketch the two screens on paper", "Ask Cursor to build the Today list", "Add the streak screen with fake friends", "Show it to three people and fix one thing"],
    };
  } else if (/clickable PROTOTYPE/i.test(system)) {
    await wait(between(4500, 5500));
    const html = prototype(pickJson(user, "Build the prototype for this spec:"));
    return { text: html, usage: { tier, model: "sim", ms: Date.now() - started, cost: 0, out: null }, data: null };
  } else {
    await wait(600);
    out = {};
  }
  const text = JSON.stringify(out);
  return { text, usage: { tier, model: "sim", ms: Date.now() - started, cost: 0, out: null }, data: json ? out : null };
}

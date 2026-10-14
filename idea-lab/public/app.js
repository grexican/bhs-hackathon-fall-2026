// Idea lab front end: idea -> research -> 4 questions -> build -> showcase.
// Plain DOM, no framework. Everything the AI or the student writes goes in through textContent.
const $ = (id) => document.getElementById(id);
const KEY = "bhs-idea-lab";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const STATUS = {
  research: ["Looking up what already exists", "Reading what's out there", "Looking for the gap you could own"],
  question: ["Thinking of your next question", "Reading your answer", "Narrowing it down"],
  build: ["Sketching screens", "Filling in sample data", "Wiring up buttons", "Picking colors you chose", "Writing the button labels", "Checking every screen works"],
};

const state = { config: { open: true, questions: 4 }, id: null, step: 0, idea: "", first: "" };

// ---------- small helpers ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};
async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  } catch {
    throw new Error("No connection. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Try again."), { status: res.status });
  return data;
}
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

/** Stations: 0 Idea, 1 Research, 2 Questions, 3 Prototype, 4 Oct 24. */
function station(n) {
  [...$("metro").children].forEach((li, i) => {
    li.classList.toggle("passed", i < n);
    li.classList.toggle("current", i === n);
    if (i === n) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
}

function scrollTo(node) {
  node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

// ---------- waiting indicator ----------
let waiter = null;
function wait(kind, { color, clockFrom } = {}) {
  stopWait();
  const lines = STATUS[kind];
  const status = el("span", { class: "status", text: lines[0] });
  const clock = clockFrom ? el("span", { class: "clock", "aria-hidden": "true" }) : null;
  const node = el("div", { class: "wait msg", style: `--c:${color}` },
    el("span", { class: "dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), status, clock);
  $("log").append(node);
  let i = 0;
  const tick = () => {
    if (clock) {
      const s = Math.max(0, Math.floor((Date.now() - clockFrom) / 1000));
      clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
  };
  tick();
  const rot = setInterval(() => { i = (i + 1) % lines.length; status.textContent = lines[i]; }, 3200);
  const clk = clock ? setInterval(tick, 1000) : null;
  waiter = { node, stop: () => { clearInterval(rot); clearInterval(clk); node.remove(); } };
  return node;
}
function stopWait() { waiter?.stop(); waiter = null; }

function errorBox(message, actionLabel, onAction) {
  const box = el("div", { class: "err msg", role: "alert" }, el("p", { text: message }));
  if (actionLabel) {
    box.append(el("button", { class: "btn btn-line btn-small", type: "button", text: actionLabel, onclick: () => { box.remove(); onAction(); } }));
  }
  return box;
}

// ---------- chat pieces ----------
function youSay(text, who) {
  const node = el("div", { class: "you msg" });
  if (who) node.append(el("span", { class: "who", text: who }));
  node.append(text);
  $("log").append(node);
}

function researchCard(r) {
  const lines = (r?.lines || []).filter(Boolean);
  const examples = (r?.examples || []).filter((e) => safeUrl(e.url));
  if (!lines.length && !examples.length) return;
  const card = el("div", { class: "ai research msg", style: "--c:var(--purple)" },
    el("h3", { class: "sr-only", text: "What already exists" }),
    el("ul", {}, ...lines.map((l) => el("li", { text: l }))));
  if (examples.length) {
    card.append(el("div", { class: "links" }, ...examples.map((e) =>
      el("a", { href: safeUrl(e.url), target: "_blank", rel: "noopener noreferrer" },
        el("b", { text: e.name || new URL(e.url).hostname }), e.note ? el("span", { text: e.note }) : null))));
  }
  $("log").append(card);
}

function questionCard(q, step) {
  const total = state.config.questions || 4;
  const title = el("h2", { tabindex: "-1", text: q.question });
  const opts = el("div", { class: "opts" });
  const own = el("input", { type: "text", maxlength: "300", placeholder: "Or type your own", "aria-label": "Or type your own answer", enterkeyhint: "send" });
  const send = el("button", { class: "btn btn-red btn-small", type: "submit", text: "Send" });
  const form = el("form", { class: "own" }, own, send);
  const card = el("div", { class: "ai q msg", style: "--c:var(--green)" },
    el("p", { class: "count", text: `Question ${step + 1} of ${total}` }), title,
    q.why ? el("p", { class: "why", text: q.why }) : null, opts, form);

  const buttons = (q.options || []).map((o, i) => {
    const b = el("button", { class: i === q.recommended ? "opt rec" : "opt", type: "button", "aria-pressed": "false" },
      el("b", { text: o.label }), o.detail ? el("span", { text: o.detail }) : null,
      i === q.recommended ? el("em", { class: "pick", text: "my pick" }) : null);
    b.addEventListener("click", () => choose(o.label, b));
    return b;
  });
  opts.append(...buttons);
  form.addEventListener("submit", (e) => { e.preventDefault(); const t = own.value.trim(); if (t) choose(t, null); else own.focus(); });

  let busy = false;
  function lock(on, picked) {
    opts.classList.toggle("locked", on);
    buttons.forEach((b) => { b.disabled = on; b.setAttribute("aria-pressed", String(b === picked && on)); });
    own.disabled = on; send.disabled = on;
  }
  async function choose(text, picked) {
    if (busy) return;
    busy = true;
    lock(true, picked);
    form.hidden = true;
    youSay(text);
    const last = step + 1 >= total;
    wait(last ? "build" : "question", { color: "var(--green)" });
    try {
      const res = await api(`/api/session/${state.id}/answer`, { answer: text });
      stopWait();
      if (res.building) return startBuild(Date.now());
      state.step = res.step;
      showQuestion(res.question, res.step);
    } catch (err) {
      stopWait();
      $("log").lastElementChild.remove(); // take back the answer bubble
      form.hidden = false;
      lock(false);
      if (!picked) own.value = text;
      busy = false;
      card.append(errorBox(err.message, "Try again", () => choose(text, picked)));
    }
  }
  return card;
}

function showQuestion(q, step) {
  station(2);
  const card = questionCard(q, step);
  $("log").append(card);
  const h = card.querySelector("h2");
  h.focus({ preventScroll: true });
  scrollTo(card);
}

// ---------- build ----------
let pollTimer = null;
function startBuild(startedAt) {
  station(3);
  store.set({ id: state.id, t: startedAt });
  const head = el("div", { class: "ai build msg", style: "--c:var(--yellow)" },
    el("h2", { tabindex: "-1", text: "Building your prototype" }),
    el("p", { text: "This takes 1 to 3 minutes. Keep this page open." }));
  $("log").append(head);
  wait("build", { color: "var(--yellow)", clockFrom: startedAt });
  head.querySelector("h2").focus({ preventScroll: true });
  scrollTo(head);
  poll();
}
function poll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      const s = await api(`/api/session/${state.id}`);
      if (s.status === "ready" && s.url) {
        stopWait();
        station(4);
        $("log").append(el("p", { class: "msg", text: "Ready. Opening it now." }));
        setTimeout(() => location.assign(s.url), reduced ? 0 : 600);
        return;
      }
      if (s.status === "failed") return buildFailed(s.error || "The build didn't finish.");
    } catch (err) {
      if (err.status === 404) return buildFailed("That prototype can't be found anymore.");
      // network blips: keep polling
    }
    poll();
  }, 3000);
}
function buildFailed(message) {
  stopWait();
  // Keep the session: the answers are saved, so "Build it again" skips the questions.
  $("log").append(errorBox(`${message} Your answers are saved, so you can build it again.`, "Build it again", async () => {
    try {
      await api(`/api/session/${state.id}/retry`, {});
      startBuild(Date.now());
    } catch (err) {
      buildFailed(err.message);
    }
  }));
}

// ---------- flow ----------
function toChat() {
  $("hero").hidden = true;
  $("facts").hidden = true;
  $("chat").hidden = false;
}
function restart(keepIdea) {
  clearTimeout(pollTimer);
  stopWait();
  $("log").replaceChildren();
  $("chat").hidden = true;
  $("hero").hidden = false;
  $("facts").hidden = false;
  if (keepIdea) { $("idea").value = state.idea; $("first").value = state.first; }
  station(0);
  $("go").disabled = false;
  $("idea").focus();
}

async function start(e) {
  e.preventDefault();
  const idea = $("idea").value.trim();
  const first = $("first").value.trim();
  const errBox = $("start-err");
  errBox.hidden = true;
  if (idea.length < 8) {
    errBox.querySelector("p").textContent = "Tell me a bit more: one sentence about the app you want.";
    errBox.hidden = false;
    $("idea").focus();
    return;
  }
  Object.assign(state, { idea, first, step: 0 });
  $("go").disabled = true;
  toChat();
  station(1);
  youSay(idea, first || null);
  wait("research", { color: "var(--purple)" });
  scrollTo($("chat"));
  try {
    const res = await api("/api/session", { idea, firstName: first });
    stopWait();
    state.id = res.id;
    store.set({ id: res.id });
    researchCard(res.research);
    showQuestion(res.question, res.step ?? 0);
  } catch (err) {
    restart(true);
    errBox.querySelector("p").textContent = err.message;
    errBox.hidden = false;
  }
}

async function resume() {
  const saved = store.get();
  if (!saved?.id) return;
  try {
    const s = await api(`/api/session/${saved.id}`);
    if (s.status === "building") {
      state.id = saved.id;
      toChat();
      startBuild(saved.t || Date.now());
    } else if (s.status === "ready" && s.url) {
      $("resume-text").textContent = s.spec?.name ? `Your last prototype, ${s.spec.name}, is ready.` : "Your last prototype is ready.";
      $("resume-link").href = s.url;
      $("resume").hidden = false;
    } else if (s.status === "failed") {
      state.id = saved.id;
      toChat();
      buildFailed("Your last build didn't finish.");
    } else {
      store.clear();
    }
  } catch {
    store.clear();
  }
}

async function init() {
  $("start").addEventListener("submit", start);
  try {
    state.config = await api("/api/config");
  } catch {
    return; // stay usable: the form still works if the API comes back
  }
  const signup = safeUrl(state.config.signupUrl);
  if (signup) $("signup").href = signup;
  if (!state.config.open) {
    $("hero").hidden = true;
    $("facts").hidden = true;
    $("closed").hidden = false;
    station(5);
    return;
  }
  resume();
}
init();

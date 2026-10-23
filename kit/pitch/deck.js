/* Pitch deck runtime. scripts/pitch.mjs inlines this into apps/<codename>/pitch/index.html.
   Students never edit it: the deck is built from docs/pitch.json.

   Contract with the HTML:
     .slide[data-n]          one per slide, in order (0-based)
     .slide .notes           what the presenter says (hidden on the big screen)
     [data-open-app]         opens the live app in a new tab (also key D)

   Keys: → / space / PageDown next · ← / PageUp back · Home / End
         F fullscreen · N notes on this screen · P presenter window (notes, next slide, timer)
         D open the live app (the demo) · T restart the timer
   Deep link: #3 opens slide 3. No storage APIs, works from a file:// double-click. */
(function () {
  const slides = [...document.querySelectorAll(".slide")];
  const stage = document.querySelector(".stage");
  const bar = document.querySelector(".progress i");
  const count = document.querySelector(".count");
  const notesBox = document.querySelector(".notes-overlay");
  const appUrl = document.body.dataset.appUrl || "";
  const isPresenter = location.hash === "#presenter";
  let current = 0;
  let presenterWin = null;
  let startedAt = Date.now();

  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  function notesOf(i) {
    const n = slides[i] && slides[i].querySelector(".notes");
    return n ? n.innerHTML : "";
  }
  function titleOf(i) {
    const s = slides[i];
    return s ? s.dataset.title || "" : "";
  }

  function show(i, opts) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    current = i;
    slides.forEach((s, k) => {
      s.classList.toggle("on", k === i);
      s.classList.toggle("past", k < i);
    });
    if (bar) bar.style.width = ((i + 1) / slides.length) * 100 + "%";
    if (count) count.textContent = `${i + 1} / ${slides.length}`;
    if (notesBox) notesBox.querySelector(".body").innerHTML = notesOf(i) || "<em>No notes for this slide.</em>";
    if (!(opts && opts.fromHash)) {
      document.body.classList.add("started");
      document.body.classList.remove("boot");
      try { history.replaceState(null, "", "#" + (i + 1)); } catch { /* sandboxed */ }
    }
    sync();
  }

  function sync() {
    if (presenterWin && !presenterWin.closed) {
      presenterWin.postMessage({ deck: "state", i: current, total: slides.length, notes: notesOf(current), title: titleOf(current), next: titleOf(current + 1), startedAt }, "*");
    }
  }

  function openApp() {
    if (appUrl) window.open(appUrl, "_blank", "noopener");
  }

  function key(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === "ArrowRight" || k === " " || k === "PageDown") { e.preventDefault(); show(current + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); show(current - 1); }
    else if (k === "Home") show(0);
    else if (k === "End") show(slides.length - 1);
    else if (k === "f" || k === "F") toggleFullscreen();
    else if (k === "n" || k === "N") document.body.classList.toggle("show-notes");
    else if (k === "p" || k === "P") openPresenter();
    else if (k === "d" || k === "D") openApp();
    else if (k === "t" || k === "T") { startedAt = Date.now(); sync(); }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  function openPresenter() {
    presenterWin = window.open(location.href.split("#")[0] + "#presenter", "pitch-presenter", "width=900,height=640");
    setTimeout(sync, 400);
  }

  /* The presenter window: same file, opened with #presenter. It shows notes, the next
     slide and a timer, and drives the main window. */
  if (isPresenter) {
    document.body.classList.add("presenter");
    const view = document.querySelector(".presenter-view");
    const tick = () => {
      const s = Math.floor((Date.now() - (view.dataset.startedAt || Date.now())) / 1000);
      view.querySelector(".clock").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    setInterval(tick, 500);
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d || d.deck !== "state") return;
      view.dataset.startedAt = d.startedAt;
      view.querySelector(".where").textContent = `${d.i + 1} / ${d.total} · ${d.title}`;
      view.querySelector(".pnotes").innerHTML = d.notes || "<em>No notes for this slide.</em>";
      view.querySelector(".pnext").textContent = d.next ? `Next: ${d.next}` : "Last slide";
      tick();
    });
    const send = (cmd) => window.opener && window.opener.postMessage({ deck: "cmd", cmd }, "*");
    document.addEventListener("keydown", (e) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); send("next"); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); send("prev"); }
      else if (e.key === "d" || e.key === "D") send("app");
      else if (e.key === "t" || e.key === "T") send("timer");
    });
    view.querySelector(".pprev").addEventListener("click", () => send("prev"));
    view.querySelector(".pgo").addEventListener("click", () => send("next"));
    view.querySelector(".papp").addEventListener("click", () => send("app"));
    if (!window.opener) view.querySelector(".pnotes").innerHTML = "<em>Open this from the deck: press P there.</em>";
    return;
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.deck !== "cmd") return;
    if (d.cmd === "next") show(current + 1);
    else if (d.cmd === "prev") show(current - 1);
    else if (d.cmd === "app") openApp();
    else if (d.cmd === "timer") { startedAt = Date.now(); sync(); }
  });

  document.addEventListener("keydown", key);
  document.querySelectorAll("[data-open-app]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openApp(); }));

  /* Click or tap: right two thirds go forward, left third goes back. Swipe works too. */
  document.addEventListener("click", (e) => {
    if (e.target.closest("a,button,[data-open-app],.notes-overlay")) return;
    show(e.clientX > window.innerWidth / 3 ? current + 1 : current - 1);
  });
  let touchX = null;
  document.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(dx < 0 ? current + 1 : current - 1);
    touchX = null;
  });

  const fromHash = () => {
    const m = location.hash.match(/^#(\d+)$/);
    return m ? Number(m[1]) - 1 : null;
  };
  window.addEventListener("hashchange", () => {
    const n = fromHash();
    if (n !== null && n !== current) show(n, { fromHash: true });
  });
  show(fromHash() ?? 0, { fromHash: true });
})();

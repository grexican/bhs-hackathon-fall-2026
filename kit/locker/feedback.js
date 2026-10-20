// A small "Feedback" button for any page. Tapping it opens a sheet where testers write what they
// think, give a rating (optional) and a name or email (optional). It posts to this app's own
// /api/feedback route (locker/feedback.mjs on the server), never straight to the hub.
// Add it to a page with: <script src="/locker/feedback.js" defer></script>
(() => {
  if (document.getElementById("fb-open")) return;
  const style = document.createElement("style");
  // Restyle it from your own CSS with these variables (all optional), e.g. :root { --fb-ink: #1c2b7a; --fb-font: inherit; }
  //   --fb-ink (button + text), --fb-paper (sheet), --fb-accent (stars), --fb-font,
  //   --fb-left / --fb-right / --fb-bottom (where the button sits; bottom-left by default).
  style.textContent = `
    #fb-open { position: fixed; z-index: 2147483000; left: var(--fb-left, max(12px, env(safe-area-inset-left)));
      right: var(--fb-right, auto); bottom: var(--fb-bottom, max(12px, env(safe-area-inset-bottom)));
      font: 600 13px/1 var(--fb-font, system-ui, sans-serif); padding: 0 14px; min-height: 36px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.25); background: var(--fb-ink, #1d1b18); color: var(--fb-paper, #fff);
      box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; opacity: .88; }
    #fb-open:hover, #fb-open:focus-visible { opacity: 1; }
    #fb-open:focus-visible { outline: 2px solid var(--fb-ink, #1d1b18); outline-offset: 3px; }
    @media (prefers-reduced-motion: no-preference) { #fb-open { transition: opacity .15s; } }
    #fb-sheet { border: 0; padding: 0; margin: auto auto 0; width: 100%; max-width: 480px; border-radius: 18px 18px 0 0;
      font: 16px/1.4 var(--fb-font, system-ui, sans-serif); color: var(--fb-ink, #1d1b18); background: var(--fb-paper, #fff); }
    #fb-sheet::backdrop { background: rgba(0,0,0,.35); }
    #fb-sheet form { display: grid; gap: 12px; padding: 20px 20px max(20px, env(safe-area-inset-bottom)); }
    #fb-sheet h2 { margin: 0; font-size: 20px; }
    #fb-sheet label { display: grid; gap: 6px; }
    #fb-sheet textarea, #fb-sheet input[type=text] { font: inherit; font-size: 16px; width: 100%; box-sizing: border-box;
      padding: 10px; border: 1px solid #c9c4ba; border-radius: 10px; color: inherit; background: var(--fb-paper, #fff); }
    #fb-sheet textarea { min-height: 110px; resize: vertical; }
    #fb-sheet fieldset { display: flex; gap: 4px; border: 0; padding: 0; margin: 0; align-items: center; }
    #fb-sheet legend { font-size: 14px; float: left; margin-right: 8px; }
    #fb-sheet .fb-star { display: inline-block; font-size: 30px; line-height: 1; cursor: pointer; color: #c9c4ba; }
    #fb-sheet .fb-star input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    #fb-sheet .fb-star.on { color: var(--fb-accent, #e0a800); }
    #fb-sheet .fb-star:focus-within { outline: 2px solid var(--fb-ink, #1d1b18); border-radius: 4px; }
    #fb-sheet .fb-row { display: flex; gap: 8px; justify-content: flex-end; }
    #fb-sheet button { font: 600 16px var(--fb-font, system-ui, sans-serif); min-height: 44px; padding: 0 18px; border-radius: 999px;
      border: 1px solid var(--fb-ink, #1d1b18); background: var(--fb-paper, #fff); color: var(--fb-ink, #1d1b18); cursor: pointer; }
    #fb-sheet button[type=submit] { background: var(--fb-ink, #1d1b18); color: var(--fb-paper, #fff); }
    #fb-sheet .fb-msg { margin: 0; font-size: 14px; min-height: 1.4em; }
    @media (prefers-reduced-motion: reduce) { #fb-open, #fb-sheet { transition: none; animation: none; } }
    .fb-hide { position: absolute; left: -9999px; }`;
  document.head.append(style);

  const open = document.createElement("button");
  open.id = "fb-open";
  open.type = "button";
  open.textContent = "Feedback";

  const sheet = document.createElement("dialog");
  sheet.id = "fb-sheet";
  sheet.setAttribute("aria-label", "Send feedback");
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<label class="fb-star"><input type="radio" name="rating" value="${n}"><span aria-hidden="true">★</span><span class="fb-hide">${n} of 5</span></label>`)
    .join("");
  sheet.innerHTML = `<form>
    <h2>What do you think?</h2>
    <label>What worked, what was confusing, what's missing?
      <textarea name="message" maxlength="2000" required></textarea></label>
    <fieldset><legend>Rating (optional)</legend>${stars}</fieldset>
    <label>Your name or email (optional, so the team can reply)
      <input type="text" name="contact" maxlength="120" autocomplete="off"></label>
    <p class="fb-msg" role="status"></p>
    <div class="fb-row"><button type="button" data-close>Close</button><button type="submit">Send</button></div>
  </form>`;
  document.body.append(open, sheet);

  const form = sheet.querySelector("form");
  const msg = sheet.querySelector(".fb-msg");
  const starLabels = [...sheet.querySelectorAll(".fb-star")];
  const paintStars = () => {
    const value = Number(form.elements.rating.value || 0);
    starLabels.forEach((s, i) => s.classList.toggle("on", i < value));
  };
  form.addEventListener("change", paintStars);
  open.addEventListener("click", () => {
    msg.textContent = "";
    sheet.showModal();
    form.elements.message.focus();
  });
  sheet.querySelector("[data-close]").addEventListener("click", () => sheet.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    msg.textContent = "Sending…";
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: form.elements.message.value,
          rating: form.elements.rating.value || undefined,
          contact: form.elements.contact.value || undefined,
          page: location.pathname,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't send it. Try again.");
      form.reset();
      paintStars();
      msg.textContent = "Thanks! The team will read it.";
      setTimeout(() => sheet.close(), 1500);
    } catch (err) {
      msg.textContent = err.message;
    }
  });
})();

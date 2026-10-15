// The /s/<id> showcase page: the student's prototype in a phone frame, the short spec around it,
// and the push to sign up. Every string from the row is AI or student written, so all of it is escaped.
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(String(u ?? "")) ? String(u) : null);

const STATIONS = [
  ["Idea", "--red"],
  ["Research", "--purple"],
  ["Questions", "--green"],
  ["Prototype", "--yellow"],
  ["Oct 24", "--blue"],
];

function metro() {
  const items = STATIONS.map(([name, color], i) => {
    const last = i === STATIONS.length - 1;
    const cls = last ? "dest current" : "passed";
    return `<li class="${cls}"${last ? ' aria-current="step"' : ""} style="--c:var(${color});--seg:var(${color})"><span class="dot"></span><span class="name">${name}</span></li>`;
  });
  return `<div class="metro-bar"><div class="wrap show"><ol class="metro" aria-label="Where this idea is">${items.join("")}</ol></div></div>`;
}

function section(title, body) {
  return body ? `<section><h2>${title}</h2>${body}</section>` : "";
}
const para = (v) => (v ? `<p>${esc(v)}</p>` : "");

export function renderShowcase(row, config) {
  const spec = row.spec ?? {};
  const name = spec.name || "Your app";
  const weekend = (spec.weekend ?? []).filter(Boolean);
  const examples = (row.research?.examples ?? []).filter((e) => safeUrl(e.url));
  const appUrl = `/s/${esc(row.id)}/app`;
  const signup = safeUrl(config.signupUrl) ?? "#";
  const open = Date.now() < +config.closesAt;
  const base = (config.publicUrl || "").replace(/\/$/, ""); // link previews need an absolute image URL

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(name)}: a BHS Hackathon prototype</title>
<meta name="description" content="${esc(spec.tagline || row.idea)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(name)}: a BHS Hackathon prototype">
<meta property="og:description" content="${esc(spec.tagline || row.idea)}">
${row.shots?.desktop ? `<meta property="og:image" content="${esc(base)}/s/${esc(row.id)}/shot/desktop.jpg">
<meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='%23fff' stroke='%23DC241F' stroke-width='7'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,700..800&display=swap">
<link rel="stylesheet" href="/style.css">
</head>
<body>
${metro()}
<main class="wrap show">
  <header class="show-head">
    <h1>${esc(name)}</h1>
    ${spec.tagline ? `<p class="tagline">${esc(spec.tagline)}</p>` : ""}
    ${row.first_name ? `<p class="by">Imagined by ${esc(row.first_name)}</p>` : ""}
    <p class="by"><a href="/c/${esc(row.id)}">See the chat that built this</a></p>
  </header>

  <div class="show-grid">
    <div class="phone-col">
      <div class="phone"><iframe src="${appUrl}" sandbox="allow-scripts" title="${esc(name)} prototype" loading="eager"></iframe></div>
      <a class="full" href="${appUrl}" target="_blank" rel="noopener">Open full screen</a>
    </div>

    <div class="notes">
      ${section("Who it's for", para(spec.for))}
      ${section("The one thing it nails", para(spec.core))}
      ${section("The twist", para(spec.twist))}
      ${section("Build it for real at the hackathon", weekend.length ? `<ol class="stops">${weekend.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : "")}
      ${section("Where AI could fit", para(spec.ai))}
      ${section(
        "What already exists",
        examples.length
          ? `<div class="links">${examples
              .map((e) => `<a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(e.name || new URL(e.url).hostname)}</b>${e.note ? `<span>${esc(e.note)}</span>` : ""}</a>`)
              .join("")}</div>`
          : "",
      )}

      <section class="cta">
        <h2>Build this for real&nbsp;— Oct&nbsp;24–25 at&nbsp;BHS</h2>
        <div class="row">
          <a class="btn btn-red" href="${esc(signup)}" target="_blank" rel="noopener">Sign up</a>
          <button class="btn btn-line" type="button" id="copy">Copy link to this prototype</button>
        </div>
        <p>Paste this link in the sign-up form.</p>
        <p class="sr-only" id="copied" aria-live="polite"></p>
      </section>
      ${open ? `<section class="try">
        <h2>Got an idea of your own?</h2>
        <p>Answer 4 quick questions and get a clickable prototype like this one in about 3 minutes.</p>
        <a class="btn btn-red" href="/">Try your own idea</a>
      </section>` : ""}
    </div>
  </div>
  <p class="foot">This is a prototype with simulated data. Nothing here is real yet.</p>
</main>
<script>
document.getElementById("copy").addEventListener("click", async (e) => {
  const b = e.currentTarget, url = location.href;
  try { await navigator.clipboard.writeText(url); }
  catch {
    const t = document.createElement("textarea");
    t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.append(t); t.select();
    try { document.execCommand("copy"); } catch {}
    t.remove();
  }
  b.textContent = "Copied";
  document.getElementById("copied").textContent = "Link copied";
  setTimeout(() => { b.textContent = "Copy link to this prototype"; }, 2500);
});
</script>
</body>
</html>`;
}

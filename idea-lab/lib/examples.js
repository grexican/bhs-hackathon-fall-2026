// The public /examples page: every prototype the Idea Lab built as a starting point, for students
// who don't know what to build yet. Each one links to the prototype and the chat that made it.
import { esc } from "./showcase.js";

export function renderExamples(rows, config) {
  const open = Date.now() < +config.closesAt;
  const base = (config.publicUrl || "").replace(/\/$/, "");
  const cards = rows
    .map((r) => {
      const spec = r.spec ?? {};
      const shot = r.has_shot
        ? `<img src="/s/${esc(r.id)}/shot/mobile.jpg" alt="" loading="lazy" width="390" height="844">`
        : `<span class="ex-noshot" aria-hidden="true">${esc((spec.name || "?").slice(0, 1))}</span>`;
      return `<li class="ex">
  <a class="ex-shot" href="/s/${esc(r.id)}" aria-hidden="true" tabindex="-1">${shot}</a>
  <div class="ex-body">
    <h2><a href="/s/${esc(r.id)}">${esc(spec.name || "Untitled")}</a></h2>
    ${spec.tagline ? `<p class="ex-tag">${esc(spec.tagline)}</p>` : ""}
    <p class="ex-idea">“${esc(r.idea.length > 180 ? r.idea.slice(0, 177) + "…" : r.idea)}”</p>
    <p class="ex-links"><a href="/s/${esc(r.id)}">Open the prototype</a><a href="/c/${esc(r.id)}">See how it was made</a></p>
  </div>
</li>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Idea Lab examples: BHS Hackathon</title>
<meta name="description" content="App ideas for BHS students, families and expats, each one prototyped by the Idea Lab. Pick one and build it for real at the hackathon.">
<meta property="og:title" content="Idea Lab examples: BHS Hackathon">
<meta property="og:description" content="${rows.length} app ideas for BHS students, families and expats, prototyped and clickable.">
${rows.find((r) => r.has_shot) ? `<meta property="og:image" content="${esc(base)}/s/${esc(rows.find((r) => r.has_shot).id)}/shot/desktop.jpg">` : ""}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='%23fff' stroke='%23DC241F' stroke-width='7'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,700..800&display=swap">
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body>
<main class="wrap examples">
  <header class="show-head">
    <h1>Need an idea?</h1>
    <p class="tagline">${rows.length} apps the Idea Lab prototyped for BHS students, families and expats. Open one, click around, and steal it.</p>
    <p class="by">Every one of these could be your project at the BHS Hackathon, Oct&nbsp;24–25.</p>
  </header>
  <ol class="ex-list">
${cards}
  </ol>
  <section class="cta">
    <h2>Got your own idea?</h2>
    <div class="row">
      ${open ? `<a class="btn btn-red" href="/">Prototype it in a few minutes</a>` : ""}
      <a class="btn btn-line" href="${esc(config.signupUrl)}" target="_blank" rel="noopener">Sign up for the hackathon</a>
    </div>
  </section>
  <p class="foot">These are prototypes with simulated data. Nothing in them is real yet.</p>
</main>
</body>
</html>`;
}

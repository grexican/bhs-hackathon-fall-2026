// Organizer-only list of every idea, reached at /admin/<ADMIN_KEY>. The key lives only in Railway's
// variables; without it set, the page doesn't exist.
import { esc } from "./showcase.js";

export function renderAdmin(rows) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const cost = (r) => (r.usage ?? []).reduce((sum, u) => sum + (u?.cost ?? 0), 0);
  const total = rows.reduce((s, r) => s + cost(r), 0);
  const body = rows
    .map((r) => {
      const name = r.spec?.name ?? "";
      const stats = r.checks?.stats ? `${r.checks.stats.responded}/${r.checks.stats.clickable} buttons` : "";
      const issues = r.checks?.problems?.length ? ` · ${r.checks.problems.length} issue(s)` : "";
      return `<tr>
  <td>${esc(fmt.format(new Date(r.created_at)))}</td>
  <td>${esc(r.first_name || "")}</td>
  <td><b>${esc(name)}</b><br><span class="idea">${esc(r.idea)}</span></td>
  <td class="st st-${esc(r.status)}">${esc(r.status)}<br><span class="idea">${esc(stats + issues)}</span></td>
  <td><a href="/c/${esc(r.id)}" target="_blank">chat</a>${r.status === "ready" ? ` · <a href="/s/${esc(r.id)}" target="_blank">prototype</a>` : ""}</td>
  <td class="num">$${cost(r).toFixed(3)}</td>
</tr>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Idea lab admin</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px 16px;color:#15171c;background:#f6f7f9}
h1{margin:0 0 4px}p{margin:0 0 16px;color:#5b6170}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e3e5ea;vertical-align:top}
th{background:#15171c;color:#fff;font-weight:600}.idea{color:#5b6170;font-size:13px}
.num{text-align:right;font-variant-numeric:tabular-nums}.st-ready{color:#2c8a2c}.st-failed{color:#dc241f}.st-building{color:#b38600}
a{color:#0072bc}
</style></head><body>
<h1>Idea lab: ${rows.length} idea${rows.length === 1 ? "" : "s"}</h1>
<p>${rows.filter((r) => r.status === "ready").length} prototypes ready · $${total.toFixed(2)} AI spend in total · newest first</p>
<table><thead><tr><th>When</th><th>Who</th><th>App / idea</th><th>Status</th><th>Links</th><th>Cost</th></tr></thead>
<tbody>${body}</tbody></table></body></html>`;
}

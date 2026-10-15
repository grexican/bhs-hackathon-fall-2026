// Cheap checks on a generated prototype, before a browser ever opens it.
// The one that matters most: every inline <script> must compile. A file cut off mid-script
// compiles to nothing, and a browser runs nothing without even logging an error.
import vm from "node:vm";

export function staticCheck(html) {
  const problems = [];
  if (!/<\/html>\s*$/i.test(html.trim())) problems.push("The file does not end with </html>; it looks cut off.");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const opened = (html.match(/<script\b/gi) || []).length;
  if (opened !== scripts.length) problems.push("A <script> tag is never closed.");
  for (const [, attrs, code] of scripts) {
    if (/\bsrc=/i.test(attrs)) {
      problems.push("It loads an external script, which the sandbox blocks. Put all JavaScript inline.");
      continue;
    }
    try {
      new vm.Script(code);
    } catch (err) {
      problems.push(`JavaScript syntax error: ${err.message}`);
    }
  }
  // These throw or block inside the sandboxed frame, so one call can stop the whole script.
  for (const [pattern, why] of [
    [/\blocalStorage\b|\bsessionStorage\b/, "localStorage/sessionStorage throw inside the sandbox; keep state in JS variables."],
    [/\b(alert|confirm|prompt)\s*\(/, "alert/confirm/prompt are blocked inside the sandbox; show messages in the page."],
    [/\bfetch\s*\(|XMLHttpRequest/, "Network calls are blocked; simulate responses in JS."],
  ]) {
    if (pattern.test(html)) problems.push(why);
  }
  return problems;
}

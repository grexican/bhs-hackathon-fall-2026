// Web search through Jina (s.jina.ai). Returns titles, URLs and snippets only; never page bodies.
// No key or a failed search returns [] so the interview still runs, just without examples.
export async function webSearch(query, limit = 5) {
  if (process.env.AI_SIM === "1") return [];
  const key = process.env.JINA_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "X-Respond-With": "no-content" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[search] ${res.status} for "${query}"`);
      return [];
    }
    const body = await res.json();
    return (body.data ?? [])
      .slice(0, limit)
      .map((r) => ({ title: (r.title ?? "").slice(0, 160), url: r.url ?? "", snippet: (r.description ?? "").slice(0, 300) }))
      .filter((r) => r.url.startsWith("http"));
  } catch (err) {
    console.warn(`[search] ${err.message}`);
    return [];
  }
}

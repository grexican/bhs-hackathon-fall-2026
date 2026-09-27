// The simulator UI: a phone-shaped chat panel labelled "Simulated WhatsApp". The student plays the
// customer here. It talks to two small dev-only routes: POST /api/sim/messaging/say and
// GET /api/sim/messaging/thread?phone=…, which call `userSays` and `thread` on the sim provider.
import { useEffect, useState } from "react";

type Msg = { id: string; text: string; direction: "in" | "out"; at: string };

export function SimPhone({ phone = "+34600000001" }: { phone?: string }) {
  const [thread, setThread] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

  const refresh = () =>
    fetch(`/api/sim/messaging/thread?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then(setThread);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [phone]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await fetch("/api/sim/messaging/say", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: phone, text: draft }) });
    setDraft("");
    refresh();
  }

  return (
    <aside className="sim-phone" aria-label="Simulated WhatsApp">
      <header className="sim-phone__bar">
        <span>Study Buddy</span>
        <span className="sim-phone__tag">Simulated</span>
      </header>
      <ol className="sim-phone__thread">
        {thread.map((m) => (
          <li key={m.id} className={`sim-phone__msg sim-phone__msg--${m.direction === "in" ? "me" : "bot"}`}>
            {m.text}
          </li>
        ))}
      </ol>
      <form className="sim-phone__compose" onSubmit={send}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message" aria-label="Message" />
        <button type="submit">Send</button>
      </form>
    </aside>
  );
}

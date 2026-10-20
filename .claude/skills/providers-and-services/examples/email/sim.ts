// Simulated email: stores every message so the app can show an in-app inbox at /sim/inbox
// (label it "Simulated"). Same limits as the hub relay, so bugs show up here first.
import type { Email, EmailProvider } from "./index.ts";

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAILY_LIMIT = 50; // the hub relay's limit per app

export interface SimEmail extends EmailProvider {
  /** Everything "sent", newest first, for the inbox screen. */
  inbox(): Array<Email & { id: string; at: string }>;
}

export function createSimEmail(): SimEmail {
  const sent: Array<Email & { id: string; at: string }> = [];
  return {
    name: "sim",
    async send(email) {
      if (!ADDRESS.test(email.to)) throw new Error(`"${email.to}" isn't an email address`);
      if (!email.subject || !email.text) throw new Error("An email needs a subject and text");
      const today = new Date().toISOString().slice(0, 10);
      if (sent.filter((m) => m.at.startsWith(today)).length >= DAILY_LIMIT) throw new Error(`Daily limit of ${DAILY_LIMIT} emails reached`);
      sent.unshift({ ...email, id: `sim-${sent.length + 1}`, at: new Date().toISOString() });
      return { ok: true, simulated: true };
    },
    inbox: () => sent,
  };
}

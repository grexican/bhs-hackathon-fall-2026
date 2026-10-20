// Real email through the incubator hub's relay. Server-side only: LOCKER_APP_SECRET must never reach a browser.
// The hub may answer { simulated: true } when it has no mail provider yet; the message then shows on the hub page.
import type { EmailProvider } from "./index.ts";

export function createLockerEmail(env: NodeJS.ProcessEnv): EmailProvider {
  const hub = env.LOCKER_URL;
  const secret = env.LOCKER_APP_SECRET;
  if (!hub || !secret) throw new Error("LOCKER_URL and LOCKER_APP_SECRET are required (npm run locker:env -- <codename>)");
  return {
    name: "locker",
    async send(email) {
      const res = await fetch(`${hub}/api/email/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(email),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(`Email relay ${res.status}: ${json.error ?? "send failed"}`);
      return { ok: true, simulated: Boolean(json.simulated) };
    },
  };
}

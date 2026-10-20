// EmailProvider: what the app needs from "send an email", in the app's words.
// Services depend on this interface only, never on the hub relay or the simulator.
import { createLockerEmail } from "./locker.ts";
import { createSimEmail } from "./sim.ts";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  readonly name: "sim" | "locker";
  send(email: Email): Promise<{ ok: true; simulated: boolean }>;
}

// Picks the provider: explicit PROVIDER_EMAIL, then the hub relay if its secret exists, else the simulator.
export function getEmailProvider(env = process.env): EmailProvider {
  const choice = env.PROVIDER_EMAIL ?? (env.LOCKER_APP_SECRET ? "locker" : "sim");
  const provider = choice === "locker" ? createLockerEmail(env) : createSimEmail();
  console.log(`email: ${provider.name}`);
  return provider;
}

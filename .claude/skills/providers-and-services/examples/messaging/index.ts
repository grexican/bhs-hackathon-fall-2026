// MessagingProvider: what the app needs from "a chat channel", in the app's words.
// The service layer depends on this interface only, never on WhatsApp, Twilio or the simulator.
import { createSimMessaging } from "./sim.ts";
import { createWhatsAppMessaging } from "./whatsapp.ts";

export interface InboundMessage {
  id: string;
  from: string; // phone number or handle
  text: string;
  at: string; // ISO time
}

export interface MessagingProvider {
  readonly name: "sim" | "whatsapp";
  send(to: string, text: string): Promise<{ id: string }>;
  onMessage(handler: (msg: InboundMessage) => Promise<void> | void): void;
}

// Picks the provider: explicit PROVIDER_MESSAGING, then real if its key exists, else the simulator.
export function getMessagingProvider(env = process.env): MessagingProvider {
  const choice = env.PROVIDER_MESSAGING ?? (env.WHATSAPP_TOKEN ? "whatsapp" : "sim");
  const provider = choice === "whatsapp" ? createWhatsAppMessaging(env) : createSimMessaging();
  console.log(`messaging: ${provider.name}`);
  return provider;
}

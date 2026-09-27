// Simulated WhatsApp: a real, stateful stand-in. The in-app phone panel (SimPhone.tsx) calls
// `userSays` to play the customer and reads `thread` to draw the conversation.
// Same limits as the real channel, so bugs show up here first.
import type { InboundMessage, MessagingProvider } from "./index.ts";

const MAX_LENGTH = 4096; // WhatsApp's text limit
const PHONE = /^\+\d{8,15}$/;

export interface SimMessaging extends MessagingProvider {
  /** Play the customer: deliver a message as if it came from their phone. */
  userSays(from: string, text: string): Promise<void>;
  /** Everything sent both ways, oldest first. */
  thread(phone: string): Array<InboundMessage & { direction: "in" | "out" }>;
}

export function createSimMessaging(): SimMessaging {
  const log: Array<InboundMessage & { direction: "in" | "out" }> = [];
  const handlers: Array<(m: InboundMessage) => Promise<void> | void> = [];
  let seq = 0;
  const nextId = () => `sim-${++seq}`;

  return {
    name: "sim",
    async send(to, text) {
      if (!PHONE.test(to)) throw new Error(`Invalid phone number "${to}" (use +<country><number>)`);
      if (text.length > MAX_LENGTH) throw new Error(`Message is ${text.length} chars; the limit is ${MAX_LENGTH}`);
      const msg = { id: nextId(), from: to, text, at: new Date().toISOString(), direction: "out" as const };
      log.push(msg);
      return { id: msg.id };
    },
    onMessage(handler) {
      handlers.push(handler);
    },
    async userSays(from, text) {
      const msg = { id: nextId(), from, text, at: new Date().toISOString() };
      log.push({ ...msg, direction: "in" });
      for (const h of handlers) await h(msg);
    },
    thread(phone) {
      return log.filter((m) => m.from === phone);
    },
  };
}

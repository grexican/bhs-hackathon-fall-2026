// Real WhatsApp (Meta Cloud API). Added only once a token exists; the service code does not change.
// Inbound messages arrive by webhook: the app's webhook route calls `receive(payload)`.
import type { InboundMessage, MessagingProvider } from "./index.ts";

export function createWhatsAppMessaging(env: NodeJS.ProcessEnv): MessagingProvider & { receive(payload: unknown): Promise<void> } {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are required for the real provider");
  const handlers: Array<(m: InboundMessage) => Promise<void> | void> = [];

  return {
    name: "whatsapp",
    async send(to, text) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: text } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${json.error?.message ?? "send failed"}`);
      return { id: json.messages?.[0]?.id ?? "" };
    },
    onMessage(handler) {
      handlers.push(handler);
    },
    async receive(payload) {
      const messages = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
      for (const m of messages) {
        if (m.type !== "text") continue;
        const msg = { id: m.id, from: `+${m.from}`, text: m.text.body, at: new Date(Number(m.timestamp) * 1000).toISOString() };
        for (const h of handlers) await h(msg);
      }
    },
  };
}

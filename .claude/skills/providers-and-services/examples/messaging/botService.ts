// The app's rules for a study-buddy bot. Depends on interfaces only, so it runs identically on the
// simulated phone, on real WhatsApp, and in tests.
import type { MessagingProvider } from "./index.ts";

interface Deps {
  messaging: MessagingProvider;
  /** Any function that turns a question into an answer, e.g. `(q) => ask("fast", q).then(r => r.text)` from kit/ai. */
  answer: (question: string) => Promise<string>;
  /** A cheap yes/no gate, e.g. kit/ai `noul`. Returns null when unavailable, so a rule decides instead. */
  isOffTopic?: (text: string) => Promise<number | null>;
}

export function createBotService({ messaging, answer, isOffTopic }: Deps) {
  const muted = new Set<string>();

  messaging.onMessage(async ({ from, text }) => {
    const command = text.trim().toUpperCase();
    if (command === "STOP") {
      muted.add(from);
      await messaging.send(from, "You're unsubscribed. Text START to come back.");
      return;
    }
    if (command === "START") {
      muted.delete(from);
      await messaging.send(from, "Welcome back! Ask me anything you're studying.");
      return;
    }
    if (muted.has(from)) return;

    // Jev-style fast gate with a rule fallback: never blocks on the AI.
    const offTopic = (await isOffTopic?.(text)) ?? (/\b(homework|study|test|quiz|explain)\b/i.test(text) ? 0 : 0.5);
    if (offTopic > 0.8) {
      await messaging.send(from, "I'm a study buddy, so I stick to schoolwork. What are you working on?");
      return;
    }
    await messaging.send(from, await answer(text));
  });

  return { isMuted: (phone: string) => muted.has(phone) };
}

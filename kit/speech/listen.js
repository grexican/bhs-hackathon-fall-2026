// Speech to text in the browser, three engines behind one call. Plain JavaScript: works in a plain HTML page
// and in React. README.md (next to this file) has the table to choose an engine.
//
//   import { listen } from "./speech/listen.js";
//   const session = await listen({ engine: "browser", language: "es-ES", onPartial: (text) => (box.textContent = text) });
//   const { text } = await session.stop();             // when the person lets go of the button
//
//   engine "browser"  the browser's own recognizer: free, instant, live words; Chrome/Edge/Safari, not Firefox
//   engine "cloud"    record + your server's AI key (transcribe-route.mjs): accurate, any language, costs a little
//   engine "vosk"     offline in the browser: free and private; best with a short `commands` list
//   engine "auto"     "browser" where it exists, else "cloud"
//
// Must start from a tap or a key press (browsers don't let a page listen on its own). hold-to-talk.js does that part.
import { matchCommand } from "./commands.js";
import { browserSupported, startBrowser } from "./engine-browser.js";
import { cloudSupported, startCloud } from "./engine-cloud.js";
import { SpeechError } from "./mic.js";
import { preloadVosk, startVosk, VOSK_MODELS, voskSupported } from "./engine-vosk.js";

export { matchCommand, preloadVosk, SpeechError, VOSK_MODELS };

/** The languages to offer at a Barcelona school. Any BCP-47 code works ("fr-FR"…); vosk only has the models in VOSK_MODELS. */
export const LANGUAGES = [
  { code: "es-ES", label: "Español" },
  { code: "ca-ES", label: "Català" },
  { code: "en-US", label: "English" },
];

/** What this browser can do: { browser, cloud, vosk, secure }. Use it to hide a button or pick an engine. */
export function speechSupport() {
  const secure = typeof window !== "undefined" && window.isSecureContext;
  return { browser: browserSupported(), cloud: cloudSupported(), vosk: voskSupported(), secure };
}

/** The engine to use: the one asked for if this browser has it, "auto" → browser, then cloud. Null when none work. */
export function pickEngine(engine = "auto") {
  const can = speechSupport();
  if (engine !== "auto") return can[engine] ? engine : null;
  return can.browser ? "browser" : can.cloud ? "cloud" : null;
}

const WHY_NOT = {
  browser: "This browser can't listen by itself (Firefox can't). Use Chrome, Edge or Safari.",
  cloud: "This browser can't record audio.",
  vosk: "This browser can't run the offline voice engine.",
};

/**
 * Starts listening. Options: engine, language, commands, onPartial(text), onState(state), and for "cloud":
 * quality ("fast" | "best"), endpoint ("/api/transcribe"), maxSeconds (120); for "vosk": modelUrl.
 * States: "loading" (vosk's first download), "listening", "working" (cloud is writing it down), "idle".
 * Returns { stop() → Promise<{ text, command, engine, simulated }>, cancel() }.
 * `command` is the matching key from `commands` (or null): the same for every engine.
 */
export async function listen({ engine = "auto", language = "es-ES", commands, onPartial, onState, ...rest } = {}) {
  const chosen = pickEngine(engine);
  if (!chosen) throw new SpeechError("NOT_SUPPORTED", WHY_NOT[engine] ?? "This browser can't listen. Try Chrome, Edge or Safari.");
  let ended = false;
  // Words that arrive after a cancel are dropped, so they never cover up a message on the screen.
  const options = { language, commands, onPartial: (text) => !ended && onPartial?.(text), onState, ...rest };
  const session =
    chosen === "browser" ? startBrowser(options) : chosen === "cloud" ? await startCloud(options) : await startVosk(options);
  if (chosen !== "vosk") onState?.("listening");
  return {
    engine: chosen,
    async stop() {
      if (ended) return { text: "", command: null, engine: chosen, simulated: false };
      ended = true; // the result comes back from stop(), not as more live words
      try {
        const out = await session.stop();
        const { text, simulated = false, note } = typeof out === "string" ? { text: out } : out;
        return { text, command: commands ? (matchCommand(text, commands)?.command ?? null) : null, engine: chosen, simulated, ...(note && { note }) };
      } finally {
        onState?.("idle");
      }
    },
    cancel() {
      if (ended) return;
      ended = true;
      session.cancel();
      onState?.("idle");
    },
  };
}

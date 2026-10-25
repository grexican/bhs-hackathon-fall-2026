// Engine "browser": the browser's own speech recognition (Web Speech API). Free, instant, words appear while you talk.
// Chrome, Edge and Safari (iPhone with iOS 14.5+). Not Firefox. Needs internet: Chrome sends the audio to Google.
import { SpeechError } from "./mic.js";

const Recognition = () => (typeof window === "undefined" ? undefined : window.SpeechRecognition ?? window.webkitSpeechRecognition);

export const browserSupported = () => Boolean(Recognition());

const MESSAGES = {
  "not-allowed": ["MIC_BLOCKED", "The microphone is blocked. Allow it (tap the icon next to the address), then try again."],
  "service-not-allowed": ["MIC_BLOCKED", "This browser won't let the page listen. Try Chrome, or the cloud engine."],
  "audio-capture": ["NO_MIC", "No microphone found. Plug one in or try another device."],
  network: ["OFFLINE", "Listening needs the internet in this browser. Check the wifi, or use the offline (vosk) engine."],
  "language-not-supported": ["LANGUAGE", "This browser can't listen in that language. Try another language or the cloud engine."],
};

/** Starts listening. Returns { stop() → Promise<text>, cancel() }. */
export function startBrowser({ language, onPartial }) {
  const SR = Recognition();
  if (!SR) throw new SpeechError("NOT_SUPPORTED", "This browser can't listen by itself (Firefox can't). Use Chrome, Edge or Safari, or the cloud engine.");
  const rec = new SR();
  rec.lang = language;
  rec.interimResults = true; // words show up while the person is still talking
  rec.continuous = true; // keep listening through short pauses until stop()
  let finals = [];
  let interim = "";
  const done = new Promise((resolve, reject) => {
    rec.onresult = (event) => {
      interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) finals.push(text);
        else interim += ` ${text}`;
      }
      onPartial?.(`${finals.join(" ")} ${interim}`.replace(/\s+/g, " ").trim());
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return; // silence or cancel: not a problem
      const [code, message] = MESSAGES[event.error] ?? ["SPEECH_ERROR", `Listening stopped (${event.error}).`];
      reject(new SpeechError(code, message));
    };
    // The last words often arrive just after stop(), so the text is read when the browser says it's done.
    rec.onend = () => resolve(`${finals.join(" ")} ${finals.length ? "" : interim}`.replace(/\s+/g, " ").trim());
  });
  rec.start();
  return {
    stop: () => (rec.stop(), done),
    cancel: () => rec.abort(),
  };
}

// Engine "vosk": speech recognition that runs INSIDE the browser (Vosk, compiled to WebAssembly).
// Works offline, the audio never leaves the device, and it costs nothing. The catch: a one-time download
// (vosk.js ~6 MB + a language model ~35-45 MB), kept by the browser after the first time.
// Best with a short list of COMMANDS: then it can only hear those words, so "jump" is never heard as "chump".
// Without commands it writes down anything, but less accurately than the browser or cloud engines.
import { voskGrammar } from "./commands.js";
import { getMic, SpeechError, stopMic } from "./mic.js";

const VOSK_SCRIPT = "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js";
const MODELS_AT = "https://ccoreilly.github.io/vosk-browser/models/";

/** The small models the vosk-browser project hosts (CORS-enabled). Sizes are the one-time download. */
export const VOSK_MODELS = {
  es: { file: "vosk-model-small-es-0.3.tar.gz", mb: 33 },
  ca: { file: "vosk-model-small-ca-0.4.tar.gz", mb: 41 },
  en: { file: "vosk-model-small-en-us-0.15.tar.gz", mb: 39 },
  fr: { file: "vosk-model-small-fr-pguyot-0.3.tar.gz", mb: 44 },
  de: { file: "vosk-model-small-de-0.15.tar.gz", mb: 44 },
  it: { file: "vosk-model-small-it-0.4.tar.gz", mb: 33 },
  pt: { file: "vosk-model-small-pt-0.3.tar.gz", mb: 31 },
};

export const voskSupported = () =>
  typeof window !== "undefined" && typeof WebAssembly === "object" && typeof Worker === "function" && Boolean(window.AudioContext ?? window.webkitAudioContext) && Boolean(navigator.mediaDevices?.getUserMedia);

/** The model address for a language ("es-ES" → the Spanish model), or the one you pass. */
export function voskModelUrl(language = "es", modelUrl) {
  if (modelUrl) return modelUrl;
  const model = VOSK_MODELS[language.slice(0, 2).toLowerCase()];
  if (!model) throw new SpeechError("LANGUAGE", `No offline model for "${language}" in the kit. Pick one of: ${Object.keys(VOSK_MODELS).join(", ")}, or pass modelUrl.`);
  return MODELS_AT + model.file;
}

// vosk.js is added to the page once, from the CDN (so there is nothing to install).
let script;
function loadVosk() {
  if (window.Vosk) return Promise.resolve(window.Vosk);
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = VOSK_SCRIPT;
    tag.async = true;
    tag.onload = () => (window.Vosk ? resolve(window.Vosk) : reject(new SpeechError("VOSK_LOAD", "The offline voice library didn't load.")));
    tag.onerror = () => {
      script = undefined; // let a later tap try again
      reject(new SpeechError("VOSK_LOAD", "Couldn't download the offline voice library. Connect to the internet once, then it works offline."));
    };
    document.head.append(tag);
  });
  return script;
}

// One model per address, loaded once per page and cached by the browser after the first download.
const models = new Map();
const ready = new Set();

/** Starts the download early (call it when the page opens), so the first tap is instant. Returns a promise. */
export function preloadVosk({ language = "es", modelUrl } = {}) {
  const url = voskModelUrl(language, modelUrl);
  if (!models.has(url)) {
    const loading = loadVosk()
      .then((Vosk) => Vosk.createModel(url, -1)) // -1: only real errors in the console
      .then((model) => (ready.add(url), model))
      .catch((err) => {
        models.delete(url);
        throw err instanceof SpeechError ? err : new SpeechError("VOSK_LOAD", `Couldn't load the offline voice model (${err?.message ?? err}).`);
      });
    models.set(url, loading);
  }
  return models.get(url);
}

/** True once the model for this language is loaded on this page. */
export const voskReady = ({ language = "es", modelUrl } = {}) => ready.has(voskModelUrl(language, modelUrl));

const clean = (text) => String(text ?? "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim();

/** Starts listening. Returns { stop() → Promise<text>, cancel() }. */
export async function startVosk({ language = "es", commands, modelUrl, onPartial, onState }) {
  if (!voskSupported()) throw new SpeechError("NOT_SUPPORTED", "This browser can't run the offline voice engine.");
  const url = voskModelUrl(language, modelUrl);
  if (!ready.has(url)) onState?.("loading"); // the first time: downloading the model
  const model = await preloadVosk({ language, modelUrl });

  const stream = await getMic();
  const Context = window.AudioContext ?? window.webkitAudioContext;
  const audio = new Context();
  // With commands, the recognizer may only hear those phrases (plus "[unk]" for anything else).
  const grammar = commands ? JSON.stringify(voskGrammar(commands)) : undefined;
  const rec = grammar ? new model.KaldiRecognizer(audio.sampleRate, grammar) : new model.KaldiRecognizer(audio.sampleRate);
  const said = [];
  let last = null; // resolves the final result after stop()
  rec.on("result", (msg) => {
    const text = clean(msg.result?.text);
    if (text) said.push(text);
    onPartial?.(said.join(" "));
    last?.();
  });
  rec.on("partialresult", (msg) => onPartial?.(clean([...said, msg.result?.partial].join(" "))));

  // Feeds the microphone to the recognizer in small slices while the button is held.
  const source = audio.createMediaStreamSource(stream);
  const feeder = audio.createScriptProcessor(4096, 1, 1);
  feeder.onaudioprocess = (event) => rec.acceptWaveform(event.inputBuffer);
  source.connect(feeder);
  feeder.connect(audio.destination); // silent, but some browsers only run the feeder when it's connected
  onState?.("listening");

  const shutdown = () => {
    feeder.disconnect();
    source.disconnect();
    stopMic(stream);
    audio.close().catch(() => {});
  };

  return {
    async stop() {
      shutdown();
      // Ask for the last words, and wait for them (a second at most).
      await new Promise((resolve) => {
        last = resolve;
        setTimeout(resolve, 1000);
        rec.retrieveFinalResult();
      });
      rec.remove();
      return clean(said.join(" "));
    },
    cancel() {
      shutdown();
      rec.remove();
    },
  };
}

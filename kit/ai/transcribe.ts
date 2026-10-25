// Speech to text on the server: audio in, text out, through the app's own OpenRouter key.
//
//   const { text } = await transcribe(audioBytes, { language: "es" });
//
// The browser records (kit/speech, "cloud" engine), the app's server gets the bytes and calls this.
// Browsers record webm (Chrome, Firefox, Edge) or mp4 (Safari, iPhone); both are sent as they are, no converting.
// No key, or AI_PROVIDER=sim: a labelled simulated transcript, so the whole flow works offline.
// Out of AI budget: throws AiBudgetError, like every other kit/ai call.
import { loadEnv } from "./env.ts";
import { budgetError } from "./llm.ts";
import { env, transcribeModel } from "./models.ts";

const OPENROUTER_STT = "https://openrouter.ai/api/v1/audio/transcriptions";

export interface TranscribeOptions {
  /** What the person speaks: "es", "ca", "en" (or "es-ES"…). Leave it out to let the model guess. */
  language?: string;
  /** "fast" (default) or "best". Both are cheap; "best" handles more languages and harder audio. */
  quality?: "fast" | "best";
  /** The audio's type, e.g. "audio/webm". Only needed when the bytes can't tell (rare). */
  mimeType?: string;
}

export interface TranscribeResult {
  text: string;
  model: string;
  ms: number;
  cost: number;
  /** Seconds of audio heard. */
  seconds: number;
  simulated: boolean;
}

/** Which audio format these bytes are, from their first bytes (the file name or browser label can lie). */
export function audioFormat(bytes: Uint8Array, mimeType = ""): "webm" | "m4a" | "ogg" | "wav" | "mp3" | "flac" | null {
  const head = (start: number, text: string) => [...text].every((c, i) => bytes[start + i] === c.charCodeAt(0));
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm"; // Chrome, Firefox, Edge
  if (head(4, "ftyp")) return "m4a"; // Safari and iPhone record mp4 audio
  if (head(0, "OggS")) return "ogg";
  if (head(0, "RIFF") && head(8, "WAVE")) return "wav";
  if (head(0, "fLaC")) return "flac";
  if (head(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "mp3";
  // Some recorders write a header the checks above miss; trust a clear audio type as the last resort.
  const fromType = mimeType.match(/audio\/(webm|mp4|ogg|wav|mpeg|flac)/)?.[1];
  return fromType ? ({ webm: "webm", mp4: "m4a", ogg: "ogg", wav: "wav", mpeg: "mp3", flac: "flac" } as const)[fromType as "webm"] : null;
}

/** Turns speech into text. `audio` is the recording's bytes (a Buffer or Uint8Array). */
export async function transcribe(audio: Uint8Array, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
  loadEnv();
  const format = audioFormat(audio, opts.mimeType);
  if (!format) throw Object.assign(new Error("That doesn't look like an audio recording."), { status: 415 });
  const language = opts.language?.slice(0, 2).toLowerCase() || undefined; // "es-ES" → "es"
  const model = transcribeModel(opts.quality);

  if (env("AI_PROVIDER") === "sim" || !env("OPENROUTER_API_KEY")) {
    const kb = Math.round(audio.length / 1024);
    return { text: `[Simulated transcript] ${kb} KB of ${format} audio${language ? ` in "${language}"` : ""}`, model: "sim/transcribe", ms: 0, cost: 0, seconds: 0, simulated: true };
  }

  const t0 = Date.now();
  const res = await fetch(OPENROUTER_STT, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input_audio: { data: Buffer.from(audio).toString("base64"), format }, ...(language && { language }) }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await res.json().catch(() => null);
  const budget = budgetError(res.status, json);
  if (budget) {
    console.error(JSON.stringify({ level: "error", message: `AI budget: ${budget.message}`, kind: "ai-budget", status: res.status, resets_at: budget.resetsAt }));
    throw budget;
  }
  if (!res.ok || json?.error) throw new Error(`OpenRouter ${res.status} (transcribe, ${model}): ${json?.error?.message ?? "request failed"}`);
  return { text: String(json.text ?? "").trim(), model, ms: Date.now() - t0, cost: json.usage?.cost ?? 0, seconds: json.usage?.seconds ?? 0, simulated: false };
}

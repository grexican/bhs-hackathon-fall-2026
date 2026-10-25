// Engine "cloud": record in the browser, send it to YOUR server (POST /api/transcribe, transcribe-route.mjs),
// which asks the AI with the app's own key. Accurate, any language, any modern browser (Firefox too).
// Costs a little of the app's AI budget (about a third of a cent per minute of talking). Text appears after you stop.
import { getMic, SpeechError, stopMic } from "./mic.js";

export const cloudSupported = () => typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// Chrome, Edge and Firefox record webm; Safari and iPhones record mp4. The server takes both as they are.
const pickType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));

/** Starts recording. Returns { stop() → Promise<{ text, simulated }>, cancel() }. */
export async function startCloud({ language, quality, endpoint = "/api/transcribe", maxSeconds = 120, onState }) {
  if (!cloudSupported()) throw new SpeechError("NOT_SUPPORTED", "This browser can't record audio.");
  const stream = await getMic();
  const type = pickType();
  // 32 kbps is plenty for a voice: 2 minutes stays under half a megabyte.
  const recorder = new MediaRecorder(stream, { ...(type && { mimeType: type }), audioBitsPerSecond: 32_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start(250); // a chunk every 250 ms, so even a short tap captures something
  const limit = setTimeout(() => recorder.state === "recording" && recorder.stop(), maxSeconds * 1000); // a forgotten recording stops itself

  const finish = async () => {
    clearTimeout(limit);
    if (recorder.state === "recording") recorder.stop();
    await stopped;
    stopMic(stream);
  };

  return {
    async stop() {
      await finish();
      const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" });
      if (blob.size < 1000) throw new SpeechError("NO_SPEECH", "That was too short. Hold the button while you speak.");
      onState?.("working");
      const query = new URLSearchParams({ ...(language && { language }), ...(quality && { quality }) });
      const res = await fetch(`${endpoint}?${query}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const json = await res.json().catch(() => ({}));
      // Errors (like "the AI budget is used up") come back as { error }: pass the message on, don't break.
      if (!res.ok) throw new SpeechError(json.code ?? `HTTP_${res.status}`, json.error ?? "Couldn't turn that into text right now.");
      return { text: json.text ?? "", simulated: Boolean(json.simulated), note: json.note };
    },
    cancel: () => void finish(),
  };
}

// Asks for the microphone, with a plain-English message for each way it can fail.
// The browser only asks after a tap or a key press, and only on https:// or localhost.

/** A speech error a person can read. `code` lets the app react: NOT_SUPPORTED, MIC_BLOCKED, NO_MIC, NEEDS_HTTPS, NO_SPEECH… */
export class SpeechError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SpeechError";
    this.code = code;
  }
}

export async function getMic() {
  if (!window.isSecureContext) throw new SpeechError("NEEDS_HTTPS", "The microphone only works on https:// (or localhost). Open the online version of the app.");
  if (!navigator.mediaDevices?.getUserMedia) throw new SpeechError("NOT_SUPPORTED", "This browser can't use the microphone.");
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError")
      throw new SpeechError("MIC_BLOCKED", "The microphone is blocked. Allow it (tap the icon next to the address), then try again.");
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") throw new SpeechError("NO_MIC", "No microphone found. Plug one in or try another device.");
    if (err.name === "NotReadableError") throw new SpeechError("MIC_BUSY", "Another app is using the microphone. Close it and try again.");
    throw new SpeechError("MIC_ERROR", `Couldn't open the microphone (${err.message}).`);
  }
}

/** Turns the microphone off (the red dot in the tab goes away). */
export const stopMic = (stream) => stream?.getTracks().forEach((track) => track.stop());

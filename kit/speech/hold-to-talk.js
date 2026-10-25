// A "hold to talk" button: press and hold (finger, mouse, or Space/Enter on the keyboard), speak, let go.
// Works with any engine from listen.js. Plain JavaScript; HoldToTalk.tsx wraps it for React.
//
//   <button id="talk">Hold to talk</button>  <p id="said" aria-live="polite"></p>
//   import { holdToTalk } from "./speech/hold-to-talk.js";
//   holdToTalk(document.querySelector("#talk"), {
//     engine: "browser", language: "es-ES",
//     onPartial: (text) => (said.textContent = text),          // live words (browser and vosk engines)
//     onResult: ({ text, command }) => (said.textContent = text),
//     onError: (err) => (said.textContent = err.message),     // already a plain-English message
//   });
//
// The button gets data-state="idle | loading | listening | working" and aria-pressed while listening:
// style it with CSS, e.g. button[data-state="listening"] { background: crimson; }
import { listen } from "./listen.js";

const LABELS = {
  idle: "Hold to talk",
  loading: "Loading the voice model…",
  listening: "Listening… let go to stop",
  working: "Writing it down…",
};

/** Turns a <button> into a hold-to-talk button. Returns { destroy() } to remove it again. */
export function holdToTalk(button, { onResult, onPartial, onError, onState, labels = LABELS, ...listenOptions } = {}) {
  let session = null;
  let starting = null;
  let released = false;
  let pressedAt = 0;

  const setState = (state) => {
    button.dataset.state = state;
    button.setAttribute("aria-pressed", String(state === "listening"));
    if (labels && labels[state]) button.textContent = labels[state];
    onState?.(state);
  };

  const fail = (err) => {
    setState("idle");
    if (onError) onError(err);
    else console.error(err);
  };

  async function press(event) {
    event.preventDefault();
    if (session || starting) return;
    released = false;
    pressedAt = Date.now();
    starting = listen({ ...listenOptions, onPartial, onState: setState })
      .then((started) => {
        session = started;
        if (released) release(); // let go before the microphone was ready
      })
      .catch(fail)
      .finally(() => (starting = null));
  }

  async function release() {
    released = true;
    if (!session) return; // still starting: press() stops it once it's ready
    const current = session;
    session = null;
    // A quick tap instead of a hold: say how it works rather than sending half a second of nothing.
    if (Date.now() - pressedAt < 300) {
      current.cancel();
      return fail(Object.assign(new Error("Hold the button while you speak, then let go."), { code: "TAP" }));
    }
    try {
      onResult?.(await current.stop());
    } catch (err) {
      fail(err);
    }
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return; // left click or a finger only
    button.setPointerCapture?.(event.pointerId); // keeps listening if the finger slides off the button
    press(event);
  };
  const onPointerUp = () => (session || starting) && release();
  const onKeyDown = (event) => (event.key === " " || event.key === "Enter") && !event.repeat && press(event);
  const onKeyUp = (event) => (event.key === " " || event.key === "Enter") && release();
  const noMenu = (event) => event.preventDefault(); // a long press on a phone would open a menu

  button.type = "button";
  button.style.touchAction = "none";
  button.style.userSelect = "none";
  button.style.webkitUserSelect = "none";
  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointerup", onPointerUp);
  button.addEventListener("pointercancel", onPointerUp);
  button.addEventListener("keydown", onKeyDown);
  button.addEventListener("keyup", onKeyUp);
  button.addEventListener("contextmenu", noMenu);
  setState("idle");

  return {
    destroy() {
      session?.cancel();
      button.removeEventListener("pointerdown", onPointerDown);
      button.removeEventListener("pointerup", onPointerUp);
      button.removeEventListener("pointercancel", onPointerUp);
      button.removeEventListener("keydown", onKeyDown);
      button.removeEventListener("keyup", onKeyUp);
      button.removeEventListener("contextmenu", noMenu);
    },
  };
}

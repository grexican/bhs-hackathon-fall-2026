# Speech to text: voice input for your app

Hold a button, talk, let go: your app gets the words. Three engines behind one call. You choose.

## Which engine?

| | **browser** | **cloud** | **vosk** (offline) |
|---|---|---|---|
| What it is | The browser's own recognizer | Your server sends the recording to an AI model | A recognizer that runs inside the page |
| Cost | Free | From the app's AI budget: about $0.0035 a minute of talking (a $5 budget is about 1,400 minutes) | Free |
| Accuracy | Good for normal speech | Best: handles accents, noise, names | Very good for a short list of commands; fine for clear free talking, weaker with noise and accents |
| Languages | Spanish, Catalan, English and many more | Spanish, Catalan, English and 90+ more | Spanish (33 MB model), Catalan (41 MB), English (39 MB), French, German, Italian, Portuguese |
| Words while you talk | Yes, live | No: the text comes about half a second after you let go | Yes, live |
| Works offline | No | No | Yes, after the first load |
| Privacy | Chrome sends the audio to Google; Safari to Apple | The audio goes to your server, then to the AI provider | The audio never leaves the device |
| First load | Nothing | Nothing | About 6 MB of code + the language model, once (the browser keeps it) |
| Browsers | Chrome, Edge, Safari (iPhone with iOS 14.5+). **Not Firefox** | Every modern browser, Firefox too | Every modern browser on a laptop; on phones it works, but the download is big on mobile data |
| Best for | Dictation, chat input, notes, a quick demo | Voice notes, interviews, any language, when it must be right | Games and apps you control by voice: "salta", "dispara", "izquierda" |

- **Pick browser if** you want it working in five minutes, for free, and your testers use Chrome or Safari.
- **Pick cloud if** what people say must come out right (names, Catalan, noise), or they use Firefox.
- **Pick vosk if** your app has a fixed set of voice commands, or must work offline or privately.

Not sure? Use `engine: "auto"`: browser where it exists, cloud everywhere else.

## Setup (about 5 minutes)

**1. Add the files to your app** (from the kit's main folder, with your app's codename):

```bash
node scripts/add-kit.mjs speech my-app
```

It copies the speech files into your app (`public/speech/` in a plain app, `src/lib/speech/` in a React app),
the server route into `locker/`, and adds two import lines and one route line to your `server.js`.
Restart `npm run dev`. (The cloud engine needs those server lines; browser and vosk don't use the server.)

**2. Put a hold-to-talk button on a page.**

Plain HTML (`public/index.html`):

```html
<button id="talk">Hold to talk</button>
<p id="said" aria-live="polite"></p>
<script type="module">
  import { holdToTalk } from "/speech/hold-to-talk.js";
  const said = document.querySelector("#said");
  holdToTalk(document.querySelector("#talk"), {
    engine: "browser",          // or "cloud", "vosk", "auto"
    language: "es-ES",          // or "ca-ES", "en-US"
    onPartial: (text) => (said.textContent = text),
    onResult: ({ text }) => (said.textContent = text),
    onError: (err) => (said.textContent = err.message),
  });
</script>
```

React (`src/App.tsx`):

```tsx
import { HoldToTalk } from "@/lib/speech/HoldToTalk"

<HoldToTalk engine="browser" language="es-ES" onResult={({ text }) => setText(text)} />
```

**3. Try it.** Open the app, hold the button, say something, let go. The first time, the browser asks
for the microphone: allow it.

### Voice commands (games)

Give a list of commands. Every engine then tells you which one was said (`command`), and vosk can
**only** hear those words, so it doesn't mishear them:

```js
holdToTalk(button, {
  engine: "vosk",
  language: "es-ES",
  commands: { left: ["izquierda", "esquerra"], right: ["derecha", "dreta"], fire: ["dispara"], jump: ["salta"] },
  onResult: ({ command }) => command && game.do(command),   // "left", "right", "fire", "jump" or null
});
```

A plain list works too: `commands: ["salta", "dispara", "pausa"]`. Accents and capitals don't matter.
Vosk only knows real words of its language: "salta" works, a made-up word like "zorbix" doesn't.

Start the vosk download when the page opens, so the first press is instant:

```js
import { preloadVosk } from "/speech/listen.js";
preloadVosk({ language: "es-ES" });
```

### Without the button

```js
import { listen } from "/speech/listen.js";
const session = await listen({ engine: "cloud", language: "ca-ES" });   // after a tap
// …later
const { text, command, simulated } = await session.stop();
```

`speechSupport()` says what this browser can do (`{ browser, cloud, vosk, secure }`), so you can hide
a button or pick an engine. `LANGUAGES` is a ready list for a language picker (Español, Català, English).

## Good to know

- **It needs a tap.** Browsers never let a page listen on its own. The button is the tap.
- **https or localhost only.** On a phone, open the online version (after `/ship`), not your laptop's `http://192.168…` address: the microphone is blocked there.
- **Style the button by state.** It gets `data-state="idle | loading | listening | working"` and `aria-pressed`:
  `button[data-state="listening"] { background: crimson; }`. Space and Enter work too (hold the key).
- **Cloud limits:** 2 minutes per recording (the recorder stops itself), 10 MB, 10 recordings a minute
  per person. Chrome and Firefox send webm, Safari and iPhones send mp4: the server takes both as they are, no converting.
- **Cloud with no key yet** (before `/connect`): you get a labelled `[Simulated transcript]`, and
  `simulated: true`. Show a small "Simulated" tag.
- **AI budget used up:** the cloud engine's error says so in plain words (`err.code === "AI_BUDGET_USED_UP"`).
  Show `err.message`, and maybe switch to `engine: "browser"`.
- **Errors are already friendly.** `err.message` is written for a person ("The microphone is blocked. Allow
  it…"). `err.code` is for your code: `NOT_SUPPORTED`, `MIC_BLOCKED`, `NO_MIC`, `NEEDS_HTTPS`, `NO_SPEECH`, `OFFLINE`, `LANGUAGE`, `TAP`.
- **Under 18 users:** voice is personal data. Don't save recordings. Save the text only if your app needs it.

## Testing

Test by hand first: open the app, hold the button, talk. To test with no microphone (or in an automated
test), start Chrome with a recording as the microphone:

```bash
chrome --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=clip.wav
```

(`clip.wav`: a short wav with a second of silence first.) That works for **cloud** and **vosk**. The **browser**
engine hears the fake microphone but returns no words under automation (Chrome's recognizer only answers in a
normal browser window), so test it by hand.

## The files

| File | What it does |
|---|---|
| `listen.js` | The one call: `listen({ engine, language, commands })`, plus `speechSupport`, `LANGUAGES`, `preloadVosk` |
| `listen.d.ts` · `hold-to-talk.d.ts` | Types for TypeScript (React apps get them automatically) |
| `hold-to-talk.js` | The hold-to-talk button for plain HTML |
| `HoldToTalk.tsx` | The same button for React |
| `engine-browser.js` · `engine-cloud.js` · `engine-vosk.js` | One file per engine |
| `commands.js` | Matches what was said to your commands |
| `mic.js` | Asks for the microphone, with friendly errors |
| `transcribe-route.mjs` | Server: `POST /api/transcribe`, calls `transcribe()` from the AI kit |

The AI part lives in the AI kit: `transcribe(audio, { language, quality })` in `kit/ai/transcribe.ts`.
Models: `fast` = `mistralai/voxtral-mini-transcribe-3-0`, `best` = `elevenlabs/scribe-v2`. Swap in `.env` with
`MODEL_TRANSCRIBE=…` / `MODEL_TRANSCRIBE_BEST=…`. Try one from the terminal:
`npm run ai -- transcribe clip.webm es`.

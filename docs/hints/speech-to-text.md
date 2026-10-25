# Hint: let people talk to your app (speech to text)

Your app can listen: a person holds a button, talks, lets go, and your app gets the words. The hackathon
kit already has all of it. You only choose an engine and add a button.

## 1. Choose an engine

| | Browser | Cloud | Offline (Vosk) |
|---|---|---|---|
| Cost | Free | A tiny bit of your app's AI budget (about 1,400 minutes of talking for $5) | Free |
| Accuracy | Good | The best | Very good for a few fixed commands |
| Spanish / Catalan / English | Yes / Yes / Yes | Yes / Yes / Yes (and 90+ more) | Yes / Yes / Yes (one download per language: 33–41 MB) |
| Words appear while you talk | Yes | No, right after you let go | Yes |
| Works with no internet | No | No | Yes (after the first load) |
| Where the voice goes | Google (Chrome) or Apple (Safari) | Your server, then the AI company | Nowhere: it stays on the phone or laptop |
| Browsers | Chrome, Edge, Safari. **Not Firefox** | All | All (big download on mobile data) |

- **Browser**: you want it working in five minutes, for free.
- **Cloud**: what people say must come out right (names, Catalan, a noisy room), or people use Firefox.
- **Offline (Vosk)**: your app listens for a few commands ("salta", "dispara", "pausa"), like a game, or it must work without internet or keep voices private.

Can't decide? Pick `auto`: it uses the browser engine when it can and the cloud one when it can't.

## 2. Add it to your app

In the kit's main folder, run this once (put your app's codename instead of `my-app`):

```bash
node scripts/add-kit.mjs speech my-app
```

Then restart your app (`npm run dev`). Or just tell your AI assistant: *"Add voice input with the kit's speech
toolkit, engine browser, language Spanish."*

## 3. Add the button

**Plain HTML app** (in `public/index.html`):

```html
<button id="talk">Hold to talk</button>
<p id="said"></p>
<script type="module">
  import { holdToTalk } from "/speech/hold-to-talk.js";
  holdToTalk(document.querySelector("#talk"), {
    engine: "browser",        // "browser", "cloud", "vosk" or "auto"
    language: "es-ES",        // "ca-ES" for Catalan, "en-US" for English
    onPartial: (text) => (document.querySelector("#said").textContent = text),
    onResult: (result) => (document.querySelector("#said").textContent = result.text),
    onError: (error) => (document.querySelector("#said").textContent = error.message),
  });
</script>
```

**React app** (in `src/App.tsx`):

```tsx
import { HoldToTalk } from "@/lib/speech/HoldToTalk"

<HoldToTalk engine="browser" language="es-ES" onResult={(result) => setText(result.text)} />
```

**A game with voice commands:**

```js
holdToTalk(button, {
  engine: "vosk",
  language: "es-ES",
  commands: { left: ["izquierda", "esquerra"], right: ["derecha", "dreta"], jump: ["salta"] },
  onResult: (result) => { if (result.command === "jump") player.jump(); },
});
```

## 4. Try it

Open your app, **hold** the button, talk, let go. The first time, the browser asks to use the microphone: say yes.

## When something goes wrong

| What you see | Why, and the fix |
|---|---|
| "The microphone is blocked" | You said no once. Click the icon next to the web address, allow the microphone, try again. |
| Nothing happens on your phone | Phones only allow the microphone on `https://`. Use your app's online address (after you put it online), not your laptop's `http://192.168…`. |
| "This browser can't listen by itself" | That's Firefox. Use Chrome, Edge or Safari, or switch to the `cloud` engine. |
| "Hold the button while you speak" | You tapped. Press and **hold** while you talk. |
| `[Simulated transcript]` | The cloud engine has no AI key yet. Connect your app to the incubator first. |
| "AI budget … used up" | Your app spent its monthly AI money. Ask an organizer, or switch to `browser` or `vosk`. |
| Vosk takes long the first time | It downloads the voice model once (about 40 MB). After that it starts fast, even offline. |
| Vosk hears the wrong word | Give it a `commands` list: then it can only hear those words. Use real words, not made-up ones. |

**Be kind with voices.** Your users are students. Don't save recordings; save the text only if your app needs it.

Full details: `kit/speech/README.md` in the kit.

---
name: speech-to-text
description: Voice input for the student's app - talk instead of typing, dictation, voice notes, voice commands for a game ("say jump"), a hold-to-talk or push-to-talk button, transcribing recordings, in Spanish, Catalan or English. The kit already has it - kit/speech (three engines behind one call - the browser's own recognizer, cloud transcription through the app's AI key, or offline Vosk in the page - plus a hold-to-talk button) and transcribe() in kit/ai. Use whenever a feature needs a microphone turned into text.
---

# Speech to text: use the kit, don't build it

Everything is in `kit/speech/` (README.md there has the full guide). Don't write speech code from scratch.

1. **Pick the engine with the student** using the table at the top of `kit/speech/README.md`. Ask the
   one question that decides it: "Does your app listen for a few fixed commands, or for anything people say?"
   - Fixed commands (games, controls), or must work offline/privately → `vosk`, with a `commands` list.
   - Anything people say, testers on Chrome/Safari, free → `browser`.
   - Must be right (names, Catalan, noise), or Firefox → `cloud` (costs a little of the AI budget).
   - Unsure → `auto`.
2. **Add it:** `node scripts/add-kit.mjs speech <codename>` (copies the files, wires `server.js`). Restart `npm run dev`.
3. **Put the button on the page:** `holdToTalk(button, {...})` (plain HTML) or `<HoldToTalk />` (React), from README step 2.
4. **Prove it:** hold the button and talk in the browser (`verify-in-browser`). For a check with no microphone,
   README "Testing" shows the fake-microphone Chrome flags.

Rules: it starts only from a tap; https or localhost only (a phone on the laptop's `http://192.168…` gets no
microphone, so test phones on the `/ship` version); show `err.message` (already friendly); never save recordings
of under-18 users, only the text if the app needs it. Student-facing hint sheet: `docs/hints/speech-to-text.md`.

---
name: pitch
description: Get the student ready to present their app at a demo or Demo Day - a spoken pitch (problem, who, live demo of the one main thing, what's next), a slide-by-slide deck built from real screenshots of their app (presenter mode, speaker notes, one key to jump into the live demo, works offline), a demo path that can't break on stage, and a timed rehearsal. Writes apps/<codename>/docs/pitch.md, docs/pitch.json and pitch/index.html. Use when a student types /pitch, says "I have to present", "demo day", "help me pitch", "make slides", "make a deck", "what do I say", or the event is in its last few hours. Not the /demo workshop (that one compares two builds).
argument-hint: "[codename] [how many minutes]"
---

# /pitch: show it off without it breaking

People remember one thing from a demo: the moment the app did something they wanted. The pitch
sets up that moment, shows it, and gets out. The slides are there to frame the live demo, not to
replace it: the real interaction happens **in the app**, and the deck shows the screenshots,
the story and the proof around it. Short lines, one question at a time.

## 1. Two questions

1. **"How long do you get?"** (Don't know? Plan for 2 minutes. Shorter is always fine.)
2. **"Who's watching, and what do you want from them?"** (Judges: a prize. Classmates: users.
   Teachers or parents: help or a mentor.) That decides the last slide.

Read `apps/<codename>/docs/idea.md` and `docs/feedback.md` (from `/playtest`) if they exist. Real
tester quotes and real "we saw this, so we changed that" beat anything you could write. No
playtests yet and there's time? Say so: one round of `/playtest` makes a much stronger pitch.

## 2. Write what they'll say (one idea per beat)

| Beat | Time (2 min) | What it says |
|---|---|---|
| Hook | 15 s | The problem as a moment everyone in the room has lived. ("It's 12:40, the line is out the door, and you don't know if there's pasta left.") No "Hi, my app is called…" first. |
| Who | 10 s | Who it's for, and one real fact or quote. A tester's words are perfect here. |
| Demo | 60 s | **Live**, the one main thing, start to finish. Say what you're doing as you tap. |
| Why it's different | 15 s | What's new compared with what people do now. What playtests made you change goes here. |
| Next + ask | 20 s | What you'll build next, and exactly what you want from this audience. |

Longer slot? Make the demo longer, not the talking. Write it to `apps/<codename>/docs/pitch.md` as
what they'll actually **say**, in their own voice. Cut every sentence that isn't needed. Ask:
"Does this sound like you?" and fix what doesn't.

## 3. Build the deck

The deck is one HTML file, built by a script from `docs/pitch.json`. **You write the words and pick
the moments; the script takes the pictures and draws the slides.** Never hand-write slide HTML.
The shape of `pitch.json`, every slide kind and a full example: `references/pitch-json.md`.

1. **Plan the slides from the beats**: usually 5 to 7. Title → hook (`big`) → one or two `shot`
   slides → `demo` → proof (`quote`, `changes`, `numbers`) → `ask`. Each slide's `say` is that
   part of `pitch.md`: it becomes the speaker notes.
2. **Pick the screenshots as goals.** Each shot says what the picture must *prove* ("the quiz
   catching the one you got wrong"), not just which page. Give it the steps to get there and an
   `expect` text that is only on that screen. Phone size unless the app is a laptop app.
3. **Take them** with the app running: `npm run pitch -- shots <codename>` (it uses `local`
   in pitch.json, or `--url http://localhost:<port>`). Fill the app with real-looking data first,
   so no screen is empty.
4. **Look at every picture** (open the .jpg files in `apps/<codename>/pitch/shots/`). Does it
   prove its goal? Wrong screen, a spinner, an error, an empty list: fix the steps and take it again.
   The script already refuses two shots that came out identical.
5. **Build**: `npm run pitch -- build <codename>`. It prints ✗ for anything wrong and – for
   anything weak; fix the ✗ lines. Colors come from `brand/tokens.css` (`/branding`) or `theme`
   in pitch.json; the logo from `brand/` or the app's icon.
6. **See it**: `npm run pitch -- look <codename>` saves a picture of every slide in
   `pitch/look/`. Look at each one. Too much text, something cut off, a wrong picture? Fix and build
   again. Every slide should be readable from the back of the room. Then the student opens
   `apps/<codename>/pitch/index.html` (double-click works) and clicks through it.
7. **Fresh eyes**: give a subagent (or a new chat) only the deck and ask "What does this app do,
   for whom, and what's the moment?". A wrong answer means the pitch is unclear: fix the slides.

**Presenting** (tell the student): → or click to go on, ← to go back, **F** full screen,
**P** opens a presenter window (notes, next slide, timer) for the laptop screen while the deck is on
the projector, **N** shows notes on one screen, **D** opens the live app for the demo. Come back to
the deck tab when the demo is done. `npm run pitch -- build <codename> --publish` also puts it at
`/pitch.html` on their app, so the deck itself can be shared after `/ship`.

**The honesty floor.** Numbers and quotes only from `docs/feedback.md` or the app's real data;
every `numbers` slide names its `source`. No made-up users, no "1,000 downloads" that didn't happen.
A small true number ("4 of 6 testers finished without help") beats a big invented one.

## 4. Make the demo path unbreakable

Go through the demo steps once and fix or avoid anything that could fail on stage:

- **Use the live address** (after `/ship`), already open in a tab, already signed in. No typing passwords on stage.
- **Real-looking data** already in the app (seed data), so the first screen isn't empty.
- **AI steps:** anything that takes more than about 3 seconds needs a loading state that looks
  intentional. Check `npm run locker:status` so the AI budget isn't used up.
- **Phone demo?** Practise with screen mirroring before, or demo from the laptop at phone size.
- **Backup:** the `demo` slide's `backup` shots are the plan B: if anything breaks, say "here's
  what it looks like" and go on. A 30–60 s screen recording of the demo path is even better.
  If the Wi-Fi dies, the deck still works: everything is inside the file.

Run `reality-checker` on the demo path: no fake buttons, no fake numbers presented as real.

## 5. Rehearse

Ask them to present it out loud with the deck and a timer (the presenter window has one; **T**
restarts it), twice. Over time? Cut words or slides, not the demo. Common fixes: skip the tech
("I used React and…" nobody needs it), say the problem as a story, and stop talking while the app
does its moment. Last check: the first and the last sentence, memorised.

Suggest `/wrap` to save `pitch.md`, `pitch.json` and the deck.

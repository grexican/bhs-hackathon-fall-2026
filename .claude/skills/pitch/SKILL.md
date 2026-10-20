---
name: pitch
description: Get the student ready to present their app at a demo or Demo Day - a short spoken pitch (problem, who, live demo of the one main thing, what's next), a demo path that can't break on stage, a backup if the Wi-Fi dies, and a timed rehearsal. Writes apps/<codename>/docs/pitch.md. Use when a student types /pitch, says "I have to present", "demo day", "help me pitch", "what do I say", or the event is in its last few hours. Not the /demo workshop (that one compares two builds).
argument-hint: "[codename] [how many minutes]"
---

# /pitch: show it off without it breaking

People remember one thing from a demo: the moment the app did something they wanted. The pitch is
there to set up that moment, show it, and get out. Short lines, one question at a time.

## 1. Two questions

1. **"How long do you get?"** (Don't know? Plan for 2 minutes. Shorter is always fine.)
2. **"Who's watching, and what do you want from them?"** (Judges: a prize. Classmates: users.
   Teachers or parents: help or a mentor.) That decides the last line.

Read `apps/<codename>/docs/idea.md` and `docs/feedback.md` if they exist. Real quotes from testers
beat anything you could write.

## 2. Write it (one idea per beat)

Each beat says **one** thing. For a 2-minute pitch:

| Beat | Time | What it says |
|---|---|---|
| Hook | 15 s | The problem as a moment everyone in the room has lived. ("It's 12:40, the line is out the door, and you don't know if there's pasta left.") No "Hi, my app is called…" first. |
| Who | 10 s | Who it's for, and one real fact or quote. A tester's words are perfect here. |
| Demo | 60 s | **Live**, the one main thing, start to finish. Say what you're doing as you tap. |
| Why it's different | 15 s | The one thing that's new compared with what people do now. |
| Next + ask | 20 s | What you'll build next, and exactly what you want from this audience. |

Longer slot? Make the demo longer, not the talking. Write it to `apps/<codename>/docs/pitch.md` as
what they'll actually **say**, in their own voice. Read it back and cut every sentence that isn't
needed. Ask: "Does this sound like you?" and fix what doesn't.

Then check it with fresh eyes: give a subagent (or a new chat) only `pitch.md` and ask "What does
this app do, and for whom?". If its answer is wrong, the pitch is unclear. Fix it.

## 3. Make the demo path unbreakable

Go through the demo steps once and fix or avoid anything that could fail on stage:

- **Use the live address** (after `/ship`), already open in a tab, already signed in. No typing passwords on stage.
- **Real-looking data** already in the app (seed data), so the first screen isn't empty.
- **AI steps:** anything that takes more than about 3 seconds needs a loading state that looks
  intentional. Check `npm run locker:status` so the AI budget isn't used up.
- **Phone demo?** Practise with screen mirroring before, or demo from the laptop at phone size.
- **Backup:** record a 30–60 s screen video of the demo path and take 3 screenshots
  (`npm run shot -- <url>`). If anything breaks on stage, say "here's a recording" and keep going.
- Put the link on the last screen or a QR code (`npx -y qrcode -o tmp/qr.png "<url>"`) so people can try it right away.

Run `reality-checker` on the demo path: no fake buttons, no fake numbers presented as real.

## 4. Rehearse

Ask them to say it out loud with a timer, twice. Over time? Cut words, not the demo. Common fixes:
skip the tech ("I used React and…" nobody needs it), say the problem as a story, and stop talking
while the app does its moment. Last check: the first and the last sentence, memorised.

Suggest `/wrap` to save `pitch.md`.

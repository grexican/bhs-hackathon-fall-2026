---
name: pitch
description: Get the student ready to pitch their app, through Pitch Lab (the school's pitch coach at pitch-lab.apps.bhslabs.org). Connects the editor to Pitch Lab's MCP server (the pitch-lab tools), starts a new pitch or continues one, feeds it what only the code knows (what really works, what's simulated, the live address, real numbers, playtest quotes), then sends the student to Pitch Lab to be grilled by the people they'll pitch to and to get a deck they can present and share. Then makes the live demo unbreakable and rehearses it. Use when a student types /pitch, says "I have to present", "demo day", "help me pitch", "make slides", "make a deck", "what do I say", or the event is in its last few hours. Not the /demo workshop (that one compares two builds).
argument-hint: "[codename]"
---

# /pitch: from your app to a pitch that lands

**Pitch Lab** is the school's pitch coach: the student sets the pitch up, adds context, gets **grilled**
by the people they'll pitch to (three hard questions a round, judged honestly), then it writes a deck
they can present full screen and share with a link. Your job is the part only you can do: **you can
read the code**, so you tell Pitch Lab what the app really does. The student's job is the thinking.

**The one rule: you never answer the Grill.** Not in the chat, not in Pitch Lab, not as a "draft for
them to edit". The questions are how they learn to defend their idea; an answer you wrote teaches
nothing and the judges will hear it. You *can* find facts in the code when a question needs one.

Short lines, one question at a time.

## 1. Connect Pitch Lab (once per laptop)

Pitch Lab is an MCP server (`https://pitch-lab.apps.bhslabs.org/mcp`), already listed as `pitch-lab` in the
kit's `.cursor/mcp.json` and `.mcp.json`. The first time, the editor signs in to it:

- **Cursor:** Settings → MCP (Tools & Integrations): **pitch-lab** shows a Connect / Needs login button. Click it.
- **Claude Code:** `/mcp` → **pitch-lab** → Authenticate.
- The browser opens Pitch Lab: the student signs in with their school account and clicks **Allow**. Then the
  tools work: `pitch_list`, `pitch_create`, `pitch_add_source`, `pitch_status`, `pitch_update_setup`.
- **pitch-lab** not listed at all? The kit is older than this: `git pull origin main`, then reload the editor.

The same server works in ChatGPT, Claude, Gemini and any AI app that takes MCP servers; the Pitch Lab home page
shows how, for students who aren't in the kit.

## 2. New pitch, or carry on?

`pitch_list`. One for this app already? `pitch_status` on it and pick up where it stands (step 3 if it
has no context from the code yet, else step 4 or 5). Pitching the same app to a different audience is
a new pitch; Pitch Lab can also copy one for a new audience from the pitch's Setup step.

New pitch: ask, one at a time, and **write down their words, don't polish them**:

1. "What's it called?"
2. "In one or two sentences: what does it do, and why does it matter?" (their words go in `idea`)
3. "Who are you pitching to, and what do you want from them?" (judges: a prize; classmates: users;
   the school: a yes; investors: money) → `audience`, `audience_detail`, `goal`
4. "How long do you get?" (don't know: 3 minutes)

Then `pitch_create`.

## 3. Context: what only the code knows (your part)

Students forget half of what they built, and undersell the rest. Read `apps/<codename>/`: `docs/idea.md`,
`docs/feedback.md` (from `/playtest`), the README, the screens and routes, the seed data, the providers
(real or simulator), and `locker_status` if it's on the Locker. Write **one note**,
"What <App> does today (from its code)":

- What works end to end, in user words ("you see the wait before you leave class"), most important first.
- What's **simulated** (payments, messages, AI on the simulator), labelled as simulated. Never present
  a simulator as real.
- The live address after `/ship`, and real numbers with where they come from (Locker users, playtest
  counts). No number you can't point to.
- Playtest quotes, word for word, with who said them ("Year 9 tester").
- What's next on their list, if `docs/` says.

Show it to the student first: "This is what I'll tell Pitch Lab about your app. Anything wrong or
missing?" Fix it, then `pitch_add_source` (a note: `title` + `text`). Live already? Add the address
too (`pitch_add_source` with `url`). The Grill starts from these, so it asks about what's missing
instead of what the app already shows.

## 4. The Grill: theirs, in Pitch Lab

Send them to the Grill link from the tools (`…/p/<id>?step=grill`). Tell them how it works: each round
is three questions from people in their audience; they answer in their own words, then **Judge my
answers** for honest verdicts and pushback; two or three rounds make a strong pitch. **Hints** and
**Structure** buttons help when they're stuck, without answering for them.

While they're there, you help only like this:

- A question needs a fact from the code ("how many screens", "what happens offline")? Find it, tell
  them, and if it's useful later, add it to the note (`pitch_add_source`).
- A question needs evidence nobody has ("would anyone use it?")? That's what `/playtest` is for.
- When they come back, `pitch_status` shows the rounds, readiness and what's still open.

## 5. The pitch: in Pitch Lab

After one judged round (two or three is better), they press **Write my pitch**. Show them what it
can do: pick a **look**, **Ask for a change** ("make slide 3 punchier", or something bigger like "lead
with the cost"), edit slides by hand, keep or discard each change, go back to an older version.
**Present full screen** for the talk, **Copy share link** for anyone else (it never shows their
answers or their name). The pitch's **gaps** are their homework: things a sharp judge will ask that
they haven't established yet. Added answers or sources later? The pitch says it's out of date and
**Update my pitch** folds them in.

## 6. Make the demo unbreakable

The pitch frames the live demo; the demo is the moment people remember. Go through it once and fix or
avoid anything that could fail on stage:

- **Live address** (after `/ship`), already open in a tab, already signed in. No passwords on stage.
- **Real-looking data** in the app (seed data), so the first screen isn't empty.
- **AI steps** longer than ~3 seconds need a loading state that looks intentional. `locker_status`:
  is the AI budget OK?
- **Phone demo?** Practise the mirroring, or demo from the laptop at phone size.
- **Backup:** a 30–60 s screen recording of the demo path. If anything breaks: "here's what it looks
  like", and go on.

Run `reality-checker` on the demo path: no fake buttons, no fake numbers presented as real.

## 7. Rehearse

Out loud, with Present full screen and a timer, twice. Pitch Lab's **What to say** has the 60-second
version and notes for each slide. Over time? Cut words, not the demo. Last check: the first and the
last sentence, memorised.

Suggest `/wrap` to save what changed.

## Optional: a deck of screenshots, offline

Want the app's real screens on the slides, a key that jumps into the live demo, or a deck that works
with no Wi-Fi? The kit can also build one from `docs/pitch.json` (`npm run pitch -- shots | build | look
<codename>`). See `references/pitch-json.md`. Use the words from their Pitch Lab pitch.

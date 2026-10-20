---
name: test-with-a-friend
description: Run a 10-minute test of the student's app with a real person (a friend, a sibling, a classmate) and turn what happened into the ONE next fix. Prepares 3 tasks and a short script, coaches the student to watch instead of help, asks questions about what people actually did (not "would you use it?"), then writes docs/feedback.md and picks one change. Use when a student types /test-with-a-friend, asks "is my app good?", "what should I build next?", "would people use this?", or after the first version works and before adding big features.
argument-hint: "[codename]"
---

# /test-with-a-friend: watch someone use it

The fastest way to make an app better is to watch one real person use it without helping. Five
people find most of the big problems; one person finds the worst one. This takes 10 minutes.

Talk to the student in short lines. One question at a time.

## 1. Before: what are we testing?

Read `apps/<codename>/docs/idea.md` (the 30-second test from `/start` is there). Then ask the
student, one at a time:

1. **"Who's the tester?"** Best: someone who'd really use it and hasn't seen it yet. A friend who
   is just being nice is OK, but say so in the notes.
2. **"What do you most hope is true?"** Help them name the riskiest guess the app is built on
   ("people will bother to log what they ate", "kids will share their score"). This test is about that guess.

Then write **3 tasks** in the tester's language, not the app's ("You just finished lunch. Rate it."
not "Click the Rate button"). The first one is the app's one main thing. Show them to the student.

## 2. During: the student's script

Give the student this, short enough to read off a phone:

- Say: "I'm testing the app, not you. Nothing you do is wrong. Please think out loud."
- Hand over the phone (or laptop) and read task 1. **Then stop talking.**
- **Don't help.** If they get stuck, count to 10 in your head first. Then ask "What are you looking for?"
- Write down **what they did and said**, word for word when you can: where they tapped, where they
  paused, what made them smile or frown.
- After the tasks, ask about the past, not the future:
  - "When did you last have this problem? What did you do about it?"
  - "What was the most confusing moment just now?"
  - "If you could change one thing, what would it be?"
  - **Never ask** "Would you use this?" or "Do you like it?". People are nice and say yes.

Optional, if the app is online: send them the link afterwards and see if they open it again tomorrow.
That's the strongest signal there is.

**For testers you can't watch** (classmates who open the link later): turn on the app's **Feedback
button**. Starter apps already have the server side; in `public/index.html` remove the comment marks
around `<script src="/locker/feedback.js" defer></script>`. Other Node servers add
`if (await feedback(req, res)) return;` (from `locker/feedback.mjs`, copy `kit/locker/` in if missing);
static sites using `locker/static.mjs` only need the script tag. Testers write, rate and (if they want)
leave a name; it lands in the team's inbox on the hub, and works offline as a simulator
(`data/feedback.jsonl`). It's a bonus, not a replacement: watching one person beats ten messages.

## 3. After: one fix

The student tells you (or pastes) what happened. Also read the button's inbox if it's on
(`locker_feedback` tool, or `npm run locker:feedback -- <codename>`) and fold those messages in.
Write `apps/<codename>/docs/feedback.md`:

```
## <date>: <tester, e.g. "Maya, 15, eats in the cafeteria daily">
Riskiest guess: ...
Task 1: did it? yes / with help / no. What happened: ...
Task 2: ...
Task 3: ...
Their words: "..."
Surprises: ...
```

Then sort what you saw into **broken** (they couldn't do it), **confusing** (they hesitated or
asked), and **wishes** (they asked for more). Recommend **one** change, almost always the biggest
"broken" or "confusing" one, and say why in one line. Wishes go on the "later" list in `docs/idea.md`.
If the riskiest guess looks wrong, say so kindly and offer `/council` on what to do about it.

The student decides. Build the one fix with `start-simple`, then suggest testing with the next person.

---
name: playtest
description: Run a 10-minute playtest of the student's app with a real person - best another hacker team, swapping apps so each tests the other's - and turn what happened into the ONE next fix. Finds the riskiest guess the app rests on, writes 3 tasks and 2-3 questions made for THIS app, coaches the student to watch instead of help, logs each round in docs/feedback.md, picks one change, then sends them to the next tester. Use when a student types /playtest or /test-with-a-friend, asks "is my app good?", "what should I build next?", "would people use this?", "get feedback", or after the first version works and before adding big features.
argument-hint: "[codename]"
---

# /playtest: watch someone use it, fix one thing, repeat

The fastest way to make an app better is to watch one real person use it without helping. Five
people find most of the big problems; one person finds the worst one. A round takes 10 minutes.
The habit we're building: **test, change one thing, test again.** Every round is also proof for
the pitch ("we watched 6 people, so we changed this").

Talk to the student in short lines. One question at a time.

## 1. Who tests it: swap with another team

The best tester is someone who'd really use it and hasn't seen it yet. At the hackathon that's
**another team**: swap. You playtest theirs, they playtest yours, 10 minutes each way. Say it to the
student like that ("find a team at another table and swap"). A friend, sibling or parent is fine
too; a friend who is just being nice is OK, but say so in the notes.

Being a good tester for the other team counts as much: think out loud, be honest, do what you'd
really do.

## 2. Before: what is this round testing?

Read `apps/<codename>/docs/idea.md` (the 30-second test from `/start` is there) and
`docs/feedback.md` (earlier rounds). Then ask the student:

**"What do you most hope is true?"** Help them name the riskiest guess the app is built on
("people will bother to log what they ate", "kids will share their score"). Round 2 and later:
did the last fix work? That's part of what this round tests.

Then write, for this app and this guess:

- **3 tasks** in the tester's language, not the app's ("You just finished lunch. Rate it." not
  "Click the Rate button"). The first one is the app's one main thing.
- **2–3 questions made for this app**, aimed at the riskiest guess and about what really
  happened, not opinions. Good: "When you saw the score, what did you want to do next?",
  "Last time you studied for a test, what did you do the night before?", "Who would you send
  this to? Why them?". Never "Would you use this?" or "Do you like it?": people are nice and say yes.

Show the tasks and questions to the student, and let them change the wording to sound like them.

## 3. During: the student's script

Give the student this, short enough to read off a phone:

- Say: "I'm testing the app, not you. Nothing you do is wrong. Please think out loud."
- Hand over the phone (or laptop) and read task 1. **Then stop talking.**
- **Don't help.** If they get stuck, count to 10 in your head first. Then ask "What are you looking for?"
- Write down **what they did and said**, word for word when you can: where they tapped, where they
  paused, what made them smile or frown.
- After the tasks, the questions from step 2, plus these two:
  - "What was the most confusing moment just now?"
  - "If you could change one thing, what would it be?"

Optional, if the app is online: send them the link afterwards and see if they open it again tomorrow.
That's the strongest signal there is.

**For testers you can't watch** (classmates who open the link later): turn on the app's **Feedback
button**. Starter apps already have the server side; in `public/index.html` remove the comment marks
around `<script src="/locker/feedback.js" defer></script>`. Other Node servers add
`if (await feedback(req, res)) return;` (from `locker/feedback.mjs`, copy `kit/locker/` in if missing);
static sites using `locker/static.mjs` only need the script tag. Testers write, rate and (if they want)
leave a name; it lands in the team's inbox on the hub, and works offline as a simulator
(`data/feedback.jsonl`). It's a bonus, not a replacement: watching one person beats ten messages.

## 4. After: one fix

The student tells you (or pastes) what happened. Also read the button's inbox if it's on
(`locker_feedback` tool, or `npm run locker:feedback -- <codename>`) and fold those messages in.
Add a round to `apps/<codename>/docs/feedback.md` (newest at the top):

```
## Round <n>, <date>: <tester, e.g. "Maya, team SnackMap, eats in the cafeteria daily">
Riskiest guess: ...
Task 1: did it? yes / with help / no. What happened: ...
Task 2: ...
Task 3: ...
Our questions: <question> → "<their answer>"
Their words: "..."
Surprises: ...
We changed: <filled in after the fix>
```

Then sort what you saw into **broken** (they couldn't do it), **confusing** (they hesitated or
asked), and **wishes** (they asked for more). Recommend **one** change, almost always the biggest
"broken" or "confusing" one, and say why in one line. Wishes go on the "later" list in `docs/idea.md`.
If the riskiest guess looks wrong, say so kindly and offer `/council` on what to do about it.

The student decides. Build the one fix with `start-simple`, fill in "We changed", then: **"Find the
next tester."** Two or three rounds before Demo Day is the goal; `/pitch` adds them to the pitch as evidence.

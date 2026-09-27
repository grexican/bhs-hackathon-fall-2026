---
name: demo
description: The two-builds workshop. A student gives an idea; a background "control" agent builds it from one sentence with no skills while you interview the student (5+ real questions), then build the same idea with the full skill stack, and reveal both side by side. Use when someone types /demo, or says "let's do a demo", "build my idea", "show me what this can do".
disable-model-invocation: true
argument-hint: "[the student's idea, in their words]"
---

# /demo: same idea, two builds

**The lesson this teaches:** AI does what you tell it. One vague sentence gets a fine, forgettable
result. A specific, well-directed request, plus real skills, gets something you're proud of.
The student feels that difference by making the decisions themselves.

**Time budget: about 10 minutes at the table.** Kickoff 1 min, research + interview 4 min,
build 5 min, reveal 1 min. Keep moving. Talk like a friendly older student, not a teacher.

## 1. Kickoff (1 minute)

If `$ARGUMENTS` is empty, ask for two things in one message: their **first name** and their
**idea in one sentence**. Take the idea word for word, including typos. Don't improve it.

Then run, from the repo root:

```bash
npm run demo:new -- "<the idea, verbatim>" --name "<first name>"
```

It prints JSON with `slug`, and for `bare` and `full`: the worktree `path`, `port` and `url`.
Keep it. Every later step uses these values.

## 2. Launch the control build immediately, in the background

Before any question, start the **`bare-builder`** subagent **in the background** (Claude Code:
the Agent/Task tool with `subagent_type: bare-builder` and `run_in_background: true`; Cursor: the
`bare-builder` subagent, which is set to `is_background`). Give it **exactly** this, and nothing
more:

> Idea: "<the idea, verbatim>"
> Build folder: <bare.path>
> Port: <bare.port>
> Follow your agent instructions.

Don't add context, the interview answers, or tips. Its ignorance is the point of the experiment.
Tell the student: "An AI with just your sentence has started building. Now let's make yours better."

## 3. Quick research (under 60 seconds)

Search the web (or use what you know) for what already exists close to this idea: 2 or 3 real
examples, and what the best ones do well. Tell the student in **three short lines**. This feeds
the options in your questions. It is not a report.

## 4. The interview: at least 5 questions, one at a time

Ask **one question per turn** and wait. Use your ask/question tool if you have one (Claude
Code: `AskUserQuestion` with a single question); otherwise write lettered options in chat.
Every question must:

- **Change what gets built.** If both answers produce the same app, don't ask it.
- Give **2 to 4 concrete options** that come from this idea and your research, plus "your own".
- Mark **your recommendation** and give a one-line **why this matters**. That line is the teaching.
- **Push back once** on a vague answer ("both" or "idk"): "If you could only keep one, which?"

Choose from these, adapted to the idea. Ask at least five:

1. **Who and when.** Who uses it, and in what moment? (on the bus at 7am, in class, with friends)
2. **The one moment.** What is the single thing it must nail? Everything else gets cut.
3. **The feel.** Offer three named aesthetic directions from `design-director` (a mood, a palette
   and a type personality each, in one line). This decides most of the visual result.
4. **The twist.** What makes it different from the examples you found?
5. **The hard trade-off.** A real fork with a cost: fun or realistic, deep or quick, solo or shared,
   saves progress or instant. Name what each choice gives up.
6. **The test.** What should a friend be able to do in 30 seconds to say "whoa"?

After each answer, append to `builds/<slug>/brief.md` under `## Interview`, in exactly this form
(the reveal page parses it):

```markdown
**Q1:** Who is it for, and when do they use it?
**A1:** Me and my friends before a Spanish quiz, on our phones
```

**To save time:** as soon as the stack is clear (usually after question 2), you may start the
scaffold and the install in a background terminal inside `full.path` while you keep asking.

## 5. The full build (about 5 minutes)

Work only inside `full.path` (an empty worktree on its own branch). Use the skills:

1. **`stack-picker`** chooses the stack for this product. Scaffold non-interactively.
2. **`design-director`** is mandatory. Commit to the direction the student chose, then type,
   palette, layout, and one memorable moment.
3. Build **the one moment** from question 2, polished, with real content (not lorem ipsum).
   One great screen beats five half-done ones.
4. The dev server must run on `full.port`: the `dev` script accepts `--port <n>`, or reads `PORT`.
5. **`verify-in-browser`**: start it, then run `npm run shot -- <full.url>` from the repo root,
   look at both screenshots, and fix what's ugly or broken. Zero console errors.
6. Write `DEMO.md` in `full.path` **last**, because it's the done signal: the idea, the answers,
   the stack, and which skills shaped what.
7. Commit on its branch: `git -C <full.path> add -A`, then `git -C <full.path> commit -m "<idea>"`.

Keep the student in the loop in one-line updates ("Setting up React… choosing your colors…").

## 6. Reveal

Check the control: `npm run demo:status -- <slug>`. If `bare.done` is false, give it up to a minute.
If it's still not done, reveal anyway. The page shows its progress and swaps it in when it's ready.

```bash
npm run demo:reveal -- <slug>
```

That starts both dev servers and opens the side-by-side page in the browser.

## 7. Debrief (30 seconds)

Three lines, in plain words: what **their answers** changed, what **the skills** changed, and one
thing they could ask for next. End with: "If you're at the hackathon, this is day one."

## Rules

- Never share interview answers with the control agent. Never edit the control's folder.
- Never touch `main` or another demo's folder. Each demo lives only in `builds/<slug>/`.
- No accounts, API keys or paid services in a fair build. If the idea needs them, fake the
  *boundary* visibly ("sign-in comes later"), never the data it claims to show.
- If something breaks, say what broke in one sentence, fix it, and keep going. The show goes on.

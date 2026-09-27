# Running `/demo` at a table

**The pitch, in one breath:** "Tell me an app you wish existed. One AI builds it from just your
sentence. You and I build it with a real toolkit. In ten minutes you'll see the difference."

## The night before

```bash
git pull
npm run setup
npm run check
```

- Open the repo in Cursor. Confirm `/demo` appears when you type `/`, and `bare-builder` shows
  under subagents.
- Do **one full rehearsal** with a silly idea, and time it. Then `npm run demo:clean -- --all`.
- Pre-cache the scaffolds so the first real build isn't slow: `npm create vite@latest`,
  `create-next-app` and `create-astro` all hit the npm cache on second use.
- Laptop: plugged in, sleep disabled, notifications off, browser zoom at 110% for the reveal page.

## Per student (about 10 minutes)

1. Type `/demo` and hand them the keyboard, or type for them while they talk.
2. The control build starts in the background immediately. Say so out loud, because it's the hook.
3. They answer the questions. **Let them pick.** Push once on a vague answer, then move on.
4. The full build runs. Narrate the one-line updates. This is where you talk about skills.
5. The reveal opens side by side. Let them click both. Drag the divider.
6. The debrief is three lines. Invite them to the hackathon.

Running more than one at a time is fine: each demo has its own worktree, branch and random ports.
Use a second Cursor window for the second student.

## Useful during the day

| Command | When |
|---|---|
| `npm run demo:list` | What exists, and what's still building |
| `npm run demo:reveal` | The gallery of every build today (good on a second screen) |
| `npm run demo:reveal -- <slug>` | Reopen one comparison |
| `npm run demo:down -- --all` | Free the laptop between rushes |
| `npm run demo:clean -- <slug>` | Delete a demo, its worktrees and its branches |

## If something goes wrong

- **The control never finishes:** reveal anyway. The page shows its progress and swaps it in.
- **A build won't start:** read `builds/<slug>/logs/<side>.log`. Most often it's a missing
  `npm install`; `demo:up` runs it, but a half-written package.json can break it.
- **A port clash:** impossible by design. Ports are random and checked, so if it happens,
  `demo:down` and `demo:up` pick again.
- **Cursor runs the subagent in the foreground:** the interview waits until it returns. Say
  "while that runs, let's plan yours," and keep talking. Next time, check `is_background` in
  `.claude/agents/bare-builder.md`.

## What the students should leave with

1. **Being specific is a superpower.** The control got a sentence; theirs got their decisions.
2. **Skills are expertise you can plug in.** Same model on both sides; the difference is what it knew.
3. **They made the calls.** The AI recommended; they chose.

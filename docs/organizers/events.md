# Events: one branch per hackathon

- **`main`** is the evergreen template. Improvements to skills, workflows and scripts land here.
- **One branch per event** (`fall-2026`, `winter-2027`, `spring-2027`). It's cut from `main` a
  few days before the event and carries only event-specific details: dates, rules, prompts.
- **Students** clone the event branch and work on their own `firstname-lastname` branch off it.
- **Demo builds** live on `demo/<slug>-bare` and `demo/<slug>-full` branches (orphans, local only
  unless you push them).

## Starting the next event

```bash
git switch main && git pull
npm run skills:outdated          # refresh anything stale: npm run skills:sync -- <name>
npm run check
git switch -c <season-year>
# edit docs/organizers/event.md with the date, place, schedule and prizes
git push -u origin <season-year>
```

Set the event branch as the default branch on GitHub for the event week, so a plain
`git clone` lands on it.

## Carrying lessons forward

After each event, write down what broke, what students got stuck on, and what the agent got
wrong, in `docs/organizers/lessons.md` **on `main`**, then fix the skill or doc that caused it.

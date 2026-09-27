# Lessons carried forward

What earlier hackathons taught us, and what this template changes because of it.

| Lesson | What changed |
|---|---|
| A vague prompt got a correct, forgettable site. A specific one got something delightful. Adding real skills got a different league. | `/demo` makes students *feel* it: a no-skills control vs. their answers plus the skill stack. `/start` interviews before it builds. |
| One fixed starter stack (a todo app on React + Express + SQLite) fit some ideas and fought the rest: games, content sites, 3D. | No default stack. `stack-picker` chooses per product. |
| Fixed ports (5173 and 3001) collided whenever two things ran at once. | Random free ports (`npm run port`); every app must accept `--port`. |
| Students used different editors, and skills installed as editor plugins didn't follow them. | Everything is vendored in `.claude/skills/`, which Cursor and Claude Code both read. `skills.manifest.json` plus `skills:sync` keep the copies fresh. |
| Design quality was the most visible gap between "made with AI" and "made well". | `design-director` is mandatory for any UI, backed by ui-ux-pro-max data, impeccable, taste, motion, GSAP and three.js skills. |
| "It works" was often claimed and not true. | `verify-in-browser` plus `npm run shot`: screenshots and zero console errors before "done". |
| The hygiene rules held up: cheap model by default, a fresh chat at feature boundaries, the exact error before guessing, the smallest version first, plain-English comments, commit when it works. | Kept, as skills that trigger on their own. |
| Handing out API credits and keys took real organizer time. | Fair builds need no keys. `.env.example` lists only key names; the commit check blocks keys anywhere else. |

Add to this after every event (on `main`).

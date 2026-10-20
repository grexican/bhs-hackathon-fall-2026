---
name: bring-my-app
description: Bring an app the student already built (from another folder, a GitHub repo, a zip, Lovable, Replit, a past hackathon) into this kit so the skills, /connect and /ship work on it. Use when a student types /bring-my-app, says "I already have an app", "can I use my old project", or pastes a GitHub link to their own code.
argument-hint: "[path, GitHub link, or zip]"
---

# /bring-my-app: move in an app you already have

One question at a time. Never delete or overwrite their original.

1. **Where is it?** A folder on this laptop, a GitHub link, or a zip. (Someone else's repo? Ask if
   it's theirs to use.)
2. **Name it.** Confirm a name and codename (lowercase, dashes, 3–30 characters).
3. **Move it in.**
   - GitHub link: `git clone <link> apps/<codename>` (keeps its history; it stays its own repo).
   - Folder or zip: copy it into `apps/<codename>/`. No `.git` inside? Run `git init` and make a
     first commit there.
   - Make sure `apps/<codename>/.gitignore` has `node_modules`, `.env`, `data/`, `*.db`.
4. **Look before changing.** Read it and tell them in 3 lines: what it is, what stack, how it runs
   now. Run it locally (`npm install`, then its dev command on a port from `npm run port`). Broken?
   Fix that first, with them.
5. **Make it deployable** (the `/ship` rules): a `start` script, `process.env.PORT`, a `/health`
   route, SQLite at `process.env.DATABASE_PATH` (or tell them their hosted database stays where it
   is), no Docker needed. Secrets they had in code move to `.env`. Explain each change in one line.
6. **Write `apps/<codename>/docs/idea.md`**: what it does, who it's for, what's next.
7. Offer **`/connect`** (hosting slot + AI key) and then **`/ship`**.
8. Staying hosted where it is (another host, another stack)? It can still use the school sign-in: an
   organizer registers its address on the hub, then follow `school-sign-in` (Express, Hono, Next.js, Python).

If it's not a web app (a mobile-only app, a Python script, a game engine project), say what the
kit can and can't do for it today, and suggest the web version or a web companion page.

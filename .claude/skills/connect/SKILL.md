---
name: connect
description: Connect the student's laptop to the BHS Incubator hub and give their app a hosting slot, its own AI key and email. Runs npm run locker:connect then npm run locker:project. Use when a student types /connect, asks to "put it online" or "get a web address", or before the first /ship.
argument-hint: "[codename]"
---

# /connect: get your app a home online

Say this (3 lines, no more):

> The BHS Incubator gives your app its own hosting slot (a real web address), its own AI key with a
> monthly budget, email sending, and optional "Sign in with BHS". You sign in once with your school
> Google account. Takes about a minute.

Then, one step at a time:

1. **Which app?** Find the codename (the folder in `apps/`). Only one? Use it and say so. None?
   Run `/start` first.
2. **Connect the laptop.** Skip if `npm run locker:status` already shows them connected. Otherwise
   run `npm run locker:connect`. It opens the browser and prints a code. Say: "Sign in with your
   school Google account, check the code matches, click **Connect**." Wait for it to finish.
3. **Make the project.** `npm run locker:project -- <codename> --name "<Name>" --pitch "<one sentence>"`
   (add `--idea-url <link>` if `docs/idea.md` has an Idea Lab link). It takes 10–30 seconds and
   writes the settings into `apps/<codename>/.env`. Never show or repeat what's in that file.
4. **Show the result** in 3 lines: the live address (empty until the first `/ship`), the AI budget,
   and the Railway invite link: "Optional: open this to watch your app's logs in Railway's
   dashboard. It needs a free Railway account."
5. Offer `/ship` once the app runs locally.

## If something fails

| It says | You do |
|---|---|
| "Can't reach the hub" / "isn't answering yet" | Check wifi. Still failing: the hub isn't live yet, tell an organizer. Keep building locally. |
| codename taken | Offer 2 new codenames, let them pick, rename the `apps/` folder, run it again. |
| too many projects (max 3) | `npm run locker:status` lists them. An organizer can free one. |
| "isn't connected" | Run `npm run locker:connect` again. |

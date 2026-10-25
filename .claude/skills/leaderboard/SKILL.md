---
name: leaderboard
description: High scores and a leaderboard for a student's game - save scores, show the top 10 (all time, this week, today), "your best" and "your rank", named players, with basic anti-cheat (the server times each game, limits on points per second and scores per minute, a bad-name filter with Jev). The kit already has it - kit/locker/leaderboard.mjs (server, in the app's own SQLite) and kit/locker/scores.js (page). Use whenever a game needs scores, high scores, a ranking, or "who's winning".
---

# Leaderboard: use the kit, don't build it

The guide is `kit/locker/LEADERBOARD.md`. Don't write a score table from scratch.

1. **Add it:** `node scripts/add-kit.mjs leaderboard <codename>` (copies the files, wires `server.js` with a `main` board). Restart `npm run dev`.
2. **Ask the student one question:** "What's the most points someone can honestly get in one second?" Put the answer in
   `boards: { main: { maxPerSecond: N } }` in `server.js`. A race against the clock is `{ timed: true }` instead (the server's stopwatch is the score).
3. **In the game:** `startRun()` when a game starts, `submitScore({ score, name, run })` when it ends, `topScores()` for the table
   (LEADERBOARD.md step 2 has plain-HTML and React snippets). Show `err.message` when a score or name is refused.
4. **Prove it:** play a game in the browser, see the score in the table, restart the server, still there.

Explain the anti-cheat to the student in their words: the game runs on the player's phone, so the server
can't trust it; it times the game itself and refuses impossible scores. Signed-in (`LOCKER_GATE`) is stronger than a browser id.

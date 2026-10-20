# Incubator proposals (hub support the kit would like)

Short asks from the kit side to the hub. The kit works without any of them today; each one removes
a manual step or a likely support question. Newest first.

## 2026-10-20 (from the skill harvest, see `harvest-2026-10-20.md`)

1. **Disk usage per project.** `save-files` puts uploads on the `/data` volume. Add the volume's used
   and total size to `Project` (`disk: { usedMb, totalMb }`) so `locker:status` can warn at 80%
   before uploads start failing. Today nobody would notice until writes break.
2. **A feedback inbox per app.** `POST /api/feedback` (app secret, like the email relay) body
   `{ text, page?, contact? }`, shown on `/p/<codename>`. Every student app wants "tell us what's
   confusing" and most would otherwise misuse the 50/day email relay for it. `/test-with-a-friend`
   and `/whats-next` would read it.
3. **Open counts via the API.** `/p/<codename>` already shows installs and opens per week. Return
   them in `GET /api/projects/:codename` (`stats: { installs, opens7d, people7d }`) so `/whats-next`
   can use them as evidence without the student copying numbers.
4. **Open Graph tags on `/go/:codename`** (the app's name, tagline and icon from its listing), so a
   shared Locker link previews nicely in group chats even before the student adds their own tags.

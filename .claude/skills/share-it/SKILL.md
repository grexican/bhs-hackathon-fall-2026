---
name: share-it
description: Help the student get real people to open their live app and see whether they come back - a nice link preview when the link is pasted in a group chat (title, description, preview image), a QR code for posters and slides, a listing in the incubator's app directory (the Locker), and a tiny privacy-friendly visit counter in the app's own database (no cookies, no trackers). Use when a student types /share-it, asks "how do I get people to use it", "how do I share it", "why does my link look boring", "how many people used it", or right after a first /ship.
argument-hint: "[codename]"
---

# /share-it: get it into people's hands

An app nobody opens doesn't teach you anything. This gets the link spreading and lets the student
see if it's working. Needs the app online (`/ship` first). One step at a time.

## 1. The link preview

When someone pastes the link in a chat, the preview is the app's first impression. In the main
page's `<head>` (use `APP_URL` from `.env` for full addresses):

```html
<title>Lunch Line: see the line before you leave class</title>
<meta name="description" content="One sentence: what it does, for whom.">
<meta property="og:title" content="Lunch Line">
<meta property="og:description" content="See the line before you leave class.">
<meta property="og:image" content="https://<the app's address>/og.png">
<meta property="og:url" content="https://<the app's address>/">
<meta name="twitter:card" content="summary_large_image">
```

Ask the student for the one sentence; offer two options and recommend one. **The preview image**
(`og.png`, 1200x630): make a small page in the brand colors with the name, the sentence and a
screenshot of the app's best screen, then screenshot that page at exactly 1200x630 with
`playwright-cli`. Put it in the public folder. Check it after `/ship` by pasting the link in a chat
with yourself.

## 2. A QR code

For posters, slides and the demo: `npx -y qrcode -o tmp/qr.png "<APP_URL>"`. Offer to put it on a
simple one-page poster with `canvas-design` (name, sentence, QR code, "scan me").

## 3. The Locker directory

Every student can browse listed apps on the hub and add them to "My Locker". Listing needs a
**tagline** (90 characters max), a **category** (School life, Money, Wellbeing, Language, Families,
Expat life, Games, Clubs, Other) and an **icon** (one emoji). Help the student write the tagline:
what it does for the user, not what it's built with. Then list it with the `locker_list_app` tool, or
`npm run locker:list -- <codename> --tagline "..." --category "School life" --icon "🍝"` (add
`--school-only` if it uses the sign-in gate; `--off` hides it again). The project page on the hub
(`<LOCKER_URL>/p/<codename>`) does the same with a form. The hub's project page then shows opens and
people per week, for visits that came through the Locker.

## 4. See if people come back

The hub only counts visits that come through the Locker. For everything else, add a tiny counter
to the app's own SQLite (the database at `DATABASE_PATH`), **no cookies, no outside trackers, nothing
personal**:

- A table `visits(day TEXT, path TEXT, count INTEGER, PRIMARY KEY(day, path))`.
- On each page load, the server does `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1`.
- Count the actions that matter too (`event:rated-lunch`), the same way. Those beat page views.
- A `/stats` page that shows the last 14 days. Behind the sign-in gate, or a secret word from `.env`.

Don't store IP addresses, names or anything that identifies a person. It's the kind thing to do,
and it means no privacy notice is needed.

## 5. Make the ask

Help the student write the message they'll actually send (group chat, class, club): one line on
what it is, the link, and one ask ("try rating today's lunch, tell me what's confusing"). Then point
them to `/playtest` for the people who answer.

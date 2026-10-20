---
name: headless-browser
description: Run a real browser (headless Chromium via Playwright) inside the student's app server, on the laptop and online - read a page, take a screenshot, or log in to a website for a user (with their password from the vault). Gives the proven setup for the incubator's hosting (one setting, no Dockerfile), the kit helper locker/browser.mjs (one browser at a time, always closed), what it costs in build time, memory and money, and when NOT to use a browser. Use when a feature needs "scrape", "log in to X for me", "check a website", "screenshot a page", or Playwright/Puppeteer/Chromium on the server.
---

# A headless browser in your app

Sometimes the only way to get something is to open the page like a person would: log in to the
school portal, read a timetable, take a screenshot. A headless browser does that from your server.
It's heavy, so check first: **is there an API, an export, an RSS or calendar link?** Use that if so.

## Setup (proven on the incubator's hosting)

In the app folder:

```bash
npm install playwright
npx playwright install chromium        # the browser itself, for your laptop
```

Online, one setting makes the build install Chromium and everything it needs (no Dockerfile):

```bash
npm run locker:set -- <codename> RAILPACK_NODE_PLAYWRIGHT_INSTALL=1
```

Then `npm run deploy -- <codename>` as usual. `playwright` must be in `dependencies` (not
`devDependencies`): `npm install playwright` does that.

## Use it: locker/browser.mjs

Starter apps have `locker/browser.mjs` (else copy `kit/locker/browser.mjs` into `locker/`):

```js
import { withBrowser } from "./locker/browser.mjs";

const title = await withBrowser(async (page) => {
  await page.goto("https://example.com");
  return page.title();
});
```

It runs **one browser at a time** (others wait their turn), closes it **always** (even after an
error), and kills a stuck page after 60 s. Return only what you need (text, a number); never keep
the page around.

**Logging in for a user:** get their password with the vault, inside `withBrowser`
(`keep-secrets-safe` has the full recipe: consent, the site's terms, per-person rate limits, what to do
with a wrong password).

## What it costs (measured on a throwaway app)

| | Plain starter app | With a headless browser |
|---|---|---|
| Build + deploy | ~30 s | ~3 min (the build installs Chromium and its system libraries) |
| One page load (read + screenshot) | | ~0.5 s for the first one, ~0.2–0.3 s after |
| Memory while idle | ~50 MB | ~60 MB (the browser only runs during a call) |
| Memory during a call | | the app's Node grows to ~170 MB, plus the browser process (~150–300 MB) |
| Money | | Hosting is billed by memory and CPU used: a browser that runs a few times a minute costs cents a month; one left open all day costs dollars. Close it (the helper does). |

**Rules that keep it cheap:** run it on a button press or a schedule, never on every page load; cache
what you read in SQLite; one browser at a time (the helper does it); close it (the helper does it).

## If it breaks

- `npm run locker:logs -- <codename> --build`: look for "Installing playwright packages and headless
  browser". Missing? The setting isn't on, or `playwright` isn't in `dependencies`.
- "Executable doesn't exist" on the laptop: `npx playwright install chromium` in the app folder.
- Timeouts on a slow site: `page.goto(url, { timeout: 30_000 })`, and test the site by hand first.
- Out of memory online (the app restarts while a browser runs): don't open more than one at a time,
  close pages you're done with, and ask an organizer.

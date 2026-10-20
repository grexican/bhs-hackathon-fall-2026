---
name: keep-secrets-safe
description: When an app takes a password, API key or token FROM ITS USERS (a school-portal password a headless browser logs in with, someone's own API key for another service), keep it in the vault (locker/vault.mjs) - encrypted on the incubator hub, used just in time, never in the database, logs, git or the browser. Includes the threat model in plain words, the UI rules (say what's stored, let people delete it) and a worked recipe for logging in to a website for the user with Playwright. Use whenever a feature asks users for a password or key, mentions "log in to X for me", scraping a site behind a login, "connect your account", or storing credentials or tokens.
---

# Keep your users' secrets safe

Sometimes an app really needs a user's password or key: "log in to the school portal and fetch my
grades", "use my own API key". That's allowed, and here's how to do it safely. It's not optional:
a password in plain text in your database is the worst bug an app can have, because people reuse
passwords. Explain this to the student in two lines, then follow the pattern.

## The rule

**Passwords and keys that users give the app go in the vault. Never** in the database, a log line,
a file in git, an `.env`, an error message, the browser (localStorage, cookies, the page), or an AI
prompt. The app's **own** keys (`OPENROUTER_API_KEY`, `LOCKER_APP_SECRET`) stay in `.env` as always.

## The vault in four calls (server side only)

Starter apps already have `locker/vault.mjs` (otherwise copy `kit/locker/vault.mjs` into `locker/`).

```js
import { vault, VaultMissingError } from "./locker/vault.mjs";

await vault.put(user, "portal-password", password);    // when they type it in; returns { name, hint, … }
const grades = await vault.use(user, "portal-password", "log in to the portal to fetch grades",
  async (password) => fetchGrades(user, password));     // use it inside, return what you need
await vault.has(user, "portal-password");               // { name, hint, updatedAt } or null: never the value
await vault.remove(user, "portal-password");            // the "Forget my password" button
```

- `user` is the signed-in person: the `user` from the school sign-in (`LOCKER_GATE=1`), or your app's
  own id for them. With the school sign-in, people can also see and delete what your app keeps on the
  hub (My Locker → "Passwords apps keep for you").
- `use` fetches the secret **at that moment** (just in time), with a purpose the hub records (who,
  when, what for, never the value). Don't copy it into a variable that outlives the function, a
  database row, or a cache.
- While `use` runs, the value is replaced by `[redacted]` in the request logs and in errors thrown
  inside it. Logging something from the other site? `redact(text)` first.
- No `/connect` yet? It's simulated: encrypted in `data/vault-sim.json` on the laptop, labelled. The
  whole flow works offline.
- `VaultMissingError` (`err.code === "VAULT_NOT_FOUND"`): nothing saved yet → show the "add your
  password" form, not an error page.

## What's protected (say it honestly to users)

| If… | Then |
|---|---|
| Your app's database or its backup leaks | Nothing to find: the app never stores the secret. |
| Someone gets into your app's server | They could use secrets while they're in (any app that uses a password must see it). Every use is logged with its purpose, limited per hour, and organizers can cut the app off. |
| The hub's database leaks | Encrypted, useless without the hub's key, which isn't in the database. |
| Someone gets the hub's database **and** its key | They could read the vault. That's why the hub is run by organizers, not apps. |

## What the user sees (UI rules)

1. **Before asking:** one sentence on why the app needs it and what it will do with it ("We log in to
   the portal as you once a day to fetch your grades. We never see your messages.").
2. **The form:** a password field (`type="password"`, `autocomplete="off"`), posted to your server
   over https. Never put it in the URL.
3. **After saving:** show the hint ("Saved: …a7Qz, last used today") and a **Forget it** button that calls
   `vault.remove`. Never show the password itself again.
4. **If they're under 18 and it's a school account:** suggest they ask a parent or teacher first. Say
   who else can see it (nobody on the team; organizers can't read it either).

## Recipe: log in to a website for the user (Playwright)

First, the honest checks (ask the student, one at a time):
- **Is there an official way?** An API, an export, a calendar link. Use that instead if it exists.
- **Is it allowed?** Read the site's terms. Logging in as the user, for the user, slowly, is usually
  fine; scraping other people's data or getting around limits is not. If it's the school's portal,
  ask the school.
- **Does the user agree?** They type the password themselves, knowing what the app does with it.

Then build it, server side:

```js
import { chromium } from "playwright";
import { vault } from "./locker/vault.mjs";

// One browser at a time: browsers are heavy, and the site shouldn't see a crowd from one app.
let busy = Promise.resolve();
const oneAtATime = (fn) => (busy = busy.then(fn, fn));

export function fetchGrades(user) {
  return oneAtATime(() =>
    vault.use(user, "portal-password", "log in to the portal to fetch grades", async (password) => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto("https://portal.example.org/login", { timeout: 20_000 });
        await page.fill("#username", user.email);
        await page.fill("#password", password);
        await Promise.all([page.waitForLoadState("networkidle", { timeout: 20_000 }), page.click("button[type=submit]")]);
        if (await page.locator("text=Invalid").count()) throw new Error("The portal said the password is wrong.");
        return await page.locator(".grade-row").allTextContents();   // only what the app needs
      } finally {
        await browser.close();                                         // always, even after an error
      }
    }),
  );
}
```

- **Rate-limit per person, not per IP:** a whole school shares one internet address. Remember the last
  run per user (a `last_fetch` column) and refuse more than, say, one fetch per 10 minutes.
- **A wrong password** → tell the person and offer to update it (`vault.put` again). Don't retry in a
  loop: portals lock accounts.
- **Store results, not the password:** save the grades in SQLite; fetch again later with `vault.use`.
- **Online, the server needs Chromium:** add `playwright` to the app's dependencies and
  `"postinstall": "playwright install --with-deps chromium"` to `package.json`, then deploy early and
  check the build logs (`npm run locker:logs -- <codename> --build`). If the build can't install it, ask
  an organizer before the demo.

## Done means

No secret in the database (`grep` the `data/` folder after a test run), none in `npm run locker:logs`,
none in git (`git log -p | grep` for a test password), a "Forget it" button that works, and a wrong
password that shows a friendly message. Run `security-review` once it works.

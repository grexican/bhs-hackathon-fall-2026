---
name: make-it-an-app
description: Turn the student's web app into a real app on phones - an "Install" card that helps people add it to their home screen (nudge), or an install page that makes phone users install it before they use it (required). Laptops are never blocked. Covers the manifest it needs, testing on a real phone, the "sign in again" surprise on iPhone, and an honest answer to "can it go in the App Store?". Use when a student types /make-it-an-app, asks "can people install it", "make it a real app", "make them download it", "force install", "app store", "Play Store", or wants notifications on phones (those need the installed app on iPhone).
argument-hint: "[nudge|required]"
---

# /make-it-an-app: an app on the home screen

A web app can live on the home screen with its own icon, no address bar, like any app.
The kit has a helper that walks people through installing it. On laptops it does nothing.
One step at a time. One line to the student per step.

Do `/on-my-phone` step 2 first if the app has no `manifest.json` yet. This skill builds on it.

## 1. Pick: nudge or required

Ask: **"Should people be able to use it in the browser too, or only as an installed app?"**
Recommend **nudge**. Say why in one line each:

- **nudge** (recommended): the app works in the browser. After a while a small card says
  "Install <app>". "Not now" hides it for 7 days. Nobody is stopped.
- **required**: on a phone, people see an install page instead of the app until they install it.
  Every step loses people: some leave instead. Pick it only when the app only makes sense installed:
  something you open every day, or that lives on notifications (on iPhone, notifications work only
  in the installed app).

Laptops never see either one. Desktop people use the app in the browser, notifications too.

## 2. Turn it on

Two lines. The app must be the starter app (it has `locker/install.mjs`), or any server that serves
`locker/install.js`.

In the page's `<head>` (`public/index.html`, or `index.html` in the React app), **not** `defer`, so
the app stays hidden before it paints in required mode:

```html
<script src="/locker/install.js"></script>
```

Then pick the mode in the app's `.env` and online:

```
npm run locker:set -- <codename> LOCKER_INSTALL=nudge
```

`LOCKER_INSTALL=off` turns it off again. No `.env` setting? Put the mode on the tag instead:
`<script src="/locker/install.js" data-mode="nudge"></script>`. When both are set, `.env` wins.

Extras on the same tag, all optional:

- `data-why="Your streak lives on your home screen."`: one line under the steps. Ask the student
  for it. Short and true, about the user, not the app.
- `data-continue="yes"`: required mode gets a small "Continue in browser" link. Good for a demo day.
- `data-delay="20"`: nudge seconds before the card on a first visit (30 by default; a second visit
  shows it after a few seconds). It never shows the moment the page opens.
- `data-notifications="yes"`: the iPhone steps say notifications need iOS 16.4 or newer.

Your own "Install" button somewhere in the app: `window.LockerInstall.show()`.
`window.LockerInstall.state()` says what it sees (`mobile`, `installed`, `inApp`, `canPrompt`).

## 3. The manifest it needs

In dev (laptop, `localhost`), the browser console lists exactly what's missing. Fix each line.
A full one (`public/manifest.json`, linked with `<link rel="manifest" href="/manifest.json">`):

```json
{
  "name": "Lunch Line",
  "short_name": "Lunch Line",
  "description": "See the line before you leave class.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1c2b7a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/shot-phone.png", "sizes": "750x1334", "type": "image/png", "form_factor": "narrow" },
    { "src": "/shot-wide.png", "sizes": "1280x800", "type": "image/png", "form_factor": "wide" }
  ]
}
```

- The **install page shows** the icon, `name` and `description`. Make them good.
- **Maskable icon:** the same logo, smaller, inside the middle 80% of a full square of color.
  Android cuts it into a circle or a squircle.
- **Screenshots** make Android's install sheet big and pretty. Take them with
  `npm run shot -- <url> --mobile`, then resize to the sizes you list.
- `theme_color` becomes the install button's color (if it's readable on the page).

## 4. Try it on a real phone

Emulators lie about installing. Use a real phone, over **https** (after `/ship`).

1. `/on-my-phone` step 1 for the QR code of `APP_URL`.
2. Open it in **Safari** on an iPhone, **Chrome** on Android. Do what the steps say.
3. Open it from the home-screen icon. The install page or card must be gone.
4. Open the link from Instagram or WhatsApp too. It should say "open it in your browser" first.

Testing tricks (add to the address; anyone can use them, so they're not a lock):

- `?install=preview` shows it even on a laptop.
- `?install=skip` skips the install page for this tab.
- `?install=reset` forgets "Not now" and the visit count.

## 5. Tell the student: on iPhone they sign in again

An app on the iPhone home screen has its own cookies, separate from Safari. So someone who signed
in with the school sign-in in Safari **signs in again** the first time they open the installed app.
That's normal. Say it once in the app's welcome, or in `data-why`. Android shares the sign-in.

The install page never blocks sign-in, the API or `/health`: it only covers the app's own pages.

## 6. "Can it go in the App Store?"

Short, honest answer:

- **Today:** it's installable on both phones from the link. That's a real app for your users.
- **Google Play, later:** possible. **PWABuilder** (free, pwabuilder.com) wraps the installable app
  into a Play Store package. You need a Google Play developer account ($25, once), a few days of
  review, and a small file on your site that proves the app is yours ("Digital Asset Links",
  `/.well-known/assetlinks.json`; PWABuilder makes it). The app must pass step 3 first.
- **Apple App Store:** much harder. Apple rejects apps that are just a website in a wrapper. It
  needs a real native reason and a $99/year account.

So the plan: **installable on both phones today, Play Store later, the iOS store if it earns it.**

## 7. Prove it

`npm run shot -- "<url>/?install=preview" --mobile --wait 1500` and look at it. Then step 4 on a real
phone. It counts only when the home-screen icon opens the app with no install page.

Suggest `/wrap` to save it.

---
name: push-notifications
description: Add push notifications to the student's app - a message that pops up on someone's phone or laptop even when the app is closed ("your order is ready", "your friend replied", "the bus is 5 minutes away"). Uses the incubator hub, so there's no extra account or key. A "Turn on notifications" button, a service worker, and sendPush on the server, in about 10 minutes. Covers iPhone (it must be on the Home Screen first), when NOT to notify, and testing on a real phone. Use when a student types /push-notifications, asks for "notifications", "push", "alerts", "remind me", "ping me when", or "tell people when something happens".
argument-hint: "[codename]"
---

# /push-notifications: tell people when something happens

A notification pops up on the phone even when the app is closed. The incubator hub does the sending, so
there's no Firebase or OneSignal account. One step at a time. One line to the student per step.

First ask: **"What should make a notification, and who asked for it?"** Write the answer down.
If the answer is "every day, to everyone, to bring them back", push back (see "Good manners" below).

## 1. Check the app has it

The starter apps already have it (`locker/push.mjs`, `locker/push.js`, `locker/push-sw.js` and one line in
`server.js`). An older app, or one made another way? Copy the three files from `kit/locker/` into the
app's `locker/` folder, and add this to `server.js`, after the sign-in gate and before the app's routes:

```js
import { push } from "./locker/push.mjs";
if (await push(req, res, user)) return;   // the button's routes and /push-sw.js
```

It needs a Node server (the key stays there). A plain static site can't use it.

## 2. Put the button on a page

- **Plain HTML starter:** in `public/index.html`, delete the comment marks around the
  `data-push-button` button and around `<script src="/locker/push.js" defer>`.
- **React starter:** in `src/App.tsx`, set `SHOW_NOTIFICATIONS = true` (`src/components/PushButton.tsx`).
- **Anywhere else:** `<button type="button" data-push-button>Turn on notifications</button>` and the script tag.

The browser asks "Allow notifications?" **only when the person taps the button**. Never on page load:
people say no to a question they didn't ask for, and then the app can never ask again.
Put the button next to the thing it's for ("Tell me when my order is ready"), not on the first screen.

## 3. Send one from the server

Where the thing happens (an order is ready, someone replied), in `server.js`:

```js
import { sendPush } from "./locker/push.mjs";
await sendPush({ user: user.sub, title: "Your order is ready", body: "Pick it up at table 4", url: "/orders/12" });
```

- `user`: the signed-in person (`user.sub`, with the school sign-in on). Nobody signs in? The page gets
  this device's id from `await lockerPush.turnOn()` (`{ user: "device:…" }`); send it to your server with
  the order, save it, and use it as `user` later.
- `users: [...]` sends to up to 100 people at once. `url` is the page that opens on tap. `tag`: a newer
  notification with the same tag replaces the older one (good for "3 new messages").
- Keep `title` short (it's cut at about 40 characters on phones). 500 notifications a day per app.

## 4. Try it on the laptop

`npm run dev`, tap the button, allow, tap again ("Send me a test").
- **Before `/connect`** it's simulated: the page shows a notification labelled "(simulated)", and the
  terminal prints every `sendPush` (also saved in `data/push.jsonl`).
- **After `/connect`** it's real, even on `localhost`: Chrome, Edge and Firefox on the laptop get it.
  Nothing shows up? Check the computer's own notification settings for the browser (Windows: Settings,
  System, Notifications; Mac: System Settings, Notifications) and that Focus / Do Not Disturb is off.

## 5. Try it on a real phone

`/ship` first (phones need the live `https://` address). Then:
- **Android (Chrome):** open the app, tap the button, allow. Done.
- **iPhone (iOS 16.4 or newer):** notifications only work in the app **added to the Home Screen**. The
  button says so and explains how. The app needs a `manifest.json` for that: do `/on-my-phone` step 2
  first (or `/make-it-an-app`). Then: Share, Add to Home Screen, open it from the icon, tap the button.

It counts when a real notification arrives on a real phone with the app closed, and tapping it opens
the right page.

## Good manners (say these to the student)

- **Only for things the person asked for.** "Tell me when my order is ready": yes. "We miss you!": no.
- **Say what it's for before asking.** "Turn on notifications to know when your order is ready."
- **Few and useful.** Every notification someone didn't want makes them turn them all off.
- **Never at night** for anything that can wait. Never for ads.
- **Let people turn it off** in the app (`lockerPush.turnOff()`), not only in the phone's settings.
- **No private details in the text.** It shows on a locked screen: "You have a new message", not the message.

Suggest `/wrap` to save it. Next good step: `/test-with-a-friend` (does the notification arrive on their phone?).

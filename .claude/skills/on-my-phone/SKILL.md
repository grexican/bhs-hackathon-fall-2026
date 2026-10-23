---
name: on-my-phone
description: Get the student's app onto their own phone and make it feel like a real app there - open it with a QR code, add it to the home screen with its own icon and name (installable web app), then fix what feels wrong on a touch screen. Use when a student types /on-my-phone, asks "can I use it on my phone", "how do I make it an app", "add to home screen", "make it installable", or before showing the app to friends (most people will open it on a phone).
argument-hint: "[codename]"
---

# /on-my-phone: make it feel like an app on your phone

Most people who try a student's app will open it on a phone, from a link in a group chat. So the
phone is the real screen, not the laptop. One step at a time, one line to the student per step.

## 1. Open it on the phone

Two ways. Ask which one fits right now, and recommend the first if the app is already online.

- **It's online already** (`APP_URL` is in `apps/<codename>/.env`): show a QR code of that address in
  the terminal with `npx -y qrcode "<APP_URL>"`. The student points the phone camera at it. If they
  can't see your terminal, save a picture instead (`npx -y qrcode -o tmp/qr.png "<APP_URL>"`) and open it.
- **Still on the laptop:** the dev server must listen on the network, not just the laptop (Vite:
  `--host`; Node: `0.0.0.0`). Find the laptop's address (`ipconfig` on Windows,
  `ipconfig getifaddr en0` on a Mac) and make a QR code of `http://<that address>:<PORT>`. Phone and
  laptop must be on the same Wi-Fi. School Wi-Fi often blocks this: if the phone can't load it in
  20 seconds, stop trying and use `/ship` instead.

Ask: **"What feels wrong when you use it with your thumb?"** Write the answers down. Those come first.

## 2. Make it installable (add to home screen)

This is what makes friends say "wait, it's an app?". The app needs, in its public folder:

- `manifest.json` (link it with `<link rel="manifest" href="/manifest.json">`): `name`, `short_name`
  (12 characters or fewer, it shows under the icon), `start_url: "/"`, `display: "standalone"`,
  `background_color`, `theme_color` (take both from `brand/tokens.css` if `/branding` ran), and
  `icons` at 192x192 and 512x512 PNG.
- **Icons:** made from the logo in `apps/<codename>/brand/` if there is one; otherwise offer `/branding`
  or a simple letter-on-color icon. Also `<link rel="apple-touch-icon" href="/icon-192.png">` for iPhones.
- In `<head>`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  and `<meta name="theme-color" content="...">`.

Installing only works over **https**, so test it on the live address after `/ship`:
- **iPhone (Safari):** Share button, then "Add to Home Screen".
- **Android (Chrome):** the menu, then "Add to Home screen" or "Install app".

Don't add a service worker or offline mode unless the student asks for "works without internet".
It's the source of most "my change doesn't show up" confusion. If they do want it, say that cost first.

## 3. Fix what feels wrong

Use **`mobile-native`** for the fixes, starting with what the student wrote down in step 1. The usual
suspects, in order: text inputs that zoom the page (font size under 16px), buttons too small for a
thumb (aim for 44px), content hidden under the notch or the bottom bar, the page height jumping when
the address bar hides (`100dvh`, not `100vh`), and hover effects that stick after a tap.

## 4. Prove it

`npm run shot -- <url> --mobile` and look at the picture. Then the real test: the student opens it
from the home-screen icon and does the app's one main thing with one thumb. It counts only when that works.

Suggest `/wrap` to save it. Next good step: `/playtest`.

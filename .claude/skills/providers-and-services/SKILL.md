---
name: providers-and-services
description: Core architecture for every app here. Every outside capability (WhatsApp, SMS, email, payments, maps, AI, auth, storage, any API) sits behind a Provider interface with a real implementation AND a simulator; business logic lives in Services; seed data makes it runnable on first boot. Use before writing any feature that talks to something outside the app, when an idea needs an integration you can't set up yet, or when adding test data.
---

# Providers and Services: real or simulated, never fake

Students must be able to build, run and fully test an app **locally, today**, before any account,
API key, phone number or payment setup exists. So every outside dependency gets a **simulator**:
a working stand-in, clearly labelled, that behaves like the real thing through the same interface.

> Someone wants a WhatsApp bot? Build the bot against a `MessagingProvider`. Ship a **simulated
> WhatsApp** (an in-app phone-style chat panel) as the first provider. The real WhatsApp provider is
> a later swap of one line of config. The bot logic never changes.

## The three layers

```
UI  ──▶  Services  ──▶  Providers  ──▶  the outside world (or its simulator)
         (the app's      (one interface per capability,
          rules)          real + sim implementations)
```

| Layer | Holds | Never holds |
|---|---|---|
| **Provider** | Talking to ONE outside capability: send a message, charge a card, call an LLM, geocode. | Business rules. `if (user.isPremium)` does not belong here. |
| **Service** | The app's rules: "when a customer texts STOP, unsubscribe them and confirm". Depends on provider **interfaces**. | Vendor SDK calls, fetch URLs, API keys. |
| **UI / routes** | Showing things, calling services. | Provider calls. The UI never knows which provider is active. |

## Folder layout (inside the app folder)

```
src/
  providers/
    messaging/
      index.ts      interface + getMessagingProvider() factory (reads env)
      sim.ts        the simulator (default)
      whatsapp.ts   the real one, added when there's a key
    ai/             copy of kit/ai (already provider-shaped: openrouter + sim)
  services/
    orderService.ts      rules, depends on MessagingProvider, PaymentProvider…
  seed/
    seed.ts         deterministic demo data, runs on first boot or `npm run seed`
  sim/              simulator UIs: the fake phone, fake inbox, fake payment sheet
```

Worked examples (interface, simulator, real provider; messaging adds a service and simulator UI):
`.claude/skills/providers-and-services/examples/messaging/` and `examples/email/` (sim + the hub relay).

## Rules

1. **Interface first.** Write the provider interface in terms of what the app needs (`send(to, text)`,
   `onMessage(handler)`), not what the vendor's SDK looks like.
2. **Simulator is the default.** `PROVIDER_MESSAGING=sim` unless a real key is configured. The
   factory picks: explicit env setting, then "real if its key exists", then sim. Log the choice once
   at startup: `messaging: sim`.
3. **Simulators are real software.** They store state (in memory or SQLite), enforce the same limits
   (message length, rate, required fields), fail the same ways (invalid number, card declined), and
   can be driven by hand from a **simulator UI** in the app. A mock that returns `{ ok: true }` for
   everything is not a simulator.
4. **Label simulated things, on screen.** A small "Simulated" tag on the fake phone or the test card
   sheet. Never pass simulated data off as real. That's the difference between a simulator and a fake.
5. **Seed data is part of the feature.** Every app boots with believable, deterministic sample data
   (no `Math.random()` in seeds; use a fixed list or a seeded generator). Empty screens on first run
   are a bug.
6. **Tests run against simulators.** Services get tested with sim providers injected. No network in tests.
7. **Services take providers as arguments** (`createOrderService({ messaging, payments })`), so a test or
   a demo can hand in any implementation. No hidden global imports of a concrete provider.
8. **Keys live server-side** in `.env`, read only inside the real provider. Never in a service, never in
   the browser.

## Simulators to reach for

| The idea needs | Provider | Simulator |
|---|---|---|
| WhatsApp / SMS / Telegram / Discord bot | `MessagingProvider` | In-app phone-style chat panel; messages stored; the bot replies live |
| Email (sign-up, receipts, newsletters) | `EmailProvider` (`sim`, `locker`) | In-app inbox at `/sim/inbox` showing rendered emails |
| Payments / checkout | `PaymentProvider` | Test checkout sheet with good and declined test cards; ledger table |
| Login / accounts | `AuthProvider` (`sim`, `locker`, or own) | "Sign in as…" picker over seeded users |
| Maps / places / delivery tracking | `GeoProvider` | Seeded places; route simulated along a fixed path with a timer |
| Push notifications | `NotifyProvider` | In-app toast tray + notification log |
| Scraping / 3rd-party data API | `DataProvider` | Recorded fixture responses in `seed/fixtures/`, replayed |
| Hardware / sensors / IoT | `DeviceProvider` | Sliders that generate readings; scripted scenarios |
| AI (chat, JSON, images, decisions) | `kit/ai` | Built in: `AI_PROVIDER=sim`, or no key |
| Multiplayer | `RoomProvider` | Bot players that join and act on a timer |

## Incubator services (after `/connect`)

The BHS Incubator hub gives each app real versions of the common providers. Each still has a
simulator, which stays the default locally. Settings land in `apps/<codename>/.env`.

| Need | Real one | Notes |
|---|---|---|
| Hosting | The app's Railway slot | `/ship`. Listens on `PORT`, has `/health`. |
| AI | `OPENROUTER_API_KEY` | The app's own key with a monthly cap. `kit/ai` already reads it. |
| Email | `locker` provider: hub relay | `examples/email/`. 50 a day, one recipient per call. Uses `LOCKER_APP_SECRET`, server-side only. |
| Sign-in | See below | `sim` provider ("Sign in as…") locally. |
| Database | `node:sqlite` | Built into Node 22.18+: no install, no Docker. File at `DATABASE_PATH` (`./data/app.db` locally, `/data/app.db` on Railway). |

**Sign-in decision:** default is **no sign-in until the app needs it**. When it does: an app only
for BHS people uses **"Sign in with BHS"** (`locker` AuthProvider: redirect to
`$LOCKER_URL/oauth/authorize?client_id=$LOCKER_APP_ID&redirect_uri=…&state=…`, then the server
posts the `code` to `$LOCKER_URL/oauth/token` with `LOCKER_APP_SECRET` and gets `{ user: { sub, email, name } }`;
key users by `sub`). An app for the public (families, expats) gets its own simple sign-in instead.
Redirect URIs must be `http://localhost:*` or the app's Railway address. It's standard OpenID Connect
(discovery at `$LOCKER_URL/.well-known/openid-configuration`), so any login library works: `school-sign-in`
has copy-paste setups for Express, Hono, Next.js (Auth.js) and Python (Authlib), including apps hosted elsewhere.

## Done means

- The app runs with **zero keys** (`AI_PROVIDER=sim`, every `PROVIDER_*=sim`) and every core flow works.
- The simulator UI is reachable (a dev panel, or `/sim/...`) and labelled.
- Seed data fills every screen on first boot.
- Switching a provider to real is one env change, and the service code doesn't change.

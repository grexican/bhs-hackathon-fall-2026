# Integrations: connect your app to another service, fast and safely

Read when an idea needs data or actions from outside the app: weather, a map, a book list, someone's
Google Calendar, Slack, Notion, Stripe, "when X happens, do Y". Pick the first rung of the ladder that
works; most hackathon apps never need rung 4.

## The ladder (stop at the first rung that works)

1. **The Locker already has it.** AI, email, sign-in, hosting, the database, push notifications, file
   storage, the vault, a Feedback button. Use those: no new account, no new key. (`/connect`, AGENTS.md)
2. **A free public API with no key.** Call it from a **server route** (`server.js`), cache the answer, done.
   List below.
3. **One service with its own API key** (Stripe in test mode, a weather API with a free key, Spotify's API).
   A provider + simulator (`providers-and-services`): the simulator works today, the real provider when the
   key is set. The key goes on the server only: `npm run locker:set -- <codename> SPOTIFY_KEY=...` puts it on
   the host and in `apps/<codename>/.env`. Never in `src/`, `public/` or git.
4. **Many apps, or your users' own accounts** ("connect your Google Calendar / Slack / Notion"). That's
   what integration platforms are for (table below). Usually overkill for a hackathon: build the simulator
   first and show the flow with it. Ask an organizer before signing up for any of them.

## Free public APIs (no key, call from the server)

| Need | API | Note |
|---|---|---|
| Weather and forecasts | Open-Meteo (`api.open-meteo.com`) | No key, generous free use; credit them |
| Address ↔ coordinates | Nominatim (OpenStreetMap) | Max 1 request a second, send a `User-Agent`, cache results |
| Maps | Leaflet + OpenStreetMap tiles | Already in the kit: the `maps` skill |
| Countries, flags, currencies | REST Countries (`restcountries.com`) | Static data: fetch once, save it |
| Exchange rates | Frankfurter (`api.frankfurter.app`) | Daily rates (European Central Bank) |
| Books | Open Library (`openlibrary.org`) | Search, covers, authors |
| Encyclopedia facts and images | Wikipedia REST API | Short summaries per page; send a `User-Agent` |
| Art and museums | The Met Collection API, Art Institute of Chicago API | Public-domain images flagged as such |
| Words, rhymes, definitions | Datamuse, Free Dictionary API (`dictionaryapi.dev`) | Word games, writing helpers |
| Quiz questions | Open Trivia DB (`opentdb.com`) | Check categories for your audience |
| Recipes | TheMealDB (test key `1` is public) | Fine for prototypes |
| Pokémon and game data | PokéAPI | Fan projects; cache, it asks you to |
| Space picture of the day | NASA APOD (`DEMO_KEY`) | Low limits on `DEMO_KEY`; get a free key for more |
| Placeholder photos and avatars | Lorem Picsum, DiceBear | Placeholders only: replace with real content |

Rules for all of them: call from the server (no CORS surprises, you can cache), cache answers in SQLite so
a demo never waits on someone else's server, and show a designed error state when the API is down.
Check each API's terms page once; a few ask for credit or a `User-Agent` header.

## Integration platforms (rung 4)

| Platform | What it is | License and price | Use it when | Watch out |
|---|---|---|---|---|
| **Nango** | Auth for ~1,000 APIs (OAuth and API keys) plus a proxy that adds and refreshes your users' tokens | Source-available (Elastic License 2.0). Cloud free tier: 10 connections. **Free self-host is auth + proxy only** (no syncs, webhooks, triggers or tool calls) | Your users connect their own accounts (Google, Slack, HubSpot…) and you call those APIs for them | Self-hosting needs Postgres + Redis (Docker): too heavy for this kit's laptops. Use the cloud free tier with an organizer's account |
| **Activepieces** | Open-source Zapier: flows ("when a form is sent, add a row and message Slack") and 700+ connectors called pieces | MIT (pieces too). Each piece is also an npm package (`@activepieces/piece-<app>`) you can call as a plain library, no platform | You want one or two ready-made connectors in your own code, or a no-code flow | Pieces turn off TLS certificate checks for the whole process on every request. Never load one inside `server.js`: run it in a separate worker (`node:worker_threads`) that only it uses. Untrusted community pieces: the same, always sandboxed |
| **Composio** | Hosted tool-calling for AI agents: 1,000+ app toolkits with managed sign-in, plus an MCP gateway | SDK is MIT; the tools, runtime and token storage are its hosted service. Free tier: 20,000 tool calls a month | An AI feature that must act in many apps for a user (read Gmail, post to Slack) | Your users' tokens live in Composio's cloud. Needs its own account and key (server side only) |
| **n8n** | Visual workflow automation, 400+ integrations, AI nodes | Fair-code (Sustainable Use License): free to self-host for your own use; paid cloud | A back-office flow you build by clicking, not in the app's code | Self-hosting is a separate server; the app calls it through a webhook URL kept on the server |

The pattern is the same for every row: **a provider interface in your app, a simulator first, the real
platform behind it on the server.** The UI never knows which one is active.

## Safety rules (you're under 18, and so are many of your users)

- **No personal accounts or keys.** Don't sign up for services with your own or a parent's account and
  card for a hackathon app. Many services' terms require you to be 13+ or 18+. Ask an organizer: they decide
  which services are OK and whose account to use. Free, keyless APIs (above) and test modes need nobody's
  permission.
- **Keys live on the server only.** In `apps/<codename>/.env` and on the host via `npm run locker:set`.
  Never in `src/`, `public/`, a `VITE_` variable, the browser, a screenshot or git. Anything the browser
  downloads, anyone can read.
- **Your users' passwords and tokens go in the vault** (`keep-secrets-safe`), never the database or logs.
- **Ask for the least.** Request only the permissions (OAuth scopes) the feature needs: read-only calendar,
  not full Google access.
- **Payments stay in test mode** (Stripe test keys, a simulated checkout sheet). No real money at a hackathon.
- **Don't send people's data to services they didn't agree to.** Say on screen what goes where.

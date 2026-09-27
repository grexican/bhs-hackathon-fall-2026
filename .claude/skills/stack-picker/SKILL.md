---
name: stack-picker
description: "Use before scaffolding any new app, game, or site. Picks the best-in-class stack FOR THIS PRODUCT (not one default) - Astro, Vite + React, Next.js, Phaser, three.js, D3, websockets, or a PWA - and gives the exact non-interactive scaffold command and the PORT wiring so the dev server boots in seconds."
---

# Stack Picker

Pick the stack from what the product needs, not from habit. Then scaffold it with a
command that never stops to ask a question.

## House rules (every stack)

- **Boot in seconds.** No Docker, no cloud setup, no database server. `npm install`
  then `npm run dev` must be enough.
- **Bind to `PORT`.** Get a free port with `npm run port` and pass it to the dev server.
  Several apps run side by side, so never use a hardcoded port.
- **Non-interactive scaffolds only.** Every command below has flags that skip prompts.
  If a CLI still asks a question, add its `--yes` flag or scaffold a plain template instead.
- **No nested git.** Scaffold with git turned off (`--no-git`, `--disable-git`).
- **Check versions when in doubt.** `npm view <package> version` and the official docs
  beat memory. Use the `search-first` skill for any extra library.

## Decide in 30 seconds

Ask these in order. Take the first match.

| If the product is... | Pick | Tradeoff in one line |
|---|---|---|
| Mostly content: a portfolio, club site, event page, blog | **Astro** | Fastest pages and great for content; heavy interactivity needs islands. |
| A tiny page or toy with a little JS | **Vite + vanilla TS** | Nothing to learn; you hand-roll every UI update. |
| An interactive app (tools, quizzes, planners, dashboards) with no accounts | **Vite + React + TS** | Huge ecosystem and instant HMR; data lives in the browser only. |
| Needs accounts, a shared database, or server-side secrets (API keys) | **Next.js (App Router) + SQLite** | Full-stack in one app; more concepts (server vs client components). |
| A 2D game (platformer, shooter, puzzle with sprites) | **Phaser** on Vite | Physics, sprites, input, and scenes built in; its own way of doing things. |
| A simple 2D game (pong, snake, clicker) | **Plain canvas** on Vite | Zero dependencies and full control; you write the game loop yourself. |
| 3D scene or 3D game | **three.js** on Vite (or **react-three-fiber** inside React) | Real 3D in the browser; 3D math and asset loading take time. |
| Charts, maps, data stories | **Observable Plot** (quick) or **D3** (custom) on Vite | Plot gives good charts in one line; D3 is unlimited but verbose. |
| Realtime multiplayer or live chat | **Vite client + Socket.IO server** | Simple rooms and events; you run a second process on its own port. |
| Used mostly on phones, should install like an app | Any Vite stack + **vite-plugin-pwa** | Installable and works offline; caching can serve stale files while you develop. |

Styling: plain CSS or CSS modules by default. Add **Tailwind v4** when the student wants
fast utility styling. (Visual design choices belong to the design skills.)

## Get a port first

```bash
# bash / Git Bash
export PORT=$(npm run -s port)
# PowerShell
$env:PORT = npm run -s port
```

npm scripts run under `cmd.exe` on Windows, where `$PORT` does not expand. So read the
port **in the config file** (below), not with `--port $PORT` inside `package.json`.
The CLI flags are fine when you type the command yourself in bash.

**The one start command that works everywhere:** `npm run dev -- --port <n>`. Vite, Next and
Astro all accept `--port`, and it works in every shell. The `/demo` tooling starts apps exactly
this way (and also sets `PORT`), so a custom Node server must read `process.env.PORT`.

## Scaffold commands

Run these from the folder where the app should live. Replace `my-app` with the app name.

### Vite (vanilla TS, React, and the base for games, 3D, charts)

```bash
npm create vite@latest my-app -- --template react-ts --no-interactive --no-immediate
# other templates: vanilla-ts, vue-ts, svelte-ts, preact-ts
cd my-app && npm install
```

Port wiring in `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || undefined, strictPort: true },
})
```

CLI form: `npx vite --port $PORT --strictPort`. `strictPort` makes Vite fail loudly
instead of silently moving to another port.

### Tailwind v4 (optional, Vite)

```bash
npm install tailwindcss @tailwindcss/vite
```

Add `tailwindcss()` to `plugins` in `vite.config.ts`, and put `@import "tailwindcss";` at
the top of the main CSS file. No `tailwind.config.js` is needed in v4.

### Astro

```bash
npm create astro@latest my-site -- --template minimal --install --no-git --yes --skip-houston
```

Port wiring in `astro.config.mjs`: `server: { port: Number(process.env.PORT) || undefined }`.
CLI form: `npx astro dev --port $PORT`.

### Next.js (App Router)

```bash
npx create-next-app@latest my-app --ts --tailwind --eslint --app --src-dir --use-npm --disable-git --yes
```

Port: `next dev` reads the `PORT` environment variable by itself. CLI form: `npx next dev -p $PORT`.
Next.js 16 uses Turbopack by default; see the `nextjs-turbopack` skill.

Database (only when data must be shared between users or devices):

```bash
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3
```

One file on disk (`data.db`, add it to `.gitignore`), no server. If `better-sqlite3` fails
to build on this machine, use Node's built-in `node:sqlite` (Node 22.13+) instead.
Use a hosted database only when the app must be online for other people.
Keep API keys in `.env.local` and read them only in server code.

### Phaser (2D game)

```bash
npm create vite@latest my-game -- --template vanilla-ts --no-interactive --no-immediate
cd my-game && npm install phaser
```

Create one `Phaser.Game` with a scene in `src/main.ts`. Put sprites and sounds in `public/assets/`.

### Plain canvas (simple 2D game)

Use the Vite `vanilla-ts` template. Draw on a `<canvas>` with a `requestAnimationFrame`
loop. Scale the canvas for `devicePixelRatio` so it is sharp on phones.

### three.js / react-three-fiber (3D)

```bash
npm create vite@latest my-3d -- --template vanilla-ts --no-interactive --no-immediate
cd my-3d && npm install three && npm install -D @types/three
# or, inside a React app:
npm install three @react-three/fiber @react-three/drei
```

### Charts and data viz

```bash
npm create vite@latest my-viz -- --template vanilla-ts --no-interactive --no-immediate
cd my-viz && npm install @observablehq/plot     # or: npm install d3
```

Put data files (CSV, JSON) in `public/data/` and load them with `fetch`.

### Realtime multiplayer (Socket.IO)

```bash
npm create vite@latest my-party -- --template react-ts --no-interactive --no-immediate
cd my-party && npm install socket.io socket.io-client
```

Write a small `server.js` (Node, `new Server(Number(process.env.WS_PORT), { cors: { origin: "*" } })`).
Get a second free port for it (`npm run port` again, save it as `WS_PORT`) and give it to the
client as `VITE_WS_PORT`. Keep game state on the server; clients send inputs, the server
sends state.

### PWA (installable, phone-first)

```bash
npm install -D vite-plugin-pwa
```

Add `VitePWA({ registerType: "autoUpdate", manifest: { name, short_name, icons } })` to the
Vite plugins. Test the install prompt on a production build (`npm run build && npx vite preview --port $PORT`).

## After scaffolding

1. Start the dev server on `PORT` and open it once.
2. Run the `verify-in-browser` skill on the empty app: screenshot, zero console errors.
3. Only then start on the first feature.

Say the chosen stack and its one-line tradeoff to the student before you scaffold.

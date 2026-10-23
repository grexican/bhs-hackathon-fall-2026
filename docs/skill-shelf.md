# Skill shelf

Extra skill packs you can add later, when your app needs them. Not installed: add one only when
you'll use it (each one makes the agent read more). Run the command from the kit root, choose
**Cursor** (and Claude Code) when it asks, then `npm run agents:sync`.

| Pack | What it's for | Add it |
|---|---|---|
| [Remotion](https://github.com/remotion-dev/skills) | Make videos with React code (promo clips, animated explainers) | `npx skills add remotion-dev/skills` |
| [Anthropic skills](https://github.com/anthropics/skills) | Official packs: documents, slides, spreadsheets, PDFs, art | `npx skills add anthropics/skills` |
| [Vercel agent skills](https://github.com/vercel-labs/agent-skills) | React and Next.js best practices, web design review | `npx skills add vercel-labs/agent-skills` |
| [Expo skills](https://github.com/expo/skills) | Real phone apps (iOS and Android) with Expo | `npx skills@latest add expo/skills --skill '*'` |
| [skills.sh](https://skills.sh) | Search thousands more | browse, then `npx skills add <owner>/<repo>` |

**Already in the kit** (no install): after the first version, `/on-my-phone`, `/playtest`, `/share-it`,
`/whats-next` and `/pitch`; uploads and AI images that survive deploys (`save-files`); maps with no key (`maps`); safe AI features (`ai-safety`); one test before tricky logic (`test-first`); school sign-in for any stack (`school-sign-in`); design taste (`design-director`, `ui-ux-pro-max`, `impeccable`,
`design-taste-frontend`, `high-end-visual-design`, `minimalist-ui`), ready-made components from the React galleries
(`beautiful-components`), video from HTML (`hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`), motion (`gsap-*`, `animate`),
3D (`threejs-*`), games (`game-feel`, `game-ui-ux`). Full list: `.claude/skills/CATALOG.md`.

Only add packs from sources you trust: a skill is instructions your agent will follow.

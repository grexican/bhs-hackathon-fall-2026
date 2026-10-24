---
name: quorum
description: What BHS Labs Quorum is (the program's shared knowledge base - a Commons of BHS Labs know-how, a discovery catalog of tools, libraries, APIs and skill packs for student apps, and a private space per project) and how to connect it to Cursor, Claude Code, ChatGPT or Claude as an MCP server. Use ONLY when the student mentions Quorum, an organizer has told them to connect it, or they ask where the BHS Labs knowledge base or the tool catalog is. Never suggest connecting it on your own.
argument-hint: "[what to look up]"
---

# BHS Labs Quorum

**Quorum** is BHS Labs' shared knowledge base. Every member signs in with their BHS account and sees:

- **Commons** (everyone can read): how BHS Labs builds (the kit, stacks, security, design, AI, hosting on
  the Locker), plus a **discovery catalog** of tools, libraries, APIs and skill packs students' apps can use.
- **A private space per project** (made with each Locker project): the team's notes and research.

It's optional. Only connect it when the student asks or an organizer has said to; don't bring it up
otherwise. The kit already works without it.

## Use it in the browser

`https://quorum-web-production-2fa5.up.railway.app/t/bhs-labs`: sign in with BHS, open Commons, or ask a
question in plain words; it answers with citations to the documents it used.

## Connect it to the AI (MCP)

Quorum is an MCP server. The address:

```
https://quorum-web-production-2fa5.up.railway.app/t/bhs-labs/api/mcp
```

Sign-in is OAuth: the AI app opens Quorum in the browser, the student signs in with BHS and allows it.

| App | How |
|---|---|
| Cursor | Settings → MCP → Add a custom server: `{ "mcpServers": { "quorum": { "url": "<the address>" } } }`, then click its Connect / Needs login button. |
| Claude Code | `claude mcp add --transport http quorum <the address>`, then `/mcp` → quorum → Authenticate. |
| Claude (claude.ai, desktop) | Settings → Connectors → Add custom connector, paste the address. |
| ChatGPT | Settings → Apps & Connectors → Advanced: Developer mode on, then create a connector with the address and OAuth (needs a plan with developer mode). |

Don't add it to the kit's `.mcp.json` or `.cursor/mcp.json` for everyone; it's per student, when they want it.

## Using it once connected

- **Before adding a library or a service:** search Commons' catalog (`quorum_knowledge_search`, or ask
  `quorum_knowledge_answer`) for what BHS Labs already recommends, then still check it fits (`search-first`).
- **"How do we do X here?"** (deploy, sign-in, the vault, AI tiers): Commons has the doctrine; the kit's
  own skills and `AGENTS.md` win if they disagree, because they're what the code follows.
- **Team notes:** the project's private space is the place for research, decisions and playtest notes the
  team wants to keep. Write there only when the student asks, and never secrets or keys.
- Answers come with citations; give the student the link to the document, not just the summary.

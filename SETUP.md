# SETUP.md: instructions for the agent

A student pasted *"Set me up for the BHS hackathon: <repo-url>"* into Cursor, in an empty folder.
Get them from zero to a working project. They may never have used a terminal.

**How to talk:** before each step, one plain-English line ("Checking you have git…"). After it,
one line on the result. No walls of text. Run one command at a time. If something fails, say
what it means in one sentence and try the fix; after two failed fixes, tell them to raise a hand.

## 1. Check the tools

```bash
git --version
node --version      # need 22.18 or newer
```

Install what's missing or too old, then re-check (a new terminal may be needed for PATH):

| | Windows | Mac |
|---|---|---|
| Git | `winget install --id Git.Git -e --source winget` | `brew install git` if `brew` exists, else `xcode-select --install` |
| Node 22.18+ | `winget install --id OpenJS.NodeJS.LTS -e --source winget` | `brew install node@22` if `brew` exists, else the installer from nodejs.org |

Installers may pop up a permission window: tell the student to click **Yes / Allow**.

## 2. Get the project

```bash
git clone https://github.com/grexican/bhs-hackathon-fall-2026 .
```

Already cloned (to read this file)? Skip ahead. If the folder isn't empty, clone into `bhs-hackathon` instead, tell the student to open that
folder (File → Open Folder) and paste *"continue setup from SETUP.md step 3"* in a new chat.

## 3. Install

```bash
npm run setup
```

Say: "Installing the tools the project needs, about a minute."

## 4. Their name and branch

Follow `.claude/skills/onboard/SKILL.md`: ask name and email **in chat**, set git identity,
create branch `firstname-lastname`, first commit. Skip the push question for now.
(`npm run onboard` does the same in a terminal, but it waits for typed answers.)

## 5. The AI key

1. Copy `.env.example` to `.env` (skip if `.env` exists).
2. Ask: "Paste the OpenRouter key the organizers gave you (starts with `sk-or-`). No key yet? Say *skip*."
3. Write it to `OPENROUTER_API_KEY=` in `.env`. **Never repeat the key back**, never put it in any
   other file, never commit `.env`.

## 6. Prove it works

```bash
npm run ai -- ask fast "hi"
```

- Real reply → "AI works."
- `(simulator…)` → "No key yet, so AI is simulated. Everything still runs. Add the key to `.env` later."

## 7. Done

Say, in two lines: "You're set up on your own branch. Type **/start** and your idea in one sentence."

# Library

Reference docs the AI reads **just in case**: before it builds something by hand, it checks
`INDEX.md` and asks "is there a doc that would make me better at this?". If one fits, it reads it
first and tells you which one it used.

These are not skills or slash commands. Nothing here runs a workflow. They are know-how (how
enemy AI works, how to make a hit feel strong, how to test a game with a bot), written for this
kit's stack: browser apps, phones first, plain JavaScript examples.

You can read them too. `games/start-here.md` is a good first read if you're making a game.

## Add a doc

1. Write `library/<area>/<topic>.md`. One topic per file. Start with one line on **when** to read
   it, then short sections with small code examples that work in this kit's stack.
2. Add **one line** to `INDEX.md`, under its area: `` `library/<area>/<topic>.md` — when to read it ``.
   Keep the line to the trigger (the situation), not a summary. The AI scans the whole index
   often, so every word there costs something.
3. Write it in your own words. If you learned it from somewhere, say where at the bottom.

A doc that the student triggers by typing a command, or that walks them through steps, is a
skill instead: `.claude/skills/<name>/SKILL.md`.

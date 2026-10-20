---
name: research
description: Quick web research with real sources for the student's app. Finds 3 to 5 sources, writes a short summary and what it means for their app, and saves it to docs/research/<topic>.md. Use when a student types /research, asks "what already exists" or "how do others do X", or a decision needs facts.
argument-hint: "[topic]"
---

# /research: find out, with sources

1. **The topic** in one line. Vague? Ask one question to narrow it (for whom, which part).
2. **Search the web.** Keep 3–5 sources that are recent and trustworthy: official docs, real
   products, studies, good articles. Skip spam and "top 10" lists. Open each one. Never cite a page
   you didn't read.
3. **Save `docs/research/<topic>.md`** in the app folder (topic in kebab-case):

   ```markdown
   # <Topic>
   _<date>_

   ## In short
   <3–5 lines: what we found>

   ## What it means for <app name>
   - <2–4 bullets: do this, avoid that, borrow this idea>

   ## Sources
   1. [<title>](<url>): <one line on what it says>
   ```

4. Tell the student the "In short" and the bullets in chat, then ask what to do with it.

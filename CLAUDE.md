@AGENTS.md

## Claude Code notes

- Workflows are skills: `/start`, `/demo`, `/onboard`, `/wrap` all live in `.claude/skills/`.
- `/demo` launches the `bare-builder` subagent with `run_in_background: true`, then interviews
  the student with `AskUserQuestion`, one question per call.

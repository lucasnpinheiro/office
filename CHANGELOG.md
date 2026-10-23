# Changelog

## 0.1.1 (agent-office 0.15.2, personas 0.1.1, learning 0.1.1, laya 0.1.1)

- `agent-office`: redraw timer could be armed twice by overlapping `schedule()` calls (timers multiplied); a
  generation counter now lets only the newest one arm it. Widths measured in terminal cells (CJK/emoji = 2), so wide
  labels no longer break card borders. TodoWrite/TaskUpdate ignore malformed entries and unknown statuses. Quota
  detection no longer matches "credit card" or a stray "429". Session start also resets sort, width and the session-id
  fallback. `/office view` without a value toggles and refuses unknown values; `v` resizes the pane. Observer hooks carry
  `.catch` and fire-and-forget calls never leave unhandled rejections. Help lists the real hotkeys; subcommands are
  case-insensitive; the hidden-cards hint counts cards. `tsc` clean.
- `personas`: router hook finds Python as `python3` or `python` and reads stdin as UTF-8 (Windows).
- `laya`: MCP starts through `scripts/laya-mcp.sh`, which fails fast with a clear message without `LAYA_HOME` or `uv`.
- `learning`: own MIT `LICENSE` and a NOTICE for the CC BY 4.0 `task-observer` skill.
- Every plugin: README, LICENSE, homepage/repository/keywords/icon in `plugin.json`.
- Installer: rejects unknown flags, `--scope` needs a value, scoped uninstall, tolerant re-run (marketplace refresh),
  Windows `.cmd` shim support, usage via `npx github:lucasnpinheiro/office` (the npm package is not published).
- Docs: README rewritten with the verified CLI commands, update/troubleshooting; CI validates with `--strict` plus a
  non-fatal `--profile directory` step and a router-hook smoke test.

## 0.1.0

- First public export.
- `agent-office` 0.12.1: animated agent monitor mod (`/office`).
- `personas`: `rapido`/`padrao`/`profundo` agents, persona docs, optional `UserPromptSubmit` tier router (Laya optional).
- `learning`: `task-observer` skill (CC BY 4.0, Eoghan Henn), empty log template, CLAUDE.md snippet.
- `laya`: MCP wiring, usage skill, compose reference. Laya itself is not bundled.
- Plugin icons (512x512). `claude-office` installer (`npx`), `scripts/sync-from-agents.sh`, `scripts/check-sanitized.sh`.

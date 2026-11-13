# Changelog

## 0.17.0 (agent-office, chips reach the installed plugin)

- Root cause of "nothing shows": PRs #32/#33 shipped without a version bump, so installs stayed on cached 0.15.2. Bumped to 0.17.0; run `claude plugin marketplace update office` then `claude plugin update agent-office@office` and reload.
- Terminal cards show `🎨 UX/UI · 🎼 Sonnet · 🟢 baixo` on one line (two lines when wider than the card), the task as title, long titles wrap to a second line. A description without the prefix takes model and effort from `subagent_type` (rapido, padrao, profundo).
- App cards: chips are filled (`userMessageBackground`).

## Unreleased (previous)

- App surfaces (`desktop`, `vscode`, `mobile`) now draw the Chips design as graphical cards (Box/Text with rounded border by state, title, chip row, bar, percent and time, theme-key colors for light/dark) instead of the terminal's text box; the terminal keeps the text cards unchanged. Only the cards view; other views stay text on the app. New `hooks/app-cards.ts` (`isAppSurface`, `appCards`). The engine has no raw HTML element: the app draws these through its own Box/Text.
- Agent cards show chips with icons: persona, model (🪶 Haiku, 🎼 Sonnet, 👑 Opus) and effort (🟢 baixo, 🟡 médio, 🔴 alto), parsed from the description `<icon> Persona · <icon> Model · <icon> esforço: task`; the task is the card title. Terminal card is now 7 lines. Description without the format falls back to `🤖 Agente`.

## 0.16.0 (agent-office, T-014 leftovers, T-015 docs and CI)

- The running spinner glyph now cycles with the frame in the tree, cards and waterfall renders; it stays fixed in reduced motion
  and ASCII (AC-045/046, tested through `renderCompact`). The bell is not wired: there is no pending-decision state (`◆` needs
  T-011), so AC-045's bell is unmet.
- README states what ships, the keys (g, o, v, f, s, b, p, n, q), the `OFFICE_*` variables, what is terminal only and what is not
  verified in the Claude app. `docs/privacy.md` checked, unchanged.
- Allow, Decline, Stop, Retry, Pause and open-in-chat stay hidden: T-011 and T-012 are BLOCKED until the manual probes in ADR 0002
  are run (user decision). No permission or `tool.check` code.
- CI: the `claude plugin test` step stays non-blocking (CLI/runtime availability in CI is unverified) and now prints `SKIPPED`
  explicitly when the subcommand is missing.
- Coverage of 93% is not measurable with the current runner (`coverage-report.md`).

## Unreleased (agent-office, PR 19 findings)

- Security: `+N commits` runs only `rev-parse` / `rev-list` / `symbolic-ref` through `env GIT_CONFIG_NOSYSTEM=1 GIT_OPTIONAL_LOCKS=0
  git -c core.fsmonitor=false -c core.hooksPath=/dev/null`, and only for the session repo or its `.claude/worktrees/<name>`
  (textual check; a symlink inside the repo still escapes it). Other cwds omit `+N`.
- Workflow agents: the probe (2026-11-05) shows `agent.spawn` returns the `agentId` and `SubagentStop` carries it, so the end is
  matched; a stop that arrives before the spawn resolves is applied afterwards; a workflow agent with no `agentId` ends as
  "Interrompido" (unknown end) instead of staying active for ever.
- ETA is dropped when any open agent is of another or unknown model; the worktree divider masks branch, path and base; `f` and
  `s` are hidden in Cost, Tools and Workflow; detail links honor the ASCII vocabulary.

## Unreleased (agent-office, T-007 to T-010 integration)

- `agent-office`: the Cost, Tools and Workflow views are reachable with `g` (Workflow only while a workflow run exists);
  the compact render now gets the RunModel with the main session's tokens. The main session's own `turn.step` tokens were
  never summed (the usage was read only for subagents), so the total stayed `partial` for ever; fixed.
- Header shows `tokens N` with `parcial` when something is unknown (the dead per-agent cost read is gone); the session USD
  appears only when `$.session.usage()` gives it.
- Grouped mode nests each agent under its worktree divider (once). `base <base> +N commits` uses the real base (upstream or
  `origin/HEAD`), runs in the background with a 2 s limit and a 30 s cache, and is omitted on any failure.
- Detail screen is `view-detail` for both views (every agent-provided text masked); an agent that left the list falls back to
  the list with a warning. ETA counts only same-model agents still running and uses the parallelism seen in finished runs.
- Workflow agents are grouped by `workflow.runId` (phases and rounds are not available from the engine).

## 0.1.2 (agent-office 0.15.3)

- `agent-office`: agents spawned with `isolation: "worktree"` were never marked as worktree agents. `agent.spawn`'s input
  carries no `isolation` (only the Agent call does), so the spawn was pinned to the session's cwd and the `⧉ worktree`
  group never showed. The Agent call's input is now read at `tool.call` and the spawn takes it from there; the agent's
  cwd comes from its first file inside `.claude/worktrees/`.

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

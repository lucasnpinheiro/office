# Changelog

## 0.24.0 (agent-office, the cards pane fills the terminal and has a scrollbar)

- Root cause of the half-empty pane: the cards window height came from the viewport rows capped at 30 minus the chrome. The cap is gone: the window follows the pane (`bodyRows`) or the terminal rows, so it grows and shrinks on resize.
- A vertical scrollbar (track `░`, thumb `█`, `|` and `#` in ASCII) sits on the last column when the cards overflow; the cards re-wrap one column narrower to make room. j/k still scroll and a stale offset is clamped on resize.

## 0.23.0 (agent-office, the design header in the terminal)

- Header of the terminal views follows the design top: `Office · project · ⎇ branch · #session` with the session cost on the right (tokens when the engine gives no cost), a line with the time and the coloured counts (`rodando`, `concluídos`, `falhas`, then the ETA), and one full-width bar segment per agent in its state colour. The rounded header box and the `Geral` line are gone.
- Alerts are banners: one rounded box per agent that failed or needs the user, with its message and `[Ver]` to open it. Two boxes at most, the rest on one line.
- View tabs under the banners: `Mapa`, `Árvore`, `Worktrees`, `Custo`, `Ferramentas` (`Workflow` while a run exists). A click picks the view; `g` still cycles.
- Not shipped (no engine support yet): the `Pausar`, `Reiniciar`, `Decidir` and `Tentar de novo` buttons of the design.

## 0.22.0 (agent-office, the design card in the terminal, always full, the pane scrolls)

- Terminal cards follow the design card (Proto5 / Chips5): title with the state pill on the right (`Concluído`, `Rodando`, `Falhou`, ...), the persona · model · effort chips, the worktree (`⧉`) or branch (`⎇`) with the role on the right, one bar segment per tool step (width by duration, red on a failed step, the live one last), and the status with cost and time (`~$0,30 · 00:16`; the percent stands in when there is no cost).
- A card is always these 7 rows: the dense 3-row cards of 0.21.1 are gone. A tree taller than the pane shows a window that scrolls one level per press (`j` desce, `k` sobe), with a note above and below saying where the rest is. No card is dropped.
- A title too long for the row keeps the row to itself; the pill gives way (glyph and border still carry the state).

## 0.21.1 (agent-office, no card is ever hidden, 20 levels)

- Cards view: the "+N cards ocultos" cut is gone. When the full 7-row cards do not fit the pane height, every card is drawn dense (3 rows: border, one line with state, name, metric and time, border with role and worktree), so all agents stay on screen.
- Depth: agents nest up to 20 levels (was 10); every level is drawn under its parent.

## 0.21.0 (agent-office, one view in the terminal)

- Terminal: the boxed org chart is gone. The centred cards are the only map of the terminal and always the opening view; `v` alternates cards and tree, and `/office view map` or `OFFICE_VIEW=map` land on the cards too. The app surfaces keep their own map.
- The header box reads `Office Agent Monitor` on the full layout.
- Empty session: the orchestrator card is drawn centred with the waiting line centred under it, instead of a bare line of text.
- The `Geral` line and the legend are centred with the tree.
- Footer: the hint tail (`Tab entre cards · Enter detalhe · …`) is dropped before the hotkey row can wrap; on very narrow panes the labels shrink to the bare keys.

## 0.20.2 (agent-office) and personas 0.1.2 (English persona names, single router source)

- agent-office: persona names are English (`Specialist`, `Architect`, `Mid-level`, `Intern`; the rest unchanged). The pt-BR names (`Especialista`, `Arquiteto`, `Pleno`, `Estagiário`) stay as aliases for the same persona in `chips()`. Persona, model and effort are also read from their icons when the words are missing.
- personas: the UserPromptSubmit hook runs the script named by `MODEL_ROUTER_HOOK` when set, else the bundled `hooks/model-router.sh`.

## 0.20.1 (agent-office, roles and motion on the app map)

- App surfaces (desktop, vscode, mobile): every map card names its role (`orquestrador`, `agente`, `subagente`) on the worktree line, the same depth rule as the terminal cards.
- Motion: the running glyph spins, the bar of a running leaf without a real percent sweeps, and a lit dash runs along the dashed trunk and row buses that lead to a running agent. All static with reduced motion.

## 0.20.0 (agent-office, centred and animated card tree in the terminal)

- Cards view (terminal default): the tree is centred. Each parent card sits centred over its children and the whole block is centred in the pane; the connector leaves the parent at the bottom centre (`┬`) and enters each child at the top centre (`┴`). Subtrees sit side by side; siblings that do not fit wrap into rows hung off a dotted trunk on the left of the block.
- Roles on the bottom border of every card: `orquestrador` (main session), `agente` (top level), `subagente` (deeper). A card in a linked worktree also carries `⧉ branch` there. The full-width worktree dividers of the cards view are gone.
- Animation: a bright pulse runs along the dotted bus of every row that has a running child (off with reduced motion); the spinner glyph and the bar shimmer stay. Each drop takes the colour of its child's state.
- Responsive: rows are packed by the real pane width (60 to 200+ columns tested), no row is ever wider than the pane and every card stays closed. All card tops share one 8-row lattice, so the "cards ocultos" cut never slices a card.
- "delega 1 filho" is singular.

## 0.19.6 (agent-office, the terminal opens on the cards of the design)

- Terminal: a session now opens on the cards view (design Term5, TELA 8: header box, `Geral` bar, parent card, dotted bus, 34-col sibling cards, legend) instead of the boxed org chart. The app surfaces (desktop, vscode, mobile) keep opening on the map of Proto5. The surface is read at session start or, when the event does not carry it, at the first render; an explicit `v`, `/office view` or `OFFICE_VIEW` always wins.
- The boxed org chart stays one `v` away in the terminal (`/office view map`).

## 0.19.5 (agent-office, the app map follows the terminal rules)

- App surfaces (desktop, vscode, mobile): siblings that do not fit one row now split into rows of `(cols - 2 + 2) / 36` cards hung off a dashed trunk on the left, each row under its own dashed bus (same rule as the terminal 0.19.4). Siblings that fit keep the single solid bus of Proto5. Before, `flexWrap` broke the bus mid-row.
- A single top-level agent without children is drawn as the root card; before it fell into "Aguardando agentes" because the root is now the agent itself (0.19.2).

## 0.19.4 (agent-office, wrapped sibling rows hang off a dotted trunk)

- Many siblings (rows that wrap): the left trunk and each row bus are dotted and dim (`┊` and `┄`; ASCII `:` and `.`), so the rows no longer read as a frame. A single row keeps the solid bus of the design.

## 0.19.3 (agent-office, Tab focus no longer paints a box border)

- In the terminal map every cell of a box was a clickable node, so the focused box had its top border painted as a solid bar. Now only the title row is a Button; borders, connectors and the progress bar are plain text.

## 0.19.2 (agent-office, map matches the Office Agent Monitor Redesign PDF)

- Root box is the orchestrating agent itself (design pages 1 and 3): when the session has a single top-level agent, it is the root of the map in the terminal and in the app; the "Claude Code" session box only appears above several top-level agents.
- Terminal boxes are 30 columns wide (4 per row from 128 columns): line 2 is persona · model (the dot is dropped before anything is cut), and the effort moves to the progress line (`▰▰▱▱ 45% 00:14 🟢 baixo`).
- Map footer: `visão (mapa › árvore › cards) · só falhas · fechar · Tab mover · Enter abrir`.

## 0.19.1 (agent-office, the terminal map is boxed from the first frame)

- Root cause of "the CLI layout did not change after the reload": with no agents yet (a fresh session, right after `/reload-plugins`) and in side panes narrower than 40 columns, `renderBoxMap` returned null, so the pane fell back to the old one-line text map ("Office · … · 0 rodando"). Agents only appear later, so the first thing seen was always the old layout.
- No agents: the map draws its header, the root "Claude Code / Orquestrador" box and "Aguardando agentes… use o Claude normalmente" (a filter with no match says so instead).
- Narrow panes: boxes shrink to the pane (`boxWidth`, even widths from 38 down to 24); only panes under 26 columns keep the text map.
- One sibling per row (narrow pane): the parent sits over the trunk column, so its stub meets the children's axis (`┤` junction, no off-by-one `┴┐`).
- New real-pane tests: fresh session at 100 columns and a 34-column side pane both draw boxes.

## 0.19.0 (agent-office, the map is the default view on every surface)

- `initialUi().view` and the `view` atom now default to `map` (`OFFICE_VIEW=compact` still overrides; `v` cycles map > tree > cards).
- Terminal: new boxed org chart (design Term5 "Mapa"): header (Office Agent Monitor, project, branch, session; overall progress, elapsed, estimate), root box, bus, one box per agent (glyph and name, persona / model / effort with icons, branch or worktree, bar, percent, time), grandchildren boxed under their parent. Border colour is the state. Placement uses display width, so emoji never break the right border. Siblings that do not fit wrap to a new row joined by a trunk. `OFFICE_ASCII` draws `+ - |` and drops the icons, `NO_COLOR` drops colour. Panes narrower than one box (or without agents) keep the text map.
- Desktop, VS Code and mobile: the map is a graphical org chart of Box cards (stub, bus, stub into each child, children stacked under their parent; the connector into a running child uses the run tone), each card opens its detail. `appMap()` in `app-cards.ts` builds the tree from the same Graph.
- Terminal boxes are 30 columns (3 to 4 per row on wide panes); the bus has a junction at every child centre and each box top has a matching `┴`; wrapped rows hang from a left trunk; line 3 is the branch or worktree, else the tool or state, never blank; line 2 truncates with an ellipsis. The root box reads `Claude Code` / `Orquestrador`.
- App pane (Proto5): header (project, branch, elapsed, counts), one segment per agent, failure banners with [Ver], tab row (Mapa default, Árvore, Worktrees, Workflow, Custo, Ferramentas), cards with status pill, branch tone, progress and now/time; selecting a card opens the detail beside the map on wide panes, full screen on narrow ones.
- Pane sizing in the map view follows the boxed chart.
- Not verified: the desktop render (no app available here; covered by an element-tree test only) and terminal glyph widths on a real terminal (ambiguous-width glyphs such as the branch symbol).

## 0.18.1 (agent-office, cards really render: parent card and bus)

- Root cause of "still no boxes" on 0.18.0: `installed_plugins.json` held a project-scope install of agent-office pinned to 0.17.0 for the project the session runs in (its `startUi` opens the map view, one line per agent). Project scope wins over the user-scope 0.18.0, so the fresh session never ran the new code. `claude plugin update agent-office@office --scope project` (from that project) fixes it. 0.18.0 itself already drew boxes through the real pane.
- New end-to-end test `real-render.test.ts` (register, session.start, 12 spawns, ui.render of the Pane at 110 and 200 columns) reads the rows the pane draws; it also proves a stale map view does not survive session.start.
- Cards view now draws the main session as the parent card ("Claude Code / Orquestrador") with the dotted bus down to its sibling cards (design TermCards); before, top-level agents floated without a parent. 110 cols fit 2 siblings per row, 120 fit 3, 200 fit 5 (`(cols - 5 + 2) / 36`).
- Bus and vertical glyphs honor NO_COLOR.

## 0.18.0 (agent-office, terminal opens on boxed cards)

- Root cause of "no boxes": the session opened in the map view (`view: 'map'`), which draws the Round 5 tree, one line per agent. The boxed cards (34-col, 7-line, side by side, dotted bus, worktree dividers, overflow row) only existed in the compact view, one `v` away. `startUi` and the `view` atom now default to compact + cards; `v` still cycles cards > map > tree.
- Cards view pins failure and decision rows (`✗`, `◆`) above the boxes, as the tree already did (Term5).
- One hint row: the map/tree view no longer draws the monitor's static key line above the live hotkey row.
- No change to the design canvas; ASCII fallback (`OFFICE_ASCII`) unchanged.

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

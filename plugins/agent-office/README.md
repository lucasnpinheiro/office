# agent-office

Office Agent Monitor for Claude Code: a pane beside the chat that maps the session's agents and subagents
(state, progress, ETA, dependencies, worktrees) and animates while they run. It is a mod (a hooks module run by the
engine), part of the [`office`](https://github.com/lucasnpinheiro/office) marketplace.

## Install

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install agent-office@office
```

One command, adding the marketplace if it is missing:

```bash
claude plugin install agent-office --marketplace lucasnpinheiro/office
```

Inside a session: `/plugin marketplace add lucasnpinheiro/office`, then `/plugin install agent-office@office`.
Then restart Claude Code or run `/reload-plugins`. The pane opens by itself at session start; `/office start` opens it focused.

## Update and uninstall

```bash
claude plugin marketplace update office      # refresh the catalog first, or the new version is not seen
claude plugin update agent-office@office     # then restart Claude Code (or /reload-plugins)
claude plugin uninstall agent-office@office
```

## What ships (0.16.0)

Terminal pane (a mod run by the engine). Views: tree, grouped, cards (default), waterfall, cost, tools, workflow (only while a
workflow run exists), worktrees, detail per agent. Per-agent tokens and tool timeline, session token total (marked `parcial` when
something is unknown), `+N commits` per worktree, ETA, masked prompts and errors, responsive layout, spinner at 6 frames/s.

Not shipped: Allow, Decline, Stop, Retry, Pause and open-in-chat controls, and the "needs you" (`◆`) decision state. They stay
hidden until the manual probes listed in ADR 0002 are run (see `.specs/features/office-agent-monitor-v2/spec/06-gaps.md`).
No bell is rung (there is no pending-decision state). Per-agent cost is `—` (no price table); workflow phase names, rounds and
totals are unavailable (the engine gives only `runId` and `agentIndex`), so the view groups by run and says "Fases: indisponíveis".

Terminal only. Not verified in the Claude app: width, 44 px targets, motion, reduced-motion signal and any app surface were never
executed there, and no parity is claimed. The 93% coverage target is not measurable with `claude plugin test` (no coverage option).

## Use

- `/office` toggles, `/office start | stop`, `/office status`, `/office reset` (monitor closed), `/office help`.
- `/office view [map|compact]` (no value toggles), `/office mode tree|grouped|cards|waterfall|cost|tools|workflow`,
  `/office sort time|state|name`, `/office filter failed|all`, `/office search <text>`, `/office open <id>`,
  `/office width <cols>`, `/office collapse | expand`.
- Hotkeys work only while the pane has the focus: press **ctrl+x tab** (or click the pane) first. Each view draws its own keys in
  its footer; a key is hidden where it does nothing (for example `f` and `s` in Cost, Tools and Workflow):

  | Key | Action |
  |---|---|
  | `g` | cycle mode (tree, grouped, cards, waterfall, cost, tools, workflow) |
  | `o` | cycle sort (time, state, name) |
  | `v` | toggle map / cards view |
  | `f` | only failures |
  | `s` | search (swallows every key until Enter) |
  | `b` | back from a detail |
  | `p` / `n` | previous / next sibling in a detail |
  | `q` | close |

- Environment read at session start:

  | Variable | Effect |
  |---|---|
  | `OFFICE_VIEW` | `map` (default) or `compact` |
  | `OFFICE_MODE` | initial mode (`cards` default) |
  | `OFFICE_WIDTH` | pane width in columns |
  | `OFFICE_ASCII=1` | ASCII glyphs only |
  | `NO_COLOR` | no color (empty counts as unset) |
  | `OFFICE_REDUCED_MOTION=1` | static spinner and bars, 1 frame/s (also on when `CI` is set or output is not a TTY) |
  | `OFFICE_CAPTURE_IO=1` | keep masked tool input/output in memory, 2000 characters per field (off otherwise) |
  | `AGENT_OFFICE_THUMBS=1` | opt-in browser thumbnails, kept in memory only |

Privacy details: [docs/privacy.md](../../docs/privacy.md).

## Local development

```bash
claude --plugin-dir ./plugins/agent-office          # load from disk for one session; edits hot-reload
claude plugin validate --strict plugins/agent-office
claude plugin test plugins/agent-office
```

## Requirements

Claude Code with mod support (developed against 2.1.306+; the published npm CLI may lag behind and report the
`modules`/`types` manifest fields as errors). No Node, Python or network access needed at runtime.

## License

MIT, see [LICENSE](LICENSE).

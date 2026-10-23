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

## Use

- `/office` toggles, `/office start | stop`, `/office status`, `/office reset` (monitor closed), `/office help`.
- `/office view [map|compact]` (no value toggles), `/office mode tree|grouped|cards|waterfall`,
  `/office sort time|state|name`, `/office filter failed|all`, `/office search <text>`, `/office open <id>`,
  `/office width <cols>`, `/office collapse | expand`.
- Hotkeys work only while the pane has the focus: press **ctrl+x tab** (or click the pane) first. Each view draws its own
  keys in its footer: `v` map/cards, `g` mode, `o` sort, `f` only failures, `s` search, `b` back, `p`/`n` siblings in a
  detail, `q` close. Search swallows every key until Enter.
- Environment read at session start: `OFFICE_VIEW` (`map` default, or `compact`), `OFFICE_MODE`
  (`cards` default), `OFFICE_WIDTH`, `OFFICE_ASCII=1`, `NO_COLOR`, `OFFICE_REDUCED_MOTION=1`, `AGENT_OFFICE_THUMBS=1`
  (opt-in browser thumbnails, kept in memory only).

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

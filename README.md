# Claude Code Office

A Claude Code plugin marketplace (`office`) with four independent plugins. The main one, `agent-office`, is a mod
that opens a pane beside the chat and maps the session's agents and subagents live. The other three are optional.

| Plugin | What it does | Needed? | README |
|---|---|---|---|
| `agent-office` | `/office`: animated map of agents and subagents (state, progress, ETA, dependencies, worktrees) | the main one | [plugins/agent-office](plugins/agent-office/README.md) |
| `personas` | `rapido`/`padrao`/`profundo` subagents (Haiku/Sonnet/Opus), 17-persona table, optional tier-router hook | optional | [plugins/personas](plugins/personas/README.md) |
| `learning` | `task-observer` skill, empty observation log, CLAUDE.md snippet | optional | [plugins/learning](plugins/learning/README.md) |
| `laya` | MCP wiring and skill for the [Laya](https://github.com/lucasnpinheiro/laya) decision model (Laya not bundled) | optional | [plugins/laya](plugins/laya/README.md) |

`caveman` (terse replies) is a separate upstream project, not bundled (Apache-2.0): https://github.com/JuliusBrussee/caveman.

## Install

With the Claude Code CLI (one plugin per `install` command):

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install agent-office@office
claude plugin install personas@office    # optional
claude plugin install learning@office    # optional
claude plugin install laya@office        # optional
```

One command per plugin that adds the marketplace when it is missing:

```bash
claude plugin install agent-office --marketplace lucasnpinheiro/office
```

Inside a session: `/plugin marketplace add lucasnpinheiro/office`, then `/plugin install agent-office@office`.
`--scope user|project|local` picks the settings file (default `user`).

Or the installer, run straight from GitHub (Node 18+; the npm package is not published yet):

```bash
npx github:lucasnpinheiro/office --scope global             # marketplace + agent-office
npx github:lucasnpinheiro/office --all --scope local        # everything, this project only
npx github:lucasnpinheiro/office --dry-run --all            # print the commands, run nothing
```

Installer flags: `--with-personas`, `--with-learning`, `--with-laya`, `--with-caveman` (pointer only), `--all`,
`--scope global|local` (`global` = `~/.claude/settings.json`, `local` = this project's `.claude/settings.json`;
`user`, `project` and `local-private` are accepted too), `--local-source` (install from this clone), `--dry-run`,
`--uninstall`. Unknown flags are rejected. Re-running it is safe: an already-added marketplace is refreshed.

After installing, restart Claude Code or run `/reload-plugins`. The monitor opens by itself at session start.

## Update

A new version reaches you only after the marketplace catalog is refreshed:

```bash
claude plugin marketplace update office       # re-read the catalog from GitHub
claude plugin update agent-office@office      # repeat for each installed plugin
```

Then restart Claude Code (or `/reload-plugins`). `claude plugin list` shows the installed version.

## Uninstall

```bash
claude plugin uninstall agent-office@office   # repeat per plugin
claude plugin marketplace remove office
```

Or `npx github:lucasnpinheiro/office --uninstall --scope global`. Your data under `~/.claude/skill-observations` and
`~/.claude/model-router` is kept.

## Local development

```bash
git clone https://github.com/lucasnpinheiro/office && cd office
claude --plugin-dir ./plugins/agent-office                # one session, loaded from disk, edits hot-reload
claude plugin marketplace add ./                          # or: a folder marketplace, read in place
claude plugin install agent-office@office                 # /reload-plugins picks up edits, no version bump
claude plugin validate --strict .                         # marketplace manifest
claude plugin validate --strict plugins/personas          # each plugin (also learning, laya, agent-office)
claude plugin test plugins/agent-office                   # mod tests
bash scripts/check-sanitized.sh
```

## agent-office: the monitor

### Views and modes

- **Map** (default at session start): mind map of the session, its agents and their TodoWrite tasks.
- **Compact** (`v` from the map): one of four modes, cycled with `g` or set with `/office mode`:
  `cards` (default), `tree`, `grouped` (siblings collapsed by state), `waterfall` (spans on a shared time axis).
- **Detail**: Enter (or a click) on a card; `b` goes back. On a pane 150+ columns wide (110+ in the desktop app) it
  opens as a side panel next to the cards.

Real captures (vhs, live Claude Code session with background agents, `OFFICE_MODE=<mode> OFFICE_WIDTH=140`):

![real capture: cards](docs/images/real-cards.png)
![real capture: grouped](docs/images/real-grouped.png)
![real capture: waterfall](docs/images/real-waterfall.png)

The images below are **renders, not screenshots**: SVGs drawn by the real `renderCompact` / `detailCompact` functions
with sample agents (`scripts/render-docs.ts`).

| Render: compact tree | Render: grouped |
| --- | --- |
| ![tree render](docs/images/tree.svg) | ![grouped render](docs/images/grouped.svg) |

| Render: cards | Render: waterfall (animated) |
| --- | --- |
| ![cards render](docs/images/cards.svg) | ![waterfall render](docs/images/waterfall-anim.svg) |

| Render: detail | Render: ASCII mode |
| --- | --- |
| ![detail render](docs/images/detail.svg) | ![ascii render](docs/images/ascii.svg) |

### Hotkeys

Mods get no raw key events: each key is a button hotkey that fires only while the monitor pane holds the focus.
`/office start` opens it focused; at session start it opens unfocused, so press **ctrl+x tab** (or click the pane)
first. Every view draws its own keys in its footer. While the search field is open no hotkey fires (Enter applies the
search, empty clears it).

| View | Keys |
| --- | --- |
| Map | `v` to compact, `b` back (detail open), `q` close |
| Compact (cards / tree / grouped / waterfall) | `g` mode, `o` sort, `f` only failures, `s` search, `v` to map, `q` close |
| Detail (narrow pane) | `b` back, `p` / `n` previous / next sibling, `q` close |
| Detail as side panel | the compact keys plus `b` back |
| Attachment preview | `b` close preview, `q` close |
| Search field open | none (typing goes to the field) |

Not possible for a mod: `/` or Esc as keys, opening files externally, kitty/sixel images.

### Commands

`/office` (toggle), `/office start | stop`, `/office view [map|compact]` (no value toggles),
`/office mode tree|grouped|cards|waterfall`, `/office sort time|state|name`, `/office filter failed|all`,
`/office search <text>` (empty clears), `/office open <id>`, `/office width <cols>` (a request: a docked pane is capped
at about 45% of the terminal), `/office collapse | expand`, `/office status`, `/office reset` (monitor closed),
`/office help`. Subcommands are case-insensitive.

### Environment

| Variable | Effect |
| --- | --- |
| `OFFICE_VIEW` | `map` (default) or `compact`: the view at session start |
| `OFFICE_MODE` | `cards` (default), `tree`, `grouped`, `waterfall` |
| `OFFICE_WIDTH` | requested pane width in columns |
| `OFFICE_ASCII=1` | ASCII glyphs (also automatic for `TERM=linux\|dumb`, non-UTF-8 locales, legacy Windows conhost) |
| `NO_COLOR` | monochrome (otherwise truecolor, 256 or 16 colors, detected) |
| `OFFICE_REDUCED_MOTION=1` | no animation, 1 fps clocks (also under `CI`) |
| `AGENT_OFFICE_THUMBS=1` | opt-in browser-MCP thumbnails, kept in memory only |

A new session always starts from the map with the default mode, sort, filter and width; a previous session's search,
filter or open detail never carries over.

### Card details

A leaf shows a real percent only from its own TodoWrite progress (`done/total`), otherwise an indeterminate sweep; an
agent that has not made its first tool call is pending (`aguarda 1ª ação`). Quota and rate-limit failures show as
attention, not as failures. Each worktree divider carries a structure and status summary. Wide glyphs (CJK, emoji) are
measured in terminal cells, so cards keep their borders.

Credits: the waterfall idea (spans on a time axis, staggered reveal, shimmer) was inspired by the public page of the
"Trace waterfall" component at https://kobra.systems/components/trace-waterfall, a paid proprietary product. Nothing
was copied; the effect is re-implemented from scratch with block characters.

## Optional parts

- **personas**: installing it opts in to the router hook (one `[model-router]` suggestion per prompt; Laya if
  reachable, otherwise a keyword floor). `claude plugin disable personas@office` turns it off.
- **learning**: `--with-learning` creates `~/.claude/skill-observations/log.md` if missing and prints the CLAUDE.md
  block to paste. Your CLAUDE.md is never edited.
- **laya**: clone Laya, `export LAYA_HOME=...`, `docker compose up -d` in it, install `uv`. Without them the MCP exits at
  once with a message saying what is missing; the router still works without Laya.

## Troubleshooting

- **Still on the old version after an update**: the catalog was not refreshed or the session still runs the old copy.
  Run `claude plugin marketplace update office`, then `claude plugin update <plugin>@office`, then restart Claude Code.
  `claude plugin list` shows the installed version; installed copies live under `~/.claude/plugins/cache/`. A plugin
  only updates when its `version` in `plugin.json` changes.
- **Hotkeys do nothing**: the pane does not have the focus. Press ctrl+x tab (or click it), or open it with
  `/office start`. No key fires while the search field is open.
- **`/office` does nothing**: run `/reload-plugins`, check `claude plugin list` shows `agent-office@office` enabled, and
  `claude plugin validate plugins/agent-office` from a clone.
- **No `[model-router]` line**: `personas` is not installed or is disabled. Test the hook:
  `echo '{"prompt":"fix a typo"}' | bash plugins/personas/hooks/model-router.sh`. It needs Python 3 (`python3` or `python`).
- **Router always says `padrao` ("Laya unavailable")**: Laya is not reachable at `LAYA_API_URL`; that is the fallback.
- **`laya` MCP shows as failed**: see its message in `/mcp` or `claude --debug`: `LAYA_HOME` unset, wrong checkout, or
  `uv` missing.
- **Agent type not found (`personas:padrao`)**: the plugin is not enabled in the current scope (user vs project).

More: [getting started](docs/getting-started.md), [architecture](docs/architecture.md),
[troubleshooting](docs/troubleshooting.md), [privacy](docs/privacy.md).

## Privacy and security

The mod only reads session events; browser thumbnails are opt-in and never stored. The router hook reads each prompt,
logs a 160-character excerpt locally (`MODEL_ROUTER_LOG=off` disables) and posts to `LAYA_API_URL` only if you run Laya.
Details: [docs/privacy.md](docs/privacy.md).

## License

MIT (each plugin carries its own `LICENSE`). Exception: `plugins/learning/skills/task-observer` is by Eoghan Henn
([rebelytics.com](https://rebelytics.com)), licensed CC BY 4.0, original
https://github.com/rebelytics/one-skill-to-rule-them-all (see the NOTICE in [plugins/learning](plugins/learning/README.md)).

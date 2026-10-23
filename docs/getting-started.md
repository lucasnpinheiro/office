# Getting started

## Requirements

- Claude Code with mod support (developed against 2.1.306+; the `claude plugin` CLI must exist).
- Node 18+ only for the `npx` installer.
- Optional: Python 3 for the `personas` router hook; Docker + `uv` for Laya.

## Install

Plain CLI (one plugin per `install` command):

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install agent-office@office
claude plugin install personas@office      # optional
claude plugin install learning@office      # optional
claude plugin install laya@office          # optional
```

One-liner: `claude plugin install agent-office --marketplace lucasnpinheiro/office` (adds the marketplace if missing).
From inside a session: `/plugin marketplace add lucasnpinheiro/office`, then `/plugin install agent-office@office`.

Installer, straight from GitHub (the npm package is not published yet):

```bash
npx github:lucasnpinheiro/office --scope global             # agent-office only
npx github:lucasnpinheiro/office --all --scope local        # everything, for the current project only
npx github:lucasnpinheiro/office --dry-run --all            # print the commands, run nothing
```

Scopes: `global` = your user settings (`~/.claude/settings.json`), `local` = this project (`.claude/settings.json`).
The installer maps them to the CLI's `--scope user` and `--scope project` (`local-private` = the CLI's `--scope local`).

## First run

Restart Claude Code or run `/reload-plugins`. The monitor opens by itself in the map view; press ctrl+x tab to give it
the focus so its hotkeys work (`v` switches to the cards), or run `/office start` to open it focused.

## Updating and removing

```bash
claude plugin marketplace update office     # refresh the catalog first
claude plugin update agent-office@office    # per plugin, then restart Claude Code
claude plugin uninstall agent-office@office
claude plugin marketplace remove office
npx github:lucasnpinheiro/office --uninstall --scope global   # or all of it at once
```

User data (`~/.claude/skill-observations`, `~/.claude/model-router`) is never deleted.

## Developing locally

```bash
claude --plugin-dir ./plugins/agent-office     # loads the folder for one session; edits hot-reload
claude plugin validate --strict plugins/agent-office
claude plugin test plugins/agent-office
```

# Getting started

## Requirements

- Claude Code (developed against 2.1.306; the `claude plugin` CLI must exist). Node 18+ only for the `npx` installer.
- Optional: Docker + `uv` for Laya.

## Install

```bash
npx @lucasnpinheiro/office --scope global             # agent-office only
npx @lucasnpinheiro/office --all --scope local        # everything, for the current project only
npx @lucasnpinheiro/office --dry-run --all            # print the commands, run nothing
```

Plain CLI, no Node:

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install agent-office@office
claude plugin install personas@office      # optional
claude plugin install learning@office      # optional
claude plugin install laya@office          # optional
```

From inside a session: `/plugin install agent-office --marketplace lucasnpinheiro/office`.

Scopes: `global` = your user settings (`~/.claude/settings.json`), `local` = this project (`.claude/settings.json`).
The installer maps them to the CLI's `--scope user` and `--scope project`.

## First run

Restart Claude Code or run `/reload-plugins`, then `/office start`. Subagents you spawn appear in the map.

## Updating and removing

```bash
claude plugin marketplace update office
claude plugin update agent-office@office
npx @lucasnpinheiro/office --uninstall --scope global
```

User data (`~/.claude/skill-observations`, `~/.claude/model-router`) is never deleted.

# Claude Code Office

Mod `agent-office` (mapa animado de agentes e subagentes) e partes opcionais: personas/router, aprendizagem, Laya.

## Início rápido (pt-BR)

```bash
npx @lucasnpinheiro/office --scope global      # instala só o agent-office
npx @lucasnpinheiro/office --all --scope local # tudo, só no projeto atual
claude plugin marketplace add lucasnpinheiro/office && claude plugin install agent-office@office   # sem Node
```

Reinicie o Claude Code (ou `/reload-plugins`) e use `/office start`. Cada parte opcional é um plugin separado;
`--dry-run` mostra os comandos sem executar; `--uninstall` remove tudo. Documentação em inglês abaixo e em `docs/`.

---

## What it is

A marketplace with four independent plugins for Claude Code:

| Plugin | What | Needed? |
|---|---|---|
| `agent-office` | `/office`: animated map of agents and subagents (state, progress, ETA, dependencies) | the main one |
| `personas` | `rapido`/`padrao`/`profundo` subagents (Haiku/Sonnet/Opus), 17-persona table, optional tier-router hook | optional |
| `learning` | `task-observer` skill + empty observation log + CLAUDE.md snippet | optional |
| `laya` | MCP wiring + skill for the [Laya](https://github.com/lucasnpinheiro/laya) decision model (not bundled) | optional |

`caveman` (terse replies) is also optional and not bundled (upstream, Apache-2.0): https://github.com/JuliusBrussee/caveman.

## Install

```bash
npx @lucasnpinheiro/office [--with-personas] [--with-learning] [--with-laya] [--with-caveman] [--all] \
  [--scope global|local] [--dry-run] [--uninstall]
```

Or with the plain CLI:

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install agent-office@office
claude plugin install personas@office learning@office laya@office   # one command per plugin; each optional
```

Or inside a session: `/plugin install agent-office --marketplace lucasnpinheiro/office`.

`--scope global` writes to your user settings, `--scope local` to the current project. Without the flag the installer
asks (interactive) or uses global.

Installing `personas` is the opt-in for the router hook: it adds a `[model-router]` suggestion to each prompt (Laya
if reachable, otherwise a keyword floor, default `padrao`). No hint means your session chooses the tier itself.

## Optional parts

- **Laya**: `git clone https://github.com/lucasnpinheiro/laya "$HOME/laya"`, `export LAYA_HOME="$HOME/laya"`,
  `docker compose up -d` inside it, install `uv`. The router and the MCP both work without it.
- **Learning**: `--with-learning` creates `~/.claude/skill-observations/log.md` if missing and prints the CLAUDE.md
  block to paste. Your CLAUDE.md is never edited.
- **caveman**: follow its upstream instructions.

## Uninstall

`npx @lucasnpinheiro/office --uninstall` (or `claude plugin uninstall <name>@office` and
`claude plugin marketplace remove office`). Your data under `~/.claude/skill-observations` and `~/.claude/model-router` is kept.

## Privacy and security

The mod only reads session events. The router hook reads each prompt, logs a 160-character excerpt locally
(`MODEL_ROUTER_LOG=off` disables) and posts to `LAYA_API_URL` only if you run Laya. Details: [docs/privacy.md](docs/privacy.md).
More: [getting started](docs/getting-started.md), [architecture](docs/architecture.md), [troubleshooting](docs/troubleshooting.md).

## Development

```bash
npm run validate     # claude plugin validate on the marketplace and each plugin
npm test             # claude plugin test plugins/agent-office
bash scripts/check-sanitized.sh
```

## License

MIT. `plugins/learning/skills/task-observer` is by Eoghan Henn ([rebelytics.com](https://rebelytics.com)), CC BY 4.0,
original: https://github.com/rebelytics/one-skill-to-rule-them-all

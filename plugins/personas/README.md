# personas

Three subagent tiers for Claude Code, `rapido` / `padrao` / `profundo` (Haiku / Sonnet / Opus), a 17-persona role table
and an optional `UserPromptSubmit` hook that suggests a tier for each prompt. Part of the
[`office`](https://github.com/lucasnpinheiro/office) marketplace.

## What it adds

- Agents `personas:rapido`, `personas:padrao`, `personas:profundo` (`agents/`).
- Docs: persona table, model routing and orchestration notes (`docs/`), effort matrix (`data/effort-matrix.json`).
- Hook `hooks/model-router.sh`: adds one `[model-router] ... -> suggested subagent personas:<tier>` line of context
  per prompt. It asks [Laya](https://github.com/lucasnpinheiro/laya) at `LAYA_API_URL` (default `http://localhost:8000`)
  when reachable, otherwise uses a keyword floor (default `padrao`). Prompts starting with `!` or `/` are skipped.
  Advisory only: every failure prints nothing and exits 0, so it never blocks a prompt.
- Local decision log `~/.claude/model-router/decisions.jsonl` (160-character excerpt). `MODEL_ROUTER_LOG=off`
  disables it, `MODEL_ROUTER_DIR` moves it, `MODEL_ROUTER_QUOTA=off` disables the 50/35/15 tier balancing.

## Install, update, uninstall

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install personas@office
claude plugin marketplace update office && claude plugin update personas@office   # update, then restart
claude plugin disable personas@office      # keep it installed, turn the hook off
claude plugin uninstall personas@office
```

## Local development

```bash
claude --plugin-dir ./plugins/personas
echo '{"prompt":"fix a typo"}' | bash plugins/personas/hooks/model-router.sh   # run the hook by hand
claude plugin validate --strict plugins/personas
```

## Requirements

`bash` (macOS/Linux, Git Bash on Windows) and Python 3 on `PATH` as `python3` or `python`. Without Python the hook
stays silent. Laya is optional.

## License

MIT, see [LICENSE](LICENSE).

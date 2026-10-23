# laya

Optional wiring for [Laya](https://github.com/lucasnpinheiro/laya), a local decision model for classification, triage
and yes/no judgements over text. Adds the `laya` MCP server (`laya_predict`, `laya_classify`, ...) and a usage skill.
Laya itself is an external project and is **not** bundled. Part of the
[`office`](https://github.com/lucasnpinheiro/office) marketplace.

## Setup

```bash
git clone https://github.com/lucasnpinheiro/laya "$HOME/laya"
export LAYA_HOME="$HOME/laya"          # put this in your shell profile; the MCP launcher reads it
(cd "$LAYA_HOME" && docker compose up -d)
# install uv: https://docs.astral.sh/uv/
claude plugin marketplace add lucasnpinheiro/office
claude plugin install laya@office      # then restart Claude Code
```

`docker/docker-compose.yml` is a reference compose file for the service.

## Update and uninstall

```bash
claude plugin marketplace update office && claude plugin update laya@office   # then restart
claude plugin disable laya@office      # stop starting the MCP without uninstalling
claude plugin uninstall laya@office
```

## When something is missing

The MCP starts through `scripts/laya-mcp.sh`, which checks before running `uv run --script "$LAYA_HOME/mcp/laya_mcp.py"`.
With `LAYA_HOME` unset, a checkout without `mcp/laya_mcp.py`, or no `uv` on `PATH`, it exits at once with one line
saying what to fix (visible in `/mcp` and `claude --debug`). The rest of the session is unaffected.

## Local development

```bash
claude --plugin-dir ./plugins/laya
claude plugin validate --strict plugins/laya
```

## Requirements

`sh` (macOS/Linux, Git Bash on Windows), `uv`, Docker for the Laya service, and `LAYA_HOME` pointing at a Laya checkout.

## License

MIT, see [LICENSE](LICENSE). Laya is licensed separately by its own repository.

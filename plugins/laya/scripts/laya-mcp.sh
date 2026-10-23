#!/usr/bin/env sh
# Starts the Laya MCP server (stdio) from an external Laya checkout.
# Fails fast with one actionable line on stderr (shown by `claude --debug` and /mcp) instead of an opaque
# spawn error when LAYA_HOME is unset, the checkout has no mcp/laya_mcp.py, or uv is not installed.
if [ -z "${LAYA_HOME:-}" ]; then
  echo "laya MCP: LAYA_HOME is not set. Clone https://github.com/lucasnpinheiro/laya, export LAYA_HOME=<that folder>, restart Claude Code. (Or disable: claude plugin disable laya@office)" >&2
  exit 1
fi
SCRIPT="$LAYA_HOME/mcp/laya_mcp.py"
if [ ! -f "$SCRIPT" ]; then
  echo "laya MCP: $SCRIPT not found. LAYA_HOME must point at a Laya checkout (https://github.com/lucasnpinheiro/laya)." >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "laya MCP: uv is not installed or not on PATH. Install it: https://docs.astral.sh/uv/ and restart Claude Code." >&2
  exit 1
fi
exec uv run --script "$SCRIPT"

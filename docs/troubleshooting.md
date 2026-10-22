# Troubleshooting

- **`/office` does nothing**: run `/reload-plugins`, then `claude plugin list` to confirm `agent-office@office` is enabled.
  `claude plugin validate plugins/agent-office` checks the manifest and the hooks module.
- **`claude: command not found` in the installer**: install Claude Code, or add it to `PATH`.
- **Marketplace not found**: check network access to `github.com/lucasnpinheiro/office`, or use `--local-source` from a clone.
- **No `[model-router]` line**: the `personas` plugin is not installed or is disabled; the session then picks tiers by itself.
  Test the hook directly: `echo '{"prompt":"fix a typo"}' | bash plugins/personas/hooks/model-router.sh`.
- **Router always says `padrao` ("Laya unavailable")**: Laya is not reachable at `LAYA_API_URL`; that is the designed fallback.
- **`laya` MCP shows as failed**: `LAYA_HOME` is unset or `uv` is missing. Clone Laya, `export LAYA_HOME=...`, restart Claude Code.
- **Agent type not found (`personas:padrao`)**: confirm the plugin is enabled in the current scope (global vs local).

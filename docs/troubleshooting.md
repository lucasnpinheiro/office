# Troubleshooting

- **Still on the old version after an update**: run `claude plugin marketplace update office`, then
  `claude plugin update <plugin>@office`, then restart Claude Code. `claude plugin list` shows the installed version;
  installed copies live under `~/.claude/plugins/cache/`. An update is only offered when the plugin's `version` changed.
- **Hotkeys do nothing**: the pane has no focus. Press ctrl+x tab (or click it), or open it with `/office start`.
  No hotkey fires while the search field is open.
- **`/office` does nothing**: run `/reload-plugins`, then `claude plugin list` to confirm `agent-office@office` is enabled.
  `claude plugin validate plugins/agent-office` checks the manifest and the hooks module.
- **`claude: command not found` in the installer**: install Claude Code, or add it to `PATH`.
- **`npm error 404` for `@lucasnpinheiro/office`**: the npm package is not published; use `npx github:lucasnpinheiro/office`.
- **Marketplace not found**: check network access to `github.com/lucasnpinheiro/office`, or use `--local-source` from a clone.
- **No `[model-router]` line**: the `personas` plugin is not installed or is disabled, or Python 3 is missing
  (`python3` or `python`). Test the hook: `echo '{"prompt":"fix a typo"}' | bash plugins/personas/hooks/model-router.sh`.
- **Router always says `padrao` ("Laya unavailable")**: Laya is not reachable at `LAYA_API_URL`; that is the designed fallback.
- **`laya` MCP shows as failed**: its one-line message (in `/mcp` or `claude --debug`) says what is missing: `LAYA_HOME`
  unset, no `mcp/laya_mcp.py` in it, or `uv` not on `PATH`. Fix it and restart Claude Code.
- **Agent type not found (`personas:padrao`)**: confirm the plugin is enabled in the current scope (user vs project).

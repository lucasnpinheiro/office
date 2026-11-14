#!/usr/bin/env bash
# Update the marketplace and the user-scope install of every plugin in this repo whose manifest version differs from the installed one.
# Idempotent; silent when `claude` is missing. `--list` prints only the plugins that need an update (used by the self-check).
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
installed="${INSTALLED_PLUGINS_JSON:-$HOME/.claude/plugins/installed_plugins.json}"
stale() { # name version -> exit 0 when the installed version differs or is absent
  local name="$1" ver="$2"
  [ -f "$installed" ] || return 0
  ! grep -q "/cache/office/$name/$ver\"" "$installed"
}
list=()
for m in "$root"/plugins/*/.claude-plugin/plugin.json; do
  [ -f "$m" ] || continue
  name="$(sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' "$m" | head -1)"
  ver="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$m" | head -1)"
  [ -n "$name" ] && [ -n "$ver" ] && stale "$name" "$ver" && list+=("$name")
done
if [ "${1:-}" = "--list" ]; then printf '%s\n' "${list[@]:-}" | sed '/^$/d'; exit 0; fi
command -v claude >/dev/null 2>&1 || exit 0
[ "${#list[@]}" -gt 0 ] || exit 0
claude plugin marketplace update office >/dev/null 2>&1
for n in "${list[@]}"; do claude plugin update "$n@office" 2>&1 | tail -1; done
exit 0

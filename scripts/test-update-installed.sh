#!/usr/bin/env bash
# Self-check of the version-diff logic of update-installed-plugins.sh.
set -eu
d="$(cd "$(dirname "$0")" && pwd)"; t="$(mktemp)"
ver="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$d/../plugins/agent-office/.claude-plugin/plugin.json" | head -1)"
run() { echo "$1" > "$t"; INSTALLED_PLUGINS_JSON="$t" bash "$d/update-installed-plugins.sh" --list | grep -x agent-office || true; }
[ -z "$(run "{\"p\":\"/cache/office/agent-office/$ver\"}" | sed 's/^$//')" ] || { echo "FAIL: same version listed"; exit 1; }
run '{"p":"/cache/office/agent-office/0.0.1"}' | grep -q agent-office || { echo "FAIL: older version not listed"; exit 1; }
run "{}" | grep -q agent-office || { echo "FAIL: absent not listed"; exit 1; }
echo ok

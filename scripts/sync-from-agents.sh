#!/usr/bin/env bash
# Re-export the parts that are copied verbatim from a local ~/.agents checkout, then run the sanitization gate.
# Hand-written parts (personas agents/docs/router, laya, learning templates, docs/) are NOT touched.
# Usage: AGENTS_HOME=~/.agents bash scripts/sync-from-agents.sh
set -euo pipefail
SRC="${AGENTS_HOME:-$HOME/.agents}"
DST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -d "$SRC/mods/agent-office-marketplace/plugins/agent-office" ] || { echo "source not found: $SRC" >&2; exit 1; }

rsync -a --delete --exclude node_modules --exclude __pycache__ --exclude '.claude-plugin/types' --exclude .DS_Store \
  "$SRC/mods/agent-office-marketplace/plugins/agent-office/" "$DST/plugins/agent-office/"
rsync -a --delete --exclude .DS_Store \
  "$SRC/skills/task-observer/" "$DST/plugins/learning/skills/task-observer/"

"$DST/scripts/check-sanitized.sh"

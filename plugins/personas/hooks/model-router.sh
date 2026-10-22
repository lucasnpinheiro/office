#!/usr/bin/env bash
# UserPromptSubmit hook: suggests which subagent tier (rapido/padrao/profundo = Haiku/Sonnet/Opus)
# fits the user's message. Advisory only: every failure path exits 0 and prints nothing.
# Uses Laya (LAYA_API_URL, default http://localhost:8000) when reachable; otherwise a keyword floor.
set -u
command -v python3 >/dev/null 2>&1 || exit 0
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || exit 0
python3 "$HERE/model-router.py" 2>/dev/null
exit 0

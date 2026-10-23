#!/usr/bin/env bash
# UserPromptSubmit hook: suggests which subagent tier (rapido/padrao/profundo = Haiku/Sonnet/Opus)
# fits the user's message. Advisory only: every failure path exits 0 and prints nothing.
# Uses Laya (LAYA_API_URL, default http://localhost:8000) when reachable; otherwise a keyword floor.
# Portable: bash on macOS/Linux and Git Bash on Windows. Python 3 is looked up as python3, then python
# (Windows installs often have only `python`, or a Store stub named python3 that is not a real interpreter).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || exit 0
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    PY="$c"
    break
  fi
done
[ -n "$PY" ] || exit 0
PYTHONIOENCODING=utf-8 "$PY" "$HERE/model-router.py" 2>/dev/null
exit 0

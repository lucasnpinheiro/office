#!/usr/bin/env bash
# Self-check: a gitignored file with a leak passes; a tracked file with a leak fails.
set -u
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/scripts" && cp "$(dirname "$0")/check-sanitized.sh" "$T/scripts/"
cd "$T" && git init -q && echo 'local.xml' > .gitignore && printf '/Users/someone\n' > local.xml
bash scripts/check-sanitized.sh >/dev/null || { echo "FAIL: ignored file flagged"; exit 1; }
printf '/Users/someone\n' > tracked.txt && git add tracked.txt
bash scripts/check-sanitized.sh >/dev/null && { echo "FAIL: tracked leak passed"; exit 1; }
echo "check-sanitized self-check OK"

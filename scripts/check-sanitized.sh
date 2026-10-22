#!/usr/bin/env bash
# Fails when local/personal context leaked into the repository.
# Allowed: the GitHub owner/URLs, plugin author fields, and the string `rtk` in the Office mod's
# command-wrapper list (hooks/stats.ts and its test: it only skips that wrapper name when labelling Bash calls).
set -uo pipefail
DST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DST"
PAT='/Users/|\.agents|coneman|choconfest|obsidian|~/CLAUDE\.md|homolog'
hits=$(grep -rnE "$PAT" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude=check-sanitized.sh --exclude=sync-from-agents.sh || true)
hits2=$(grep -rniw 'rtk' . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude=check-sanitized.sh --exclude=sync-from-agents.sh | grep -v 'plugins/agent-office/hooks/stats' || true)
own=$(grep -rn 'lucasnpinheiro' . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude=check-sanitized.sh \
  | grep -vE 'github\.com/lucasnpinheiro|"name": "lucasnpinheiro"|lucasnpinheiro/(office|laya)|@lucasnpinheiro/office|Copyright|Lucas Pinheiro|\$\{?HOME' || true)
if [ -n "$hits$hits2$own" ]; then
  echo "SANITIZATION FAILED:"; printf '%s\n%s\n%s\n' "$hits" "$hits2" "$own" | sed '/^$/d'; exit 1
fi
echo "sanitization OK"

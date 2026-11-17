#!/usr/bin/env bash
# Fails when local/personal context leaked into the repository.
# Allowed: the GitHub owner/URLs, plugin author fields, and the string `rtk` in the Office mod's
# command-wrapper list (hooks/stats.ts and its test: it only skips that wrapper name when labelling Bash calls).
set -uo pipefail
DST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DST"
# Tracked and untracked-but-not-ignored files only: gitignored local files (IDE workspace, .env) are never shipped.
G=(git grep -n --untracked -I)
X=(-- . ':!scripts/check-sanitized.sh' ':!scripts/check-sanitized.test.sh' ':!**/sync-from-agents.sh' ':!node_modules' ':!**/__pycache__')
PAT='/Users/|[~/]\.agents|coneman|choconfest|obsidian|~/CLAUDE\.md|homolog'
hits=$("${G[@]}" -E "$PAT" "${X[@]}" || true)
hits2=$("${G[@]}" -iw 'rtk' "${X[@]}" | grep -v 'plugins/agent-office/hooks/stats' || true)
own=$("${G[@]}" 'lucasnpinheiro' -- . ':!scripts/check-sanitized.sh' ':!scripts/check-sanitized.test.sh' ':!node_modules' ':!**/__pycache__' \
  | grep -vE 'github\.com/lucasnpinheiro|"name": "lucasnpinheiro"|lucasnpinheiro/(office|laya)|@lucasnpinheiro/office|Copyright|Lucas Pinheiro|\$\{?HOME' || true)
if [ -n "$hits$hits2$own" ]; then
  echo "SANITIZATION FAILED:"; printf '%s\n%s\n%s\n' "$hits" "$hits2" "$own" | sed '/^$/d'; exit 1
fi
echo "sanitization OK"

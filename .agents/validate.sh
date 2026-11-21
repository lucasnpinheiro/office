#!/usr/bin/env bash
# Local replacement for GitHub Actions workflow validate.yml (job "validate").
# Source: .github/workflows/validate.yml (removed on chore/remove-github-actions).
# Mirrors only the blocking test/lint/static-analysis steps. Deploy, image, release: none existed.
# Non-fatal (continue-on-error) CI steps are NOT run here: plugin directory profile,
# agent-office mod validate, plugin tests (the latter SKIPPED in CI anyway).
# No database is used by this repo: DB rule not applicable.
# Requires: `claude` CLI on PATH (CI installed it via `npm i -g @anthropic-ai/claude-code`), node, bash, sh.
# Run from repo root.
set -euo pipefail

if [ ! -f .claude-plugin/marketplace.json ] && [ ! -f package.json ]; then
  echo "run from repo root" >&2
  exit 2
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI missing: install with npm i -g @anthropic-ai/claude-code (CI did this step)" >&2
  exit 2
fi

echo "== Validate marketplace"
claude plugin validate .

echo "== Validate hook/skill plugins (strict)"
for p in plugins/personas plugins/learning plugins/laya; do
  claude plugin validate --strict "$p"
done

echo "== Shell scripts parse"
bash -n plugins/personas/hooks/model-router.sh
sh -n plugins/laya/scripts/laya-mcp.sh

echo "== Router hook smoke test"
out=$(echo '{"prompt":"fix a typo"}' | LAYA_API_URL=http://127.0.0.1:9 MODEL_ROUTER_LOG=off bash plugins/personas/hooks/model-router.sh)
echo "$out" | grep -q 'model-router'

echo "== Sanitization check"
bash scripts/check-sanitized.sh

echo "== Sanitization self-check"
bash scripts/check-sanitized.test.sh

echo "== Installer dry run"
node bin/install.mjs --dry-run --all

echo "== Pack dry run"
npm pack --dry-run

echo "validator: all blocking steps passed"

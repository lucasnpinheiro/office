---
status: TODO
progress: 0/35
updated: 2026-11-15
---
# Tests — office-map-mock-style

Runner: `rtk npx vitest run` ou o comando do repo (ler package.json na implementação). Baseline de falhas pré-existentes registrada antes da T-001.
Cobertura planejada: linhas >= 93% em compact.ts, app-cards.ts, actions.ts, view-detail.ts (diff).

| Tipo | Arquivo | Linhas de teste |
|---|---|---|
| unit | tests/unit.md | 27 |
| integration | tests/integration.md | 3 |
| ui-design | tests/ui-design.md | 2 |
| validation / business-rules / security | tests/*.md | 1 cada |
| e2e-flow, load-k6, e2e-regression | tests/*.md | N/A (motivo no arquivo) |

Traço: REQ-001..011 cobertos por pelo menos um ID; ver coluna Covers.
Smoke de browser/tela: D-001, D-002 (tmux/terminal ou claude-in-chrome no app; `not verified` se o viewport não alcançar).

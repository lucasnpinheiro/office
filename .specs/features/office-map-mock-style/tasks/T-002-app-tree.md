---
id: T-002
title: App: mapTree recursivo em linhas de 6, APP_CARD_MIN 18
type: frontend
status: DONE
progress: 3/3
updated: 2026-11-15
depends_on: []
branch: task/T-002-app-tree
pr: #69
covers: [REQ-001, REQ-002, REQ-003, REQ-004]
estimate: L
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo"
---
# T-002 — App: mapTree recursivo em linhas de 6, APP_CARD_MIN 18

Executor: 🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo

## Objetivo
appMap sem layout column; mapTree particiona filhos de todo pai via mapRows com avail do pai; APP_CARD_MIN=18; marcador +N ocultos no nível 10.

## Arquivos
plugins/agent-office/hooks/app-cards.ts; register.tsx (mapTree 752-790); app-cards.test.ts

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD).
- [ ] Testes: tests/unit.md U-009..U-012, tests/ui-design.md D-001
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

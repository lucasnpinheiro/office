---
id: T-003
title: Rolagem j/k do Mapa, indicador e resize
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: [T-001, T-002]
branch: task/T-003-map-scroll
pr:
covers: [REQ-005]
estimate: M
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🪶 Haiku · 🟢 baixo"
---
# T-003 — Rolagem j/k do Mapa, indicador e resize

Executor: 🛠️ Mid-level · 🪶 Haiku · 🟢 baixo

## Objetivo
j/k rolam o Mapa (3 linhas, clamp), indicador mais acima/abaixo, resize invalida measure e preserva dados.

## Arquivos
plugins/agent-office/hooks/register.tsx (act scrollDown/Up ~302-314); compact.ts renderCompact windowing; scroll-responsive.test.ts

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD).
- [ ] Testes: tests/unit.md U-013..U-015, tests/integration.md I-002
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

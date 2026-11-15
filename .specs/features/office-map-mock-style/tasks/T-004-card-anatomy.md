---
id: T-004
title: Card: meta sem quebra, pill sempre, rodapé limpo
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: [T-001]
branch: task/T-004-card-anatomy
pr:
covers: [REQ-006, REQ-007, REQ-008]
estimate: M
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🪶 Haiku · 🟢 baixo"
---
# T-004 — Card: meta sem quebra, pill sempre, rodapé limpo

Executor: 🛠️ Mid-level · 🪶 Haiku · 🟢 baixo

## Objetivo
chipRows atômico por chip; pill sempre (título encurta); pill substitui ✓; status trilha por item com …, sem aspa; mesmo no app (appCardBox).

## Arquivos
compact.ts card(); register.tsx appCardBox; cards-*.test.ts

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD); `rtk` em todo comando.
- [ ] Testes: tests/unit.md U-016..U-020, tests/ui-design.md D-002
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

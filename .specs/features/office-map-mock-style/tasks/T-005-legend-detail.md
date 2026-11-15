---
id: T-005
title: Legenda e detalhe: rótulos e quebras
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: []
branch: task/T-005-legend-detail
pr:
covers: [REQ-009, REQ-010]
estimate: M
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🪶 Haiku · 🟢 baixo"
---
# T-005 — Legenda e detalhe: rótulos e quebras

Executor: 🛠️ Mid-level · 🪶 Haiku · 🟢 baixo

## Objetivo
footerRows por item inteiro com j: desce / k: sobe; detalhe com voltar único, custo, sem _, prompt por palavra, Irmãos em linha.

## Arquivos
actions.ts footerRows; view-detail.ts; register.tsx 880-890; actions.test.ts, review.test.ts

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD).
- [ ] Testes: tests/unit.md U-021..U-026, tests/validation.md V-001
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

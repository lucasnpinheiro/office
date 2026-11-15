---
id: T-001
title: Terminal: árvore em linhas de 6, largura por pai, nível 10
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: []
branch: task/T-001-terminal-tree
pr:
covers: [REQ-001, REQ-002, REQ-003, REQ-004]
estimate: L
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo"
---
# T-001 — Terminal: árvore em linhas de 6, largura por pai, nível 10

Executor: 🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo

## Objetivo
Reescrever measure/draw de cardLines: sem stack, avail recursivo, w dinâmico 18..34, cols reduz até 1, nível 10 com +N ocultos, barramento por linha sem tronco lateral.

## Arquivos
plugins/agent-office/hooks/compact.ts; testes cards-*.test.ts, org-tree-2d.test.ts, real-render.test.ts

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD).
- [ ] Testes: tests/unit.md U-001..U-008, tests/integration.md I-001
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

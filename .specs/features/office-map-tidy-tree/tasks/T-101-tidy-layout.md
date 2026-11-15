---
id: T-101
title: Terminal+app: tidy-tree, barramento por pai e •
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: []
branch: task/T-101-tidy-layout
pr:
covers: [REQ-101, REQ-102, REQ-103, REQ-104]
estimate: L
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo"
---
# T-101 — Terminal+app: tidy-tree, barramento por pai e •

Executor: 🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo

## Objetivo
compact.ts measure/draw; app-cards.ts, register.tsx mapTree. Barramento do 1º ao último filho, •, app com a mesma regra de subárvore.

## Aceite
- [ ] RED antes de GREEN; testes: unit U-101..U-107, ui-design D-101
- [ ] Só os arquivos citados; `rtk` em todo comando.
- [ ] Sem regressão em office-map-mock-style (0.28.14) nem no vão central do terminal (0.28.16).

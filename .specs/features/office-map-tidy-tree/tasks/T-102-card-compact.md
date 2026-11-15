---
id: T-102
title: Card compacto + borda por estado
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: [T-101]
branch: task/T-102-card-compact
pr:
covers: [REQ-111, REQ-112]
estimate: L
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo"
---
# T-102 — Card compacto + borda por estado

Executor: 🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo

## Objetivo
compact.ts card(); register.tsx appCardBox. Borda tracejada aguarda filhos; MANTER pill, papel e custo (ASK-1/4 decididos); acrescentar borda tracejada aguarda-filhos e glifo/cor de borda; enxugar para 5-6 linhas: remover redundâncias (ver spec/02 REQ-111), regra de título em 2 linhas mantida.

## Aceite
- [ ] RED antes de GREEN; testes: unit U-108..U-113, ui-design D-102
- [ ] Só os arquivos citados.
- [ ] Sem regressão em office-map-mock-style (0.28.14) nem no vão central do terminal (0.28.16).

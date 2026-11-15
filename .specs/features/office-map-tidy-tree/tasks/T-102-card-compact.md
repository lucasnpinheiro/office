---
id: T-102
title: Card compacto + borda por estado
type: frontend
status: BLOCKED
progress: 0/3
updated: 2026-11-15
depends_on: [T-101]
branch: task/T-102-card-compact
pr:
covers: [REQ-111, REQ-112]
estimate: L
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo"
blocked_by: ASK-1 ASK-4
---
# T-102 — Card compacto + borda por estado

Executor: 🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo

## Objetivo
compact.ts card(); register.tsx appCardBox. Borda tracejada aguarda filhos; glifo+borda e 4 linhas só conforme resposta ASK-1/4.

## Aceite
- [ ] RED antes de GREEN; testes: unit U-108..U-113, ui-design D-102
- [ ] Só os arquivos citados.
- [ ] Sem regressão em office-map-mock-style (0.28.14) nem no vão central do terminal (0.28.16).

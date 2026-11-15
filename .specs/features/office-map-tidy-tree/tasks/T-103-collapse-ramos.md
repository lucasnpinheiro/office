---
id: T-103
title: Recolher ▾ e barra Ramos no Mapa
type: frontend
status: BLOCKED
progress: 0/3
updated: 2026-11-15
depends_on: [T-101]
branch: task/T-103-collapse-ramos
pr:
covers: [REQ-113]
estimate: M
skills: [code-quality, performance]
executor: "🛠️ Mid-level · 🪶 Haiku · 🟢 baixo"
blocked_by: ASK-3
---
# T-103 — Recolher ▾ e barra Ramos no Mapa

Executor: 🛠️ Mid-level · 🪶 Haiku · 🟢 baixo

## Objetivo
Reusar collapsedAt; filtrar agentKids por collapsed no Mapa (terminal e app) conforme ASK-3.

## Aceite
- [ ] RED antes de GREEN; testes: unit U-114..U-116, integration I-101
- [ ] Só os arquivos citados.
- [ ] Sem regressão em office-map-mock-style (0.28.14) nem no vão central do terminal (0.28.16).

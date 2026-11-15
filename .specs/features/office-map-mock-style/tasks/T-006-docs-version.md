---
id: T-006
title: Versão 0.28.14, README e notas de supersede
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-15
depends_on: [T-001, T-002, T-003, T-004, T-005]
branch: task/T-006-docs-version
pr:
covers: [REQ-011]
estimate: S
skills: [code-quality, performance]
executor: "✍️ Tech Writer · 🪶 Haiku · 🟢 baixo"
---
# T-006 — Versão 0.28.14, README e notas de supersede

Executor: ✍️ Tech Writer · 🪶 Haiku · 🟢 baixo

## Objetivo
Bump plugin.json 0.28.14, README, notas supersede nas specs antigas, regenerar imagens se houver script.

## Arquivos
plugins/agent-office/.claude-plugin/plugin.json; README.md; .specs/features/office-org-tree-2d/spec.md; office-app-dynamic-cards/spec.md

## Aceite
- [ ] RED primeiro nos testes citados, depois GREEN (TDD); `rtk` em todo comando.
- [ ] Testes: tests/integration.md I-003
- [ ] Só arquivos listados mudam; phpcs n/a (TS); suite do diff antes, suite completa no gate.

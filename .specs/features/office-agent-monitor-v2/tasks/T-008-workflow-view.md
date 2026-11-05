---
id: T-008
title: Visão Workflow com fases reais
type: frontend
status: IN_PROGRESS
progress: 0/3
updated: 2026-11-05
depends_on: [T-001, T-006]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-008]
estimate: M
skills: []
executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-008 — Visão Workflow com fases reais

Executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Detectar a execução de workflow pelo formato provado na ADR 0002 e mostrar nome, rodada e fases.

Fora: Iniciar ou controlar workflows.

## Critérios de aceite
- [ ] AC-024 — WHEN o evento provado na ADR 0002 trouxer um workflow, the system SHALL mostrar nome, rodada, fases na ordem com `feitos/total` e os agentes da fase atual. Cenário: S-024 @success.
- [ ] AC-025 — WHEN a sessão não tiver workflow, the system SHALL mostrar `Nenhum workflow nesta sessão` e nenhuma fase. Cenário: S-025 @deviation.
- [ ] AC-026 — IF os dados do workflow vierem em formato não reconhecido ou faltar nome de fase, the system SHALL listar os agentes sem fases e não inventar nome nem total. Cenário: S-026 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-024 a AC-026) · cenários: `acceptance/views.feature` tag `@T-008` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [ ] Branch dedicada, nunca `main`
- [ ] Teste RED antes do GREEN
- [ ] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 147
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes
- [ ] Julgada por subagente diferente do implementador

## Evidência
Preencher ao concluir: comando, exit code e data. DONE sem evidência é inválido.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-workflow.ts`, `plugins/agent-office/hooks/view-workflow.test.ts`.
Nada detectado hoje: só há handler de `tool.call` para Agent (register.tsx:358). As fases do canvas são ilustrativas; nome e fases só vêm de dado observado.

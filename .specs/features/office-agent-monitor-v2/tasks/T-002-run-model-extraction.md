---
id: T-002
title: Extrair o RunModel puro e unificar tipos
type: backend
status: TODO
progress: 0/3
updated: 2026-11-05
depends_on: [T-001]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-002]
estimate: L
skills: []
executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-002 — Extrair o RunModel puro e unificar tipos

Executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Extrair `Node`, grafo e progresso de `monitor.ts` para um modelo puro; renderizadores só leem o modelo.

Fora: Mudança visual; nenhuma saída de tela muda nesta task.

## Critérios de aceite
- [ ] AC-004 — The system SHALL calcular a tela a partir de `buildRunModel(agents, now, caps)`, função pura sem `$`, sem relógio e sem E/S, mantendo verdes os 147 testes de base. Cenário: S-004 @success.
- [ ] AC-005 — WHEN um agente citar um pai ausente da lista, the system SHALL tratá-lo como raiz sem perdê-lo. Cenário: S-005 @deviation.
- [ ] AC-006 — IF um registro de agente trouxer horário inválido, the system SHALL manter o nó com tempo `—` e não lançar exceção. Cenário: S-006 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-004 a AC-006) · cenários: `acceptance/foundation.feature` tag `@T-002` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/run-model.ts`, `plugins/agent-office/hooks/run-model.test.ts`.
Sem mudança de comportamento: os 147 testes existentes seguem verdes. Unifica `OfficeAgent` (types/index.d.ts:2) e `AgentLike` (office.ts:3).

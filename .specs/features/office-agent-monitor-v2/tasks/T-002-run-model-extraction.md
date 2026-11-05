---
id: T-002
title: Extrair o RunModel puro e unificar tipos
type: backend
status: IN_PROGRESS
progress: 3/3
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
- [x] AC-004 — The system SHALL calcular a tela a partir de `buildRunModel(agents, now, caps)`, função pura sem `$`, sem relógio e sem E/S, mantendo verdes os 147 testes de base. Cenário: S-004 @success.
- [x] AC-005 — WHEN um agente citar um pai ausente da lista, the system SHALL tratá-lo como raiz sem perdê-lo. Cenário: S-005 @deviation.
- [x] AC-006 — IF um registro de agente trouxer horário inválido, the system SHALL manter o nó com tempo `—` e não lançar exceção. Cenário: S-006 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-004 a AC-006) · cenários: `acceptance/foundation.feature` tag `@T-002` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main`
- [x] Teste RED antes do GREEN
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 147
- [x] Linhas de `tests/e2e-regression.md` impactadas verdes
- [x] Julgada por subagente diferente do implementador: achados do juiz corrigidos (2026-11-05)

## Evidência
`claude plugin test .` em plugins/agent-office: 153 pass, 0 fail (base 147 + 6 novos em run-model.test.ts), exit 0, 2026-11-05. Após correções do juiz (mescla de T-001 + testes de pureza por comportamento, attention com stalled, NaN, ordem filho/pai, tipos de capabilities.ts): 160 pass, 0 fail, 14 arquivos. Asserção de 16 ms removida (flaky); teste de escala 60 nós no lugar. Pendente do dono: filho listado antes do pai vira raiz (contrato atual por ordem de spawn). RED: run-model.test.ts falhou com "cannot import ./run-model" antes da implementação.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/run-model.ts`, `plugins/agent-office/hooks/run-model.test.ts`.
Sem mudança de comportamento: os 147 testes existentes seguem verdes. Unifica `OfficeAgent` (types/index.d.ts:2) e `AgentLike` (office.ts:3).

---
id: T-008
title: Visão Workflow com fases reais
type: frontend
status: IN_PROGRESS
progress: 2/3
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
- [ ] AC-024 — WHEN o evento provado na ADR 0002 trouxer um workflow, the system SHALL mostrar nome, rodada, fases na ordem com `feitos/total` e os agentes da fase atual. Cenário: S-024 @success. **NÃO atendido como escrito**: o engine só dá `workflow.runId` e `agentIndex` no `agent.spawn` (ADR 0002, Probe 4); não há nome, rodada, fases nem total. Entregue no lugar: agentes agrupados por `runId`, na ordem do `agentIndex`, com "N agentes vistos" (nunca um total) e "Fases: indisponíveis". Decisão do usuário pendente (spec/06-gaps.md, Unresolved 8).
- [x] AC-025 — WHEN a sessão não tiver workflow, the system SHALL mostrar `Nenhum workflow nesta sessão` e nenhuma fase. Cenário: S-025 @deviation. (Por `/office mode workflow` sem execução; `g` pula o modo enquanto não há execução, para nunca mostrar uma tela sempre vazia.)
- [x] AC-026 — IF os dados do workflow vierem em formato não reconhecido ou faltar nome de fase, the system SHALL listar os agentes sem fases e não inventar nome nem total. Cenário: S-026 @error. (Reinterpretado: sem fases a lista é sempre assim; `runId` vazio ou índice inválido não vira workflow nem derruba o painel.)

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-024 a AC-026) · cenários: `acceptance/views.feature` tag `@T-008` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main` (`feat/office-t007-t010-integration`)
- [x] Teste RED antes do GREEN (integration.test.ts vermelho antes do register; `view-workflow.test.ts` reescrito junto com a visão nova)
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova (base desta integração: 286 pass, 0 fail)
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes (não executadas)
- [ ] Julgada por subagente diferente do implementador
- [ ] Render real no terminal (`claude -p` não desenha o painel)

## Evidência
2026-11-05: probe real (`claude -p --model haiku --plugin-dir <mod descartável>`, o modelo rodou `Workflow` com dois `agent()` e um `Agent`): `agent.spawn` do workflow trouxe `workflow:{runId:"wf_e1777de3-314",agentIndex:1|2}`, com o MESMO `tool_use_id` nos dois (trechos na ADR 0002, Probe 4). Por isso o id do registro virou `tool_use_id:runId:agentIndex` (dois cards, sem fusão; teste de registro em `integration.test.ts`).
`claude plugin test .` em `plugins/agent-office` => 323 pass, 0 fail (exit 0). Status segue IN_PROGRESS: AC-024 não atendido como escrito, falta juiz independente.
Removido: a forma inventada `{name, round, phases[{name, done, total, agentIds}]}` de `view-workflow.ts`, `WorkflowRun` em `run-model.ts` e `spec/04-contracts.md`, e seus testes (`parseRun`, "Rodada", "feitos/total", "Fase atual").

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-workflow.ts`, `plugins/agent-office/hooks/view-workflow.test.ts`.
Detectado por `workflow` no `agent.spawn` (register.tsx). As fases do canvas são ilustrativas; nome, rodada e fases não têm fonte no engine (ADR 0002).

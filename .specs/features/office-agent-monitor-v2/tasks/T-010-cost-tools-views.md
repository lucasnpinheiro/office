---
id: T-010
title: Visões Custo e Ferramentas
type: frontend
status: IN_PROGRESS
progress: 1/3
updated: 2026-11-05
depends_on: [T-003, T-006]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-010]
estimate: M
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-010 — Visões Custo e Ferramentas

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Custo com linha do tempo por agente e Ferramentas com contagem e última duração.

Fora: Limites ou alertas de gasto.

## Critérios de aceite
- [ ] AC-031 — WHEN a visão Custo é aberta, the system SHALL mostrar por agente barra de tempo, tokens, `~$` e tempo, e no topo total, tokens e o mais caro. Cenário: S-031 @success.
- [ ] AC-032 — WHERE um agente não tiver tokens ou custo, the system SHALL mostrar `—` e o total SHALL somar só os conhecidos com a marca `parcial`. Cenário: S-032 @deviation.
- [ ] AC-033 — IF nenhum agente tiver dado, the system SHALL mostrar `—` no total e nunca `~$0,00`; na visão Ferramentas SHALL ainda listar contagem e duração. Cenário: S-033 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-031 a AC-033) · cenários: `acceptance/views.feature` tag `@T-010` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/view-cost.ts`, `plugins/agent-office/hooks/view-tools.ts`.
Reaproveita `waterfallLines` (compact.ts:469). Custo é estimativa e não é dado financeiro nem fiscal.

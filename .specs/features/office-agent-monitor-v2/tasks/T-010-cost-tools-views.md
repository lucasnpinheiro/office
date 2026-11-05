---
id: T-010
title: Visões Custo e Ferramentas
type: frontend
status: IN_PROGRESS
progress: 3/3
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
- [x] AC-031 — WHEN a visão Custo é aberta, the system SHALL mostrar por agente barra de tempo, tokens, `~$` e tempo, e no topo total, tokens e o mais caro. Cenário: S-031 @success. (Alcançável por `g` (cards > linha do tempo > custo > ferramentas) e por `/office mode cost`, desenhada por `renderCompact`. `~$` por agente é sempre `—` (decisão de 2026-11-05, sem fonte por agente). No topo: tokens totais, "sessão ~$ —" ou o USD da sessão quando `$.session.usage().cost.usd` vem (ADR 0002, Probe 6; CLI), e o maior consumo por tokens (proxy, não por $).)
- [x] AC-032 — WHERE um agente não tiver tokens ou custo, the system SHALL mostrar `—` e o total SHALL somar só os conhecidos com a marca `parcial`. Cenário: S-032 @deviation. (O total inclui os tokens do turno principal; antes esta soma nunca era alimentada: bug corrigido nesta integração. Cabeçalho também mostra `tokens N parcial`.)
- [x] AC-033 — IF nenhum agente tiver dado, the system SHALL mostrar `—` no total e nunca `~$0,00`; na visão Ferramentas SHALL ainda listar contagem e duração. Cenário: S-033 @error. (Ferramentas alcançável por `g`; entrada e saída só com `OFFICE_CAPTURE_IO=1`, remascaradas.)

Removido: a leitura morta `n.usage?.costUsd` do cabeçalho de `compact.ts` (o `Node` nunca teve `usage`); no lugar, `tokens N [parcial]` do `RunModel.totals` e o USD da sessão só quando o engine o entrega.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-031 a AC-033) · cenários: `acceptance/views.feature` tag `@T-010` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main` (`feat/office-t007-t010-integration`)
- [x] Teste RED antes do GREEN (integration.test.ts vermelho antes de ligar os modos e o RunModel no register)
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova (base desta integração: 286 pass, 0 fail)
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes (não executadas)
- [ ] Julgada por subagente diferente do implementador
- [ ] Render real no terminal (`claude -p` não desenha o painel)

## Evidência
2026-11-05: `claude plugin test .` em `plugins/agent-office` => 323 pass, 0 fail (exit 0). Testes de registro (`integration.test.ts`) alcançam Custo e Ferramentas pela tecla `g`, com tokens por agente mais sessão (`1,5 mil parcial`), `~$ —` e USD da sessão (`sessão ~$0,05`) só com `session.usage`.
Status segue IN_PROGRESS: falta juiz independente, e2e-regression e render interativo. Não verificado: USD da sessão no App.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-cost.ts`, `plugins/agent-office/hooks/view-tools.ts`.
Reaproveita `waterfallLines` (compact.ts:469). Custo é estimativa e não é dado financeiro nem fiscal.

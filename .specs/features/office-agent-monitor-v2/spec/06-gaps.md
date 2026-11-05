---
status: TODO
progress: 0/7
updated: 2026-11-05
---
# Gaps, Swept, Observable e Unresolved

## Gaps (atual x canvas)
| # | Hoje | Canvas | Dado novo? | Task | Evidência |
|---|---|---|---|---|---|
| 1 | Só 3 últimas ferramentas | Linha do tempo com duração | sim | T-003 | `stats.ts:78` |
| 2 | Sem tokens por agente | Tokens e `~$` | sim, not verified | T-003 | Term5 |
| 3 | Prompt só truncado | Segredos mascarados | sim | T-004 | Flows5 |
| 4 | 6 estados | 8 estados | parcial | T-005 | `monitor.ts:18` |
| 5 | `attention` só por 10 min ou quota | Precisa de você separado | sim, not verified | T-011 | `monitor.ts:88` |
| 6 | Sem workflow | Fases e rodada | sim, not verified | T-008 | `register.tsx:358` |
| 7 | Worktree de definição não reconhecida | Todo agente no grupo certo | parcial | T-007 | PR #5 |
| 8 | Sem commits à frente | `+N commits` | sim, só CLI | T-007 | `git.ts` não usa subprocesso |
| 9 | `etaOf` com 2 amostras | 3 do mesmo modelo | não | T-009 | `monitor.ts:158` |
| 10 | Sem ações reais | Pause, Stop, Retry, Allow, Decline | sim, not verified | T-011, T-012 | `actions.ts` |
| 11 | Dois modos e quatro visões | Seis abas | não | T-006 a T-011 | `actions.ts:5`, `compact.ts:60` |
| 12 | Tipos duplicados | Um modelo | não | T-002 | `office.ts:3` |
| 13 | Compacto a 4 quadros/s | 6 quadros/s | não | T-014 | `office.ts:71` |
| 14 | Testes não bloqueiam CI | Bloqueiam se houver CLI | não | T-015 | `validate.yml:39` |

## Inconsistências do canvas resolvidas
| Item | Decisão | Motivo |
|---|---|---|
| Proto5 simula Recusar como parado; texto diz que continua | Continua (AC-037) | Texto é o comportamento declarado |
| `y` e `n` têm dois usos em Term5 | Confirmação tem prioridade | Evita ação errada |
| Sem tecla de pausa | `u` | `p` é irmão |
| Term5 mostra `6 arquivos` | De `files` já capturado (`stats.ts:96`), não de git | Sem subprocesso |
| Fases do `hier-orchestration` | Ilustrativas; só dado real | Regra de honestidade |

## Observable
| Superfície | Decisão | Destino |
|---|---|---|
| Todas as telas | estado vazio | AC-020, AC-025 |
| Ação | falha | AC-040 |
| Ação | sem suporte | AC-041 |
| Decisão | concorrência | AC-035 |
| Dados | ausente | AC-008, AC-032, AC-033 |
| App Claude | verificação | Unresolved 5 |

## Swept
- validation: `OFFICE_CAPTURE_IO` exato; larguras inválidas.
- failure modes: captura, máscara, git, engine, com ACs de erro em cada task.
- idempotency and retry: resposta por `tool_use_id`, uma só; Retry só com confirmação.
- authorization: só o pedido pendente, sem regra permanente.
- concurrency and ordering: decisões em fila; painel x diálogo nativo; agente termina durante o envio.
- data lifecycle: memória, some com a sessão; limite de 200 passos e 60 agentes.
- external-dependency failure: engine sem capacidade, CLI ausente, git ausente.
- state transitions: FLOW-004.
- observability: aviso no painel, sem log de conteúdo.

## Unresolved
| # | Kind | Pergunta | Até responder |
|---|---|---|---|
| 1 | blocks T-012 (Retry) | Retry precisa do prompt original, mas o canvas manda mascarar antes de guardar. | Só retomada pelo id do agente: sem cópia do prompt. Sem retomada, Retry fica oculto e a lacuna vai ao usuário. |
| 2 | blocks T-011, T-012 | Quais ações o engine aceita? | T-001; sem suporte, não aparece. |
| 3 | open, precisa do usuário | PR #3 (2026-10-22) definiu início na visão `map`; Term5 inicia na Árvore e não mostra mapa. | Mantém `map` como inicial e a Árvore no ciclo de `v`. |
| 4 | open | Custo por agente: fonte do engine ou tabela de preços datada? | Mostra `—`. Preço não foi inventado nesta spec. |
| 5 | blocks go-live, só o app | Motion, largura, 44 px e `prefers-reduced-motion` no app só se provam executando. | Marcado not verified; não declara paridade. |
| 6 | open | Meta de 93% de cobertura sem ferramenta: `claude plugin test --help` não tem opção, sem `package.json` e sem `bun` no PATH. | Rastreio AC → teste; números só quando houver ferramenta. |
| 7 | open | CI com `claude plugin test`: a imagem do CI tem o binário e autenticação? | Passo registra `skipped` (AC-050). |

Decisão do usuário (2026-11-05), visão inicial: mantém `map` como visão inicial; a árvore entra no ciclo da tecla `v`. Encerra a ambiguidade 3.

Decisões do usuário (2026-11-05, finais):
- Controles (gap 10, Unresolved 2): provar em sessão real primeiro; entregar só o provado; lacuna volta ao usuário. Outras tasks seguem. Probe T-001: Retry por id provado no terminal; Allow e Decline provados só em modo não interativo; Stop não provado; Pause e openInChat sem suporte (ADR 0002).
- Custo (gap 2, Unresolved 4): tokens por agente mais total real da sessão; custo por agente fica `—`; sem tabela de preço. Encerra a Unresolved 4.

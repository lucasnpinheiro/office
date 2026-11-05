---
status: TODO
progress: 0/5
updated: 2026-11-05
---
# Pesquisa

Citações conferidas na árvore em `7a87da4`. `not verified` indica o que só a execução prova.

## Prior-Art Gate
| # | Verificação | Comando ou fonte | Resultado |
|---|---|---|---|
| P0 | Memória | contexto da tarefa | PRs #1 a #5 já entregaram visões, teclas, mapa, instalação, worktrees |
| P1 | Bundle anterior | `git log --all --diff-filter=D -- '.specs/features/*'` | nada; `.specs` não existia |
| P2 | Remoção proposital | `gh pr list`, PR #3 | PR #3 definiu início na visão `map`: ver P5 |
| P3 | Sintoma vivo | leitura do código | itens confirmados abaixo |
| P4 | Seed | not applicable — sem banco | — |
| P5 | Regra revertida | PR #3 (2026-10-22) x Term5 | visão inicial em conflito: Unresolved 3 |
| P6 | Dados vivos | not applicable — sem banco | — |

Lane: feature, não delta. Base de testes executada: `claude plugin test .` com 147 pass, 0 fail, 12 arquivos.

## Correções ao que foi informado
| Item | Informado | Encontrado |
|---|---|---|
| `isQuotaError` sem `HTTP/1.1 429` | aberto | já corrigido: `monitor.ts:14`, teste `review.test.ts:33` |
| Largura de emoji em `strWidth` | aberto | já coberto: `monitor.ts:241`, teste `review.test.ts:38`; sem task, só regressão |
| `etaOf` | `monitor.ts:157` | `monitor.ts:158` |
| Detalhe compacto | `compact.ts:560` | `compact.ts:526` |
| Comentário sobre `/` e Esc | `actions.ts:48` | `actions.ts:35` |
| `isolatedCall` | `stats.ts:193` | `stats.ts:195` |

## Cadeia de dependência
1. Engine: eventos `tool.call`, `tool.check`, `turn.step`, `$.agent.list` (`.claude-plugin/types/claude-code/index.d.ts`).
2. `register.tsx`: handlers (`:358`, `:388`) e `$.ui.open` (`:171`).
3. `stats.ts` e `git.ts`: reduz eventos em `AgentLike` (`office.ts:3`), duplicado de `OfficeAgent` (`types/index.d.ts:2`).
4. `monitor.ts`: `buildGraph`, `progressOf:131`, `etaOf:158`, `Line`/`Seg:189`.
5. `compact.ts`: `Mode:60`, `waterfallLines:469`; `actions.ts`: redutor de UI.

## Hipóteses do engine (só leitura de tipos; T-001 prova)
| Capacidade | Indício em `index.d.ts` | Situação |
|---|---|---|
| Pause | `AgentStatus` tem `waiting` e `idle` (`:566`); nenhum método de pausa visto em `$.agent` | not verified, provável ausência |
| Stop | status `killed` (`:566`); `$.agent` a partir de `:3252` mostrou `list` e `register` | not verified, sem método visto |
| Retry | comentário em `:564`: uma mensagem pode retomar agente encerrado sob o mesmo id | not verified |
| Allow e Decline | `tool.check` com `agentId` (`:13663`) e veredito (`:13726`) | not verified; não está provado que hook pode aguardar a pessoa |
| Open-in-chat | `prompt.fill` (`:3060`) | not verified |
| Tempo por ferramenta | medir em volta de `next(e)` em `tool.call` | provável; o padrão de hook já existe |
| Tokens por agente | `turn.step` com `agentId` (`:14343`) e `usage` (`:4832`) | not verified |
| Custo | `$.session.usage()` só por sessão (`:2905`); por agente não visto | not verified; tabela de preço só se T-001 justificar, com data |
| Workflow | sem tipo visto; formato real da ferramenta Workflow | not verified |
| Worktree por definição | `isolation` em spec de agente (`:555`) | indício |
| Commits à frente | `$.process` (`:3587`), comentário "CLI only" | no app, provável ausência |
| Superfície | `$.session.surfaces()` (`:2875`), `RenderSurface` | not verified no app |

Método de T-001: mod temporária fora do plugin, em sessão real, que registra cada evento em memória e tenta cada ação em um subagente descartável. O código do spike não entra no plugin.

## Enumerações e transições
`RunState`: `queued`, `running`, `needs-you`, `stalled`, `paused`, `failed`, `done`, `stopped`. Transições em `flows.md` FLOW-004. O `inactive` de `monitor.ts:18` não está no Padrão: vira `queued` sem primeira ferramenta, e `done` se encerrado.

## Casos de uso
| Caso | Entrada | Saída | Pré | Erros |
|---|---|---|---|---|
| Ver fluxo | eventos | `RunModel` | painel aberto | dado ausente → `—` |
| Decidir | tecla 1 ou 2 | veredito | `needs-you` e capacidade | engine rejeita → mantém estado |
| Agir | tecla + `y` | resposta do engine | capacidade | falha → mensagem no card |
| Abrir detalhe | Enter | tela de detalhe | nó existe | sumiu → volta à lista |

## Reuso antes de criar
`buildGraph`, `renderCompact`, `waterfallLines`, `layoutLevel`, `detectCaps`, `truncLine`, `isolatedCall`, `worktreeOf`, `worktreeFromPath`, `applyTool`, `Seg`. Novo só o listado em cada task.

## Redraw (equivalente a N+1)
`drawSig` (`office.ts:84`) serializa todos os agentes a cada quadro. Com passos e I/O o custo cresce: T-003 usa contador de versão por agente em vez de serializar a linha do tempo. Não existe query.

## Contratos externos
Tipos locais do engine em `.claude-plugin/types`, sem versionamento visível: fixar a versão observada na ADR 0002. Nenhuma biblioteca nova.

## Casos de borda
1. Agente sai pelo limite de 60 (`register.tsx:338`) enquanto selecionado ou com pedido pendente.
2. Dois pedidos de permissão simultâneos: fila por ordem, um por vez, cada um com seu `tool_use_id`.
3. Resposta nativa antes da resposta do painel: a segunda é descartada.
4. Stop confirmado depois que o agente terminou: mostra o estado real, sem erro.
5. Sessão retomada sem estado anterior: histórico começa vazio, com `—`.
6. Agentes paralelos: ETA não pode somar como sequenciais.
7. Rótulo com segredo em comando Bash: máscara antes do `recent` (`stats.ts:78`).
8. Largura zero ou desconhecida.
9. Ramo removido entre leituras de `git rev-list`: omite a contagem.
10. Saída muito grande com opt-in: mascara e depois limita, para não partir um segredo em partes visíveis.

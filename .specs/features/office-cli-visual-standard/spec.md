---
status: READY
progress: 0/6
updated: 2026-11-17
---
# office-cli-visual-standard (agent-office, base main 95ebc8c)

Pedido 2026-11-17: 18 capturas reais do painel CLI (terminal, "compact frame") em todas as abas + detalhe. Prior-Art Gate: office-desktop-visual-standard (REQ-501..504, #106-#109) cobre a superfície app; este bundle cobre o painel de terminal (renderCompact + Pane). Nenhum item aqui repete REQ-501..504.

## Desvios investigados (causa raiz com file:line, main 95ebc8c)
| # | Suspeita | Veredito | Causa raiz |
|---|---|---|---|
| 1 | Rótulos do rodapé cortados em 1 char (`g: mod`, `o: ordena`, `q: fecha`); duas variantes | CONFIRMADO o corte; "regressão #106/#108" REJEITADA | Corte: actions.ts footerRows empacota por `cols` (`[...seg.t].length`, actions.ts:126-130) e register.tsx:698-701 desenha cada item como `Button`/`Text` flex com shrink padrão; a largura real do painel é menor que `cols`, o Yoga encolhe cada rótulo em ~1 char. Variantes: as 3 abas com `g,o,v,q` são o build anterior a 87d0560 (#108, `filterable` removido de actions.ts:62); #108 só alargou a linha de 83 para 94 colunas e expôs o corte. Em main há uma única variante (render headless idêntico nas 8 abas). |
| 2 | Estilo da aba ativa inconsistente | CONFIRMADO | compact.ts:238 `Button variant primary/secondary` + bold: o cursor de foco (Tab) do host pinta o botão focado invertido, igual à aba ativa; aba ativa = texto colorido quando sem foco. Dois sinais para o mesmo conceito. |
| 3 | Régua do header tracejada vs sólida | CONFIRMADO | compact.ts:222-226 une as fatias do header com `sp(1)` (`━━ ━━`); o divisor do rodapé (compact.ts:264) e o de worktree são `─`/`━` contínuos. |
| 4 | Legenda do Mapa cortada à direita, sem teclas | CONFIRMADO (corte); "sem teclas" REJEITADO | compact.ts:268 emite a legenda longa em 1 linha e o `fit` final (compact.ts:~873) corta sem `…`. As teclas existem (footerRows), mas ficam abaixo da legenda, fora da janela em 24 linhas (render map-80x24: 26 linhas desenhadas). |
| 5 | Ferramentas repete o mesmo nome 6x sem #n; overflow sem rodapé/rolagem | CONFIRMADO | view-tools.ts:20 e view-cost.ts:62,99 usam `n.name` do RunModel (run-model.ts), não o `names()` de compact.ts:118 que dá `#n`; renderCompact compact.ts:866-868 anexa o corpo inteiro sem janela (só map/cards têm janela, compact.ts:793-860), então o rodapé sai do painel. |
| 6 | Custo sem rodapé no overflow; eixo em segundos `11362s` (Waterfall também) | CONFIRMADO | compact.ts:732 eixo `${secs}s`; view-cost.ts:62-99 sem janela; durações usam fmtMMSS (monitor.ts:102) que passa de `99:59` (`183:11`) e o header usa fmtHMS (monitor.ts:97): 3 formatos. |
| 7 | Linha de Worktrees estoura a borda em vez de `…` | CONFIRMADO | view-worktrees.ts:71-80 `agentsLine` monta uma linha sem limite; compact.ts:379 e o `fit` final (compact.ts:~873) cortam seco/estouram sem `…`. |
| 8 | Detalhe: SOLICITAÇÃO `—`, "sem total conhecido" | REJEITADO como bug | view-detail.ts:138 `—` é o fallback quando o agente não tem prompt capturado; :29/:133 "sem total conhecido" quando não há lista de tarefas. Estado real dos dados, não defeito de render. Fora de escopo. |
| 9 | Raiz do Mapa "Claude Code" vs "Orquestrador" | REJEITADO como bug | run-model.ts:115-116 regra de design: 1 agente de topo mantém Orquestrador, 2+ viram "Claude Code" (app-cards.ts:78 documenta). Mantido. |
| 10 | Tokens `9,8 mi parcial` vs `10 mi` | REJEITADO como bug | compact.ts:206 o header soma só quem tem dado e marca `parcial` (run-model totals.partial); a aba Custo (view-cost.ts) soma incluindo estimativa. Fontes diferentes por design; não verificado com os valores do print. |

## Requisitos
- REQ-601 Um único rodapé: rótulos completos do KEY_MAP, mesmas teclas em toda aba, quebra por largura real (margem de 2 colunas, item nunca encolhe), nunca corta no meio da palavra.
- REQ-602 Um único estilo de aba ativa (texto invertido fixo, sem depender do foco) e uma única régua de header contínua.
- REQ-603 Toda aba cabe na altura do terminal: corpo em janela, indicador `↓ N mais` (e `↑ N mais`), rodapé sempre visível; j/k rolam em toda aba de lista.
- REQ-604 Um só formato de tempo em toda tela: `mm:ss` abaixo de 1 h, `h:mm:ss` a partir de 1 h (header, cards, Waterfall, Custo, detalhe, eixo).
- REQ-605 Nomes duplicados ganham `#n` em todas as abas (Waterfall, Custo, Ferramentas, Workflow), e o truncamento preserva o sufixo (`QA: teste de r… #3`).
- REQ-606 Toda linha é truncada com `…` na largura (Worktrees, legenda do Mapa, qualquer linha final de renderCompact); nunca corte seco.
- REQ-607 README (plugin) descreve o padrão; capturas só reais.
Fora de escopo: itens 8, 9, 10; redesign do mapa/cards; superfície app.

## Spec técnica
- Janela: nova função pura `windowBody(lines, avail, scroll) -> { lines, above, below }` em compact.ts (ou view-window.ts) usada por tree/grouped/waterfall/cost/tools/workflow; `avail = maxLines - head - foot`. Escreve `scrollInfo.max` como o mapa já faz. Nota `↓ N mais` = linhas escondidas abaixo (o mapa mantém `k/n`).
- Tempo: `fmtDur(ms)` único em monitor.ts; fmtMMSS e fmtHMS viram alias. Eixo do waterfall usa `fmtDur`.
- Nome: `clipName(name, w)` em monitor.ts: separa sufixo ` #n`, corta o resto com `…`. RunModel recebe o mapa `names()`.
- Truncamento final: `fit` ganha modo `ellipsis` usado no `map` final de renderCompact.
- Rodapé: footerRows recebe `cols - 2`; no register.tsx cada item com `flexShrink={0}`.
- Aba ativa: `variant` fixo + sem `hotkey/focus` pintando diferente; o foco usa sublinhado, não inversão.
Índice: tasks/README.md · tests.md · acceptance/cli-visual.feature
Evidência: render headless de cada aba + detalhe em 80/120/160 colunas x 24/40 linhas (6 agentes de mesmo nome, execução > 3 h).
Não verificado: largura real do painel no host (causa do item 1 inferida do render e do Yoga); item 7 só reproduzido por leitura.

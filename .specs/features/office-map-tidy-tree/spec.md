---
status: TODO
progress: 0/9
updated: 2026-11-15
---
# office-map-tidy-tree (agent-office, base main 0.28.16)

Pedido (/spec-research reenviado + 2 imagens do "Office Agent Monitor", 2026-11-15): "Estas imagens podem ajudar melhor na diagramação".
Alvo: tidy-tree (pai centrado sobre o próprio grupo de filhos), barramento por pai com "•", card compacto de 4 linhas
(glifo + borda por estado), borda tracejada "Concluído · aguarda filhos", ▾ + barra "Ramos", legenda e cabeçalho do monitor.

## Delta real vs main 0.28.16
| Alvo (imagens) | Já existe | Falta |
|---|---|---|
| Pai centrado sobre seus filhos; subárvores lado a lado | compact.ts measure/draw (598-619): cada filho mede a própria subárvore e o pai centra sobre a linha; 1 filho = queda reta | App: mapTree sem a mesma regra de largura por subárvore (validar); barramento só entre 1º e último filho (hoje inclui o pai: lo..hi) |
| Barramento próprio por pai com "•" | barramento `┄` com ┬ ┴ ┼; sem "•" | junção "•" em cada queda; ascii "o" |
| 6 por linha | linhas de 6 + vão central (0.28.14/16, só terminal) | convivência: decisão D-1 abaixo |
| Card enxuto | card 7+ linhas: título (até 2), chips, branch+papel, barra, status+custo·tempo, pill | card 5-6 linhas, pill/papel/custo mantidos, borda por estado |
| Borda tracejada "aguarda filhos" | BORDER por estado (compact.ts:432), sem tracejado; hasRunningDescendant existe | novo estado visual derivado |
| ▾ e barra "Ramos" | ▾ e Ramos só no modo Árvore (monitor.ts:164, register.tsx:920) | Mapa terminal e app (ASK-3) |
| Legenda | 5 estados (compact.ts:252) | + Inativo, "aguarda filhos", ⧉ Worktree |
| Níveis de profundidade N/10 | só no modo Árvore, N/MAX_DEPTH(50) (compact.ts:258) | também no Mapa; denominador 10 (teto visual 0.28.14) |
| Cabeçalho "Office Agent Monitor" | caixa "Office · proj · branch" + contagens + ETA (compact.ts:189-225) | decidido |

## Decisões tomadas aqui (sem conflito com escolha anterior)
- D-1: até 6 filhos cabendo na largura = tidy-tree puro (1 linha); excedente em linhas de até 6 sob o mesmo pai, cada linha com barramento próprio; vão central de 0.28.16 mantido só no terminal.
- D-2: "•" na queda de cada filho; ascii usa "o".
- D-3: legenda ganha Inativo, "-- Concluído · aguarda filhos" e ⧉ Worktree; profundidade N/10 no Mapa e na Árvore.

## Decisões do usuário (ASKs resolvidos 2026-11-15)
- ASK-1: manter o pill e ACRESCENTAR borda tracejada "aguarda filhos"; glifo e cor de borda somam ao pill; office-map-mock-style não é superado.
- ASK-2: cabeçalho ESTENDIDO (mantém projeto, branch, tokens e custo; soma Progresso Geral com barra, Decorrido, Estimativa).
- ASK-3: recolher (▾ por card + barra "Ramos") no Mapa do terminal e do app, estado compartilhado com a Árvore.
- ASK-4: manter papel e custo; card de 5-6 linhas, enxugando o redundante; título em 2 linhas mantido.
Índice: tasks/README.md · tests.md · acceptance/tidy-tree.feature · spec/01-layout.md · spec/02-card-chrome.md
Não verificado: telas das imagens (só transcrição); OpenSpec CLI ausente.

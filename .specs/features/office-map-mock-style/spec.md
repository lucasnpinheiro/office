---
status: TODO
progress: 0/10
updated: 2026-11-15
---
# office-map-mock-style (agent-office 0.28.14)

Pedido (/spec-research, 2026-11-15): "Ajustar fluxo de cards, ajustes pontuais ... Ajustar para os padrões".
Padrão = mock "Mapa de tarefas" (imagem 3). Decisões do usuário: largura mínima 18; abaixo do mínimo reduz
colunas até 1 (nunca trunca dado, sem scroll horizontal); nível 10 mostra "+N ocultos"; scroll do Mapa com j/k.

## Delta real (main @ cd37fb5, 0.28.13)
| Já existe | Falta |
|---|---|
| App: até 6 por linha, largura dinâmica 15..26 só para filhos da raiz (app-cards.ts:80-85) | Neto em diante em coluna (app-cards.ts:73 layout 'column'); sem partição em 6 |
| Terminal: linhas por largura, tronco tracejado (compact.ts:567-623) | `stack = n !== g.root` (compact.ts:571) força 1 filho por linha abaixo da raiz |
| MAX_DEPTH=50 do grafo (run-model.ts:9) | Teto visual de 10 + "+N ocultos" |
| j/k no detalhe (detailScrollStep) e na lista de cards | j/k no Mapa; indicador de continuação |

Este spec SUPERSEDE: office-org-tree-2d "subagentes empilhados" (2026-11-14) e 0.28.13 "não mudar o conteúdo interno" (pill substitui ✓).

## Índice
| REQ | Resumo | Spec | Tasks | Tests |
|---|---|---|---|---|
| REQ-001..005 | Árvore: linhas de 6, largura por pai, nível 10, conectores, scroll | spec/01 | T-001 T-002 T-003 | tests/unit, integration, ui-design |
| REQ-006..008 | Card: meta sem quebra, pill sempre, rodapé | spec/02 | T-004 | tests/unit, ui-design |
| REQ-009..010 | Legenda e detalhe | spec/03 | T-005 | tests/unit, validation |
| REQ-011 | Docs e versão | spec/03 | T-006 | tests/integration |

Tasks: tasks/README.md · Tests: tests.md · Gherkin: acceptance/map-mock-style.feature
Gates: BRANCH_ISOLATED ok · SPEC_GENERATED ok · SKILLS_RESOLVED (ver tasks/README.md) · TESTS_GENERATED ok
Não verificado: OpenSpec CLI ausente na máquina (command -v openspec vazio); openspec validate não rodou.

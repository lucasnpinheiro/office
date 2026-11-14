# Spec: office-org-tree-2d (agent-office 0.28.5)

## Problema
Em 0.28.4 o mapa de cards desenha todos os níveis na horizontal: os filhos de cada card (inclusive subagentes)
abrem um barramento lateral, então a árvore cresce só para os lados. O cartão do Orquestrador mostra
"🎯 Orquestrador" como persona, e no app um único agente de topo vira a raiz (some o Orquestrador).

## Referência
Screenshot do usuário `Screen Shot 2026-11-14 at 13.24.21 PM.png`:
- Raiz "Orquestrador" centralizada no topo, pill "Rodando", linha 2 `🧭 Squad Leader · 👑 Opus · 🟢 baixo`,
  `⎇ main` à esquerda, `orquestrador` à direita, barra de progresso, `~$custo · mm:ss`.
- Barramento sob a raiz liga os agentes diretos (nível 1) numa ÚNICA linha horizontal.
- Subagentes (nível >= 2) ficam na VERTICAL, logo abaixo do próprio pai, mesma coluna, ligados por um
  conector vertical (base do pai -> topo do filho).
- Anatomia do card inalterada: título + pill, persona · modelo · esforço, branch/worktree + papel
  (agente/subagente), barra segmentada, status + custo · tempo.

## Comportamento esperado
| Nível | Terminal (compact.ts) | Desktop (app-cards.ts + register.tsx) |
|---|---|---|
| 0 raiz | sempre o card Orquestrador | sempre o card Orquestrador (`layout: 'row'`), mesmo com 1 agente |
| 1 agentes | uma linha horizontal sob a raiz; quebra em linhas presas a um tronco só quando não cabem | idem (`perRowApp`) |
| >= 2 subagentes | empilhados um por linha na coluna do pai; 1 filho = conector `┊` reto; vários = tronco à esquerda com `╭ ├ ╰` | `layout: 'column'`: coluna centralizada sob o pai, stub de 1 célula entre filhos |

Orquestrador: persona `🧭 Squad Leader` (não `🎯 Orquestrador`), modelo Opus, esforço baixo.

## Overflow / painel estreito
Nenhum card é descartado nem encolhido. Linha de nível 1 que não cabe quebra em linhas (tronco pontilhado);
o painel rola (janela de linhas de `renderCompact`, `scrollInfo`). A pilha vertical só aumenta a altura.

## Critérios de aceite
- AC-1 Terminal: com 4 agentes e subagentes t1,t2 (pai a) e n1 (pai b) a 200 col, as linhas de cards têm
  [1, 4, 2, 1] cards; t1 e n1 na coluna de a e b; t2 na mesma coluna de t1 (nunca ao lado).
- AC-2 Terminal: subagente único: `┬` da base do pai e `┴` do topo do filho na mesma coluna, `┊` entre eles.
- AC-3 Terminal: painel estreito (78 col) mostra todos os 7 cards.
- AC-4 Orquestrador mostra `🧭 Squad Leader · … Opus` no terminal e chips `['🧭 Squad Leader','👑 Opus','🟢 baixo']` no app.
- AC-5 App: `appMap` raiz sempre `session`/Orquestrador com `layout: 'row'`; filhos de agente `layout: 'column'`.
- Testes: `plugins/agent-office/hooks/org-tree-2d.test.ts`.

## Fora do escopo
Dados de custo/branch/cores (já existentes). Verificação visual no app Desktop real (só testes de render).

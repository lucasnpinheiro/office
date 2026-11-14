# Spec: cards sempre visíveis (agent-office 0.28.1)

Origem: relato do usuário, pt-BR verbatim: "está cortando partes dos card, é obrigatorio exibir e estar visivel na tela todos os cards". Evidência: screenshots do painel `/office` (Warp, ~1150 px, ~150 colunas).

## Bugs

| # | Evidência (screenshot) | Esperado | Atual | Causa (arquivo:linha, antes da correção) |
|---|---|---|---|---|
| B1 | Cards ocupam ~10 linhas; 2º card cortado no meio; ~50% do painel vazio abaixo do rodapé. calc-run: 19 filhos, ~4,5 visíveis | Viewport usa a altura do painel; todo card inteiro | Janela de altura fixa; rodapé logo abaixo da janela | `office.ts:95` `rows - 9` (chrome fixo); `compact.ts` `Math.max(CARD_H + 3, maxLines)` (piso de 10 linhas); rodapé colado após a janela; janela em passos de linha |
| B2 | Cabeçalho "10 concluídos", "delega 11 filhos", só 1 card desenhado | Todo agente finalizado desenhado em toda aba | Árvore/Worktrees ocultam concluídos após 30 s; Mapa só com a parte da janela | `compact.ts` `keep = visibleSet(..., hiddenIds(g, now))` nos ramos de lista/árvore; `run-model.ts:195` expira após `HIDE_AFTER_MS` |
| B3 | Rodapé "j: descer · k: subir"; topo "k sobe · j desce" | Versão atual do plugin (0.27+) | Instalado 0.25.0 | Não é código: `~/.claude/plugins/installed_plugins.json` e clone `marketplaces/office` em 0.25.0 |
| B4 | "⎇ spec/andamento-2026-11-" cortado colado em "agente L1" | Corte com `…` e espaço antes do papel | Corte seco na mesma linha do papel | `compact.ts` `split()` usa `fit` sem reticências |
| B5 | Orquestrador "Rodando" com cabeçalho "0 rodando · 19 concluídos"; tempo 00:16 no card vs 00:11 no cabeçalho | Card e cabeçalho concordam | Card fixo em `running`, tempo sem fim | `run-model.ts:74` `state: 'running'` fixo na raiz; sem `root.end` |

## Requisitos

- R1. Todos os cards visíveis. O viewport usa a altura do painel (`bodyRows`, ou `viewport.rows`) menos o chrome medido. Se não couber: forma densa (6 linhas, sem chips), depois compacta (4 linhas, sem bordas), antes de qualquer rolagem. Se a rolagem for inevitável: a janela anda por cards inteiros (um card por passo, `scrollInfo.units`), nunca corta um card. O rodapé fica na última linha.
- R2. Sem corte horizontal: a indentação é limitada para o card manter `CARD_MIN_W` (20 colunas) dentro do painel.

## BDD

Success
- Dado 19 filhos e painel de 130 linhas, Quando renderizo, Então vejo os 19 nomes, sem setas de rolagem, com 130 linhas exatas.
- Dado 19 filhos e painel de 40 linhas, Quando rolo passo a passo, Então todo título visível tem sua linha de status visível.
- Dado agentes concluídos há mais de 30 s, Quando troco para Árvore, Então todos aparecem.

Error
- Dado `maxLines` menor que 6, Quando renderizo, Então o piso de 6 linhas vale e nada estoura a largura.
- Dado painel de 40 colunas, Quando renderizo, Então o modo linha é usado (regra de colunas existente, sem corte de card).

Deviation
- Dado árvore profunda (45 níveis) a 64 colunas, Quando renderizo, Então o card do nível 44 termina com a borda `│`.
- Dado branch longa e papel "agente L1", Quando renderizo, Então a linha termina em `…` seguido de espaço e do papel.
- Dado todos os agentes finalizados, Quando renderizo, Então o orquestrador mostra `Concluído` e o mesmo tempo do cabeçalho.

## Testes de aceitação

Arquivo novo: `plugins/agent-office/hooks/cards-visible.test.ts` (6 testes, todos vermelhos antes da correção). Ajustados por mudança de regra: `scroll-responsive.test.ts` (altura do painel = `bodyRows`), `cards-tree.test.ts` e `compact.test.ts` (passo por card, não por 8 linhas), `real-render.test.ts` (forma densa mantém papel).
Suíte: baseline 439 passando; depois 445 passando, 0 falhando (`claude plugin test plugins/agent-office`, exit 0).

## Status

- B1: corrigido em código e testado. Altura real do painel do usuário não verificada: o engine define `bodyRows`.
- B2: corrigido (compact + app-cards sem expiração). Mapa/Árvore/Worktrees testados; visual do app não verificado.
- B3: não é código. Causa: plugin instalado 0.25.0. Atualização só após merge em `main` (o marketplace lê o GitHub).
- B4: corrigido (`…`), testado.
- B5: corrigido (raiz `done` com `end`), testado.

## Fora de escopo

- Mudança de expiração do renderer antigo do mapa (`monitor.ts`, teste 'completed agents hide 30s') mantida.
- Largura de container no app (`containerWidth`, ADR 0002) não tratada.

## Vídeo 2026-11-14 (0.25.0 instalado, spec-2)

Versão vista: 0.25.0 (rodapé `j: descer · k: subir` e `k sobe · j desce` não existem em main 0.27 nem em 0.28.1). 1182 quadros distintos (mpdecimate), 99 folhas revisadas, 0–93 s.

| Tempo | Sintoma | No 0.28.1? | Agora |
|---|---|---|---|
| 0–25 s | cards cortados na borda inferior, `mais cards abaixo` sobre a borda, metade do painel vazia | sim (B1) | verificado (55 linhas, passos por card) |
| 29.8–30.8 s | título cortado no meio sem `…`: "Operações bitwise 0b1010 e shi", "Conversões bin/oct/hex 255 e 4" | não | corrigido: `compact.ts` título com `split(…, true)` |
| 33–34 s | card pela metade na borda inferior | sim (B1) | verificado |
| 37–42 s | 3 cards desenhados; cabeçalho 8 rodando / 16 concluídos | não reproduzido | depende do estado dos agentes |
| 48–63 s | orquestrador `Rodando 100%` com filhos concluídos | sim para raiz concluída (B5) | não reproduzido (dado de status) |
| 56–92 s | filhos concluídos somem; só o orquestrador fica | sim (B2, sem expiração) | verificado: 24 concluídos seguem |
| 46–63 s | notificação do Claude Code sobre o painel | fora do plugin | — |

Testes: baseline 445 pass / 0 fail. Novo `hooks/cards-video.test.ts` (4 testes): 2 vermelhos antes da correção (título cortado), 2 verdes. Total 449. Ajuste: `compact.test.ts` "card title" agora espera `comp…` (a reticência custa uma coluna). Flake: "depth 50" roda em 4.5–5.8 s contra limite de 5 s (baseline 4.7 s, sem correção 4.97 s); pré-existente, não alterado.

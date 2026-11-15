---
status: TODO
progress: 0/5
updated: 2026-11-15
---
# Spec 01 — Árvore em linhas de seis (Mapa terminal + app)

Superfícies: terminal `compact.ts` (cardLines/measure/draw) e app `app-cards.ts` + `register.tsx` (mapTree).

- REQ-001 Todo pai (qualquer nível) parte seus filhos, na ordem original, em linhas de no máximo 6. Com 7 filhos a 2ª linha começa no 7º. Remove `stack` (compact.ts:571) e `layout:'column'` (app-cards.ts:73).
- REQ-002 Largura por pai: `avail` = largura do contêiner do pai menos bordas/gaps. `cols = min(6, n, max(1, floor((avail+gap)/(18+gap))))`; `w = clamp(floor((avail-gap*(cols-1))/cols), 18, W_MAX)` (W_MAX 34 terminal, 26 app). Abaixo de 18 só reduz `cols` até 1; nunca trunca dado nem rola na horizontal. APP_CARD_MIN passa de 15 para 18.
- REQ-003 Até 10 subníveis visíveis (raiz = nível 0). Nível 10 com filhos mostra marcador "+N ocultos" (N = descendentes não desenhados). O modelo e o detalhe seguem alcançando tudo; MAX_DEPTH=50 do grafo não muda.
- REQ-004 Conectores: cada linha de filhos tem barramento horizontal sob o pai e queda vertical em cada filho; neto fica direto sob o pai (coluna do pai, queda reta). Sem tronco lateral contornando subárvore (defeitos D3, D4); linha 2+ liga ao mesmo pai por barramento próprio.
- REQ-005 Árvore mais alta que a tela rola na vertical com j/k (mesma regra do detalhe, 3 linhas por toque, limite no 1º e último); indicador "↓ mais" / "↑ mais" nas bordas; resize invalida o layout (cache measure) e redesenha; relações e dados preservados.

Casos de borda: 0 filhos; 1 filho; 6; 7; 12; avail < 18 (cols=1); cadeia de 12 níveis; terminal 40 colunas.
Risco: aninhar 6 por linha em 3+ níveis estreita `avail`; por REQ-002 vira 1 por linha, árvore fica alta e rola.

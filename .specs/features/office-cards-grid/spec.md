# Spec: office-cards-grid (agent-office 0.28.8)

## Problema
Na superfície app (desktop/vscode/mobile) a visão de cards desenhava todos os cards numa única linha horizontal
(`flexWrap="wrap"` não quebrava no engine). O design pede grade 2D: cards na horizontal E na vertical.
A imagem do usuário (Image #7) não estava acessível; a fidelidade segue o design já documentado em
`.specs/features/office-org-tree-2d/spec.md` (cards 34 de largura, gap 2).

## Comportamento esperado
- Cards em linhas explícitas: `appPerRow(cols) = max(1, floor((cols - 2 + 2) / 36))` por linha.
- Painel mais estreito que um card: 1 por linha, nenhum card some. 1 card: 1 linha. 0 cards: nenhuma linha.
- A árvore (mapa) usa a mesma regra (`perRowApp` agora vem de `appPerRow`).

## Critérios de aceite
- AC-1 `appGrid(7 itens, 120)` = [3,3,1]; `(…, 200)` = [5,2]; `(…, 10)` = 7 linhas de 1.
- AC-2 `appGrid(['a'], 120)` = [['a']]; `appGrid([], 120)` = [].
- Teste: `app-cards.test.ts` (grid).

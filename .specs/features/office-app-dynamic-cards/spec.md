# office-app-dynamic-cards

Status: DONE (0.28.13)

## Request (pt-BR, 2026-11-15)
Diminuir card e texto proporcionalmente à quantidade de agentes; hoje quebra com 3 lado a lado, permitir até 6. Não mudar o conteúdo interno.

## Delta found
`APP_CARD_W = 26` fixed; `appPerRow` = floor((cols-2+2)/28) → 3 cards in ~90-col panes.

## Decision
App surface renders in a cell grid (Box/Text): there is no font-size prop, so scale = card width.
- `appCardW(count, cols) = clamp(floor((cols-2+2)/min(count,6)) - 2, 15, 26)`, one width per map (root siblings) and per grid.
- `appPerRow(cols, w)` capped at 6.
- Terminal cards (compact.ts) unchanged.

## Acceptance
- AC-1: 3 siblings at 120 cols keep 26 wide.
- AC-2: 6 siblings at 120 cols → 18 wide, one row of 6.
- AC-3: 9 siblings → rows [6, 3].
- AC-4: 6 siblings at 60 cols → floor 15, rows [3, 3].
- AC-5: wide pane never more than 6 per row.

Tests: `plugins/agent-office/hooks/app-cards.test.ts`, `plugins/agent-office/hooks/real-render.test.ts`.

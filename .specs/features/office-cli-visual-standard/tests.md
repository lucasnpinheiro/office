# Testes (plano ≥93% das linhas tocadas)
| REQ | Unit | Integração (real-render) | E2E visual |
|---|---|---|---|
| 601 | footerRows: largura <= cols-2, rótulos completos, mesmo conjunto por aba | rodapé do Pane em 80/120 colunas igual nas 8 abas | print do terminal |
| 602 | tabsLine ativa idêntica com e sem foco; header sem espaço entre fatias | - | print |
| 603 | windowBody: dentro/fora da janela, above/below, scroll | cada aba com 40 agentes em 24 linhas: linhas <= 24, rodapé na última, `↓ N mais` | print por aba |
| 604 | fmtDur nas bordas (59s, 1h, 3h) | Waterfall/Custo/detalhe mostram o mesmo formato | print |
| 605 | clipName preserva ` #n` | 6 agentes iguais nas abas Waterfall/Custo/Ferramentas | print |
| 606 | fit ellipsis; agentsLine longa | legenda do Mapa e Worktrees em 80 colunas | print |
Baseline: 539 pass / 0 fail (main 95ebc8c). Harness de render: scratchpad render/render.test.ts (claude-code/testing).

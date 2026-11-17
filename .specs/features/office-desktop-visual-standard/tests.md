# Testes (plano ≥93% das linhas tocadas)
| REQ | Unit | Integração (real-render) | E2E visual |
|---|---|---|---|
| 501 | header app idêntico em mode map/tree/waterfall/cost/tools/workflow/worktrees; "0 falhas" | render app de cada aba compara linha header+abas | print desktop por aba |
| 502 | modo sem agentes não emite linha só de `─` | waterfall/workflow/custo vazios | print vazio |
| 503 | footerRows mesmo conteúdo por aba; nenhuma linha começa/termina com `|` | - | print |
| 504 | toolLine('Skill',{skill:'x'}) = `▸ Skill x`; Bash usa description | detalhe | print detalhe |

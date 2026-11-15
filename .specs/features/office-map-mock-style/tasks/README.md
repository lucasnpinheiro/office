---
status: DONE
progress: 6/6
updated: 2026-11-15
---
# Tasks — office-map-mock-style

| Task | Título | depends_on | Covers | Executor |
|---|---|---|---|---|
| T-001 | Terminal: árvore 6/linha | — | REQ-001..004 | Sonnet |
| T-002 | App: mapTree recursivo | — | REQ-001..004 | Sonnet |
| T-003 | Rolagem j/k Mapa | T-001 T-002 | REQ-005 | Haiku |
| T-004 | Card anatomia | T-001 | REQ-006..008 | Haiku |
| T-005 | Legenda e detalhe | — | REQ-009, 010 | Haiku |
| T-006 | Docs e versão | T-001..T-005 | REQ-011 | Haiku |

DAG: T-001 ∥ T-002 ∥ T-005 → T-003, T-004 → T-006. Um PR por task, branch task/T-NNN-slug.

## Skills (SKILLS_RESOLVED)
- security-engineer: not applicable — render local de TUI, sem entrada externa nova (campos já mascarados por maskText).
- domain-expert-erp: not applicable — sem regra fiscal, dinheiro só exibido.
- mysql: not applicable — sem banco.
- code-quality: aplicável, ver tests/unit.md (funções puras, sem mudar API pública além de APP_CARD_MIN).
- performance: aplicável — measure memoizado; árvore 500 nós < 50 ms (tests/load-k6.md N/A + U-027).
- frontend-architect: n/a (TUI Ink), UI_DESIGN_APPROVED pelo mock da imagem 3.
Cobertura planejada: linhas >= 93% nos arquivos tocados.

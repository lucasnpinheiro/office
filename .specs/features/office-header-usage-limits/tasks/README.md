---
status: TODO
progress: 0/4
updated: 2026-11-16
---
# Tasks — office-header-usage-limits

| Task | Título | depends_on | Estado |
|---|---|---|---|
| T-201 | Probe do shape de $.session.usage() | — | TODO |
| T-202 | Header: limites 5h/semana (terminal+app) | T-201 | TODO |
| T-203 | Claude Design: artboards atualizados | T-202 | TODO |
| T-204 | README, versão 0.28.17 | T-202 | TODO |

## Skills
- security-engineer: not applicable — dados de uso locais, sem segredo; sem rede.
- domain-expert-erp: not applicable — sem regra fiscal/financeira; custo só exibido.
- mysql: not applicable — sem banco.
- code-quality: aplicável (função pura usageLimits(raw)).
- performance: not applicable — 1 chamada já existente por refresh.
Cobertura planejada >= 93% linhas nos arquivos tocados.

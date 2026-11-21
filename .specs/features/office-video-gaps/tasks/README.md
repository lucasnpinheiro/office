---
status: DONE
progress: 4/4
updated: 2026-11-21
---
# Tasks — office-video-gaps

| Task | Título | depends_on | Estado |
|---|---|---|---|
| T-401 | Linha agora + rótulo | — | DONE |
| T-402 | Marca segura o fim | T-401 | DONE |
| T-403 | Pendente aguarda 1ª ação | T-401 | DONE |
| T-404 | README, versão 0.28.42 (alvo original 0.28.24), captura desktop | T-401, T-402, T-403 | DONE |

## Skills (baseline)
- security-engineer: not applicable — render local, sem entrada externa nova; S-401 garante máscara.
- domain-expert-erp: not applicable — sem regra fiscal/financeira.
- mysql: not applicable — sem banco.
- code-quality: aplicável — função pura, sem nova abstração.
- performance: not applicable — O(n) igual ao atual.
- frontend-architect: aplicável — segue frames do capítulo 9 do vídeo.
- lgpd-guard: not applicable — nenhum dado pessoal novo.
Cobertura planejada >= 93% linhas em compact.ts (trecho waterfall).

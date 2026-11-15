---
status: TODO
progress: 0/3
updated: 2026-11-15
---
# Spec 02 — Card no estilo do mock (imagem 3)

Anatomia (compact.ts:471-552 card(); register.tsx appCardBox): título + pill, persona·modelo·esforço, branch/worktree + papel, barra segmentada, status + custo · tempo.

- REQ-006 (D1) Linha 2 nunca quebra dentro de um chip: "🧭 Squad Leader · 🟢 baixo" não vira "🟢 / baixo". Separador compacto (1 espaço) cabe em 32 colunas; se ainda não couber, a quebra ocorre só entre chips (chip atômico). Hoje chipRows quebra por palavra (compact.ts:509-517).
- REQ-007 (D2) Pill de status (Rodando, Concluído, Falhou, Aguarda você, Na fila, Inativo) em TODO card, sempre. Hoje só aparece se título+pill couberem (compact.ts:541); o título encurta com … e o pill fica. O pill SUBSTITUI o prefixo ✓ do título (decisão do usuário; supersede 0.28.13). Borda vermelha em falha, amarela em "Aguarda você".
- REQ-008 (D5) Rodapé de status: trilha de ferramentas (a ‹ b ‹ c) corta por item inteiro com …, sem aspa solta (`php"`); custo/tempo à direita preservados.

Aceite visual: card 18, 26 e 34 colunas, estados running/done/failed/attention/pending.

---
status: BLOCKED
progress: 0/5
updated: 2026-11-15
blocked_by: ASK-1 ASK-2 ASK-3 ASK-4
---
# Spec 02 — Card compacto, recolher, legenda, cabeçalho

- REQ-111 (ASK-1/ASK-4) Card de 4 linhas: L1 glifo (● rodando azul, ✓ concluído verde) + título em negrito com … + ▾; L2 persona · modelo · esforço (dim, …); L3 ⎇ branch; L4 mini barra + % + mm:ss; rodando: trilha "▸ a ‹ b ‹ c" na L4 e progresso na L5. Sem pill; estado por glifo e borda. Recomendação (default da spec): MANTER pill e papel (reverter uma decisão do usuário exige ASK-1).
- REQ-112 Borda: sólida azul = rodando; sólida verde = concluído; tracejada = "Concluído · aguarda filhos" (done com descendente rodando, hasRunningDescendant); vermelha falha; amarela atenção.
- REQ-113 (ASK-3) ▾/▸ por card e barra "Ramos: [− Nome]" no Mapa (terminal e app); estado compartilhado com collapsedAt (register.tsx:37); recolhido some o ramo, nunca o dado.
- REQ-114 Legenda: ● Concluído  -- Concluído · aguarda filhos  ● Executando  ● Atenção  ● Pendente  ● Inativo  ✗ Falha  ⧉ Worktree; "Níveis de profundidade: N/10" no Mapa e na Árvore.
- REQ-115 (ASK-2) Cabeçalho "Office Agent Monitor": esquerda "Claude Code · Projeto · Sessão #id"; direita "Progresso Geral N% [barra]", "Decorrido", "Estimativa". Hoje: compact.ts:189-225 (Office · proj · branch, contagens, ETA, tokens/custo).
Dados já existem: overallProgress, elapsedOf, etaOf (run-model).

---
status: TODO
progress: 0/5
updated: 2026-11-15
---
# Spec 02 — Card compacto, recolher, legenda, cabeçalho

- REQ-111 (ASK-1/ASK-4 DECIDIDO) Card de 5-6 linhas, mais enxuto que os 7+ de hoje, MANTENDO pill, papel (orquestrador/agente/subagente), custo, branch/worktree, barra, tempo e título em até 2 linhas. Enxugar só o redundante: a linha de status repete o que o pill e a barra já dizem (ex.: "concluído") e some quando vazia; chips sem linha extra (REQ-006); título de 1 linha ocupa 1 linha. Glifo + cor de borda por estado são acréscimo, não substituem o pill (office-map-mock-style NÃO é superado).
- REQ-112 Borda: sólida azul = rodando; sólida verde = concluído; tracejada = "Concluído · aguarda filhos" (done com descendente rodando, hasRunningDescendant); vermelha falha; amarela atenção.
- REQ-113 (ASK-3 DECIDIDO) ▾/▸ por card e barra "Ramos: [− Nome]" no Mapa do terminal e do app; estado compartilhado com a Árvore via collapsedAt (register.tsx:37); recolhido some o ramo, nunca o dado.
- REQ-114 Legenda: ● Concluído  -- Concluído · aguarda filhos  ● Executando  ● Atenção  ● Pendente  ● Inativo  ✗ Falha  ⧉ Worktree; "Níveis de profundidade: N/10" no Mapa e na Árvore.
- REQ-115 (ASK-2 DECIDIDO: ESTENDER) Cabeçalho: mantém projeto, branch, tokens e custo e acrescenta "Progresso Geral N% [barra]", "Decorrido" e "Estimativa" (alvo: imagens do monitor). Hoje: compact.ts:189-225 (Office · proj · branch, contagens, ETA, tokens/custo).
Dados já existem: overallProgress, elapsedOf, etaOf (run-model).

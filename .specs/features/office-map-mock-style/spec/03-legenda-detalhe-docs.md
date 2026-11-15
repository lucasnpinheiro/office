---
status: TODO
progress: 0/3
updated: 2026-11-15
---
# Spec 03 — Legenda, detalhe, docs

- REQ-009 (D6) Legenda de teclas sem palavra cortada ("mod", "visã", "fecha", "subi"): quebra por item inteiro (footerRows, actions.ts:91-125) e rótulos completos "j: desce", "k: sobe" no Mapa e no detalhe (hoje "j: descer/rolar ↓", órfãos sem rótulo na imagem 11). Mapa lista j/k desce/sobe.
- REQ-010 (D7) Detalhe (view-detail.ts, register.tsx:880-890): cabeçalho com um só "← voltar" (sem "[ [← voltar] ]" e sem "b voltar" duplicado); custo exibido ("~$ —" só sem dado); sem linha "_" sob o progresso; prompt quebra em palavra inteira (promptSummary), nunca no meio; "Irmãos i/n:" numa linha com rótulo antes da lista (view-detail.ts:166-172), itens separados por espaço (sem "calculadora✓ Testes"); p/n em linha própria depois do rótulo; j/k sempre com rótulo.
- REQ-011 Versão 0.28.14 (plugin.json, README), nota "supersedes" em office-org-tree-2d/spec.md e office-app-dynamic-cards/spec.md.

Não verificado: causa exata de "_" e do custo "—" (ler view-detail.ts/detailData ao implementar; teste RED primeiro).

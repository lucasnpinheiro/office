---
type: unit
status: TODO
progress: 0/27
updated: 2026-11-15
covers: [REQ-001, REQ-002, REQ-003, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010]
contract: test-flow/1
---
# Tests — unit — office-map-mock-style

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| U-001 | Success | 7 filhos da raiz/terminal; linhas [6,1]; 7º abre linha 2 | REQ-001 | compact.ts | no | - | TODO |
| U-002 | Success | filho de filho com 8 netos; neto também [6,2], mesma regra | REQ-001 | compact.ts | no | - | TODO |
| U-003 | Deviation | 0 e 1 filho: sem barramento duplo; 1 = queda reta | REQ-001 | compact.ts | no | - | TODO |
| U-004 | Success | cols=min(6,n,floor((avail+g)/(18+g))); w entre 18 e 34 | REQ-002 | compact.ts | no | - | TODO |
| U-005 | Error | avail<18: cols=1, w=18, nada truncado, sem scroll horizontal | REQ-002 | compact.ts | no | - | TODO |
| U-006 | Success | cadeia de 12 níveis: 10 desenhados, nível 10 mostra +N ocultos | REQ-003 | compact.ts | no | - | TODO |
| U-007 | Deviation | modelo guarda todos os nós; detalhe do nó oculto abre | REQ-003 | app-cards.ts | no | - | TODO |
| U-008 | Success | neto sob o pai: x do conector = centro do pai, sem tronco lateral | REQ-004 | compact.ts | no | - | TODO |
| U-009 | Success | appMap: sem layout column; filhos de nível 2 em rows de 6 | REQ-001 | app-cards.ts | no | - | TODO |
| U-010 | Success | APP_CARD_MIN=18; appCardW(9,60)=18 | REQ-002 | app-cards.ts | no | - | TODO |
| U-011 | Error | appPerRow(30,18)=1 | REQ-002 | app-cards.ts | no | - | TODO |
| U-012 | Success | appMap nível 10: marcador +N ocultos | REQ-003 | app-cards.ts | no | - | TODO |
| U-013 | Success | scroll j: +3 linhas; k: -3; clamp 0 e último | REQ-005 | register.tsx | no | - | TODO |
| U-014 | Success | indicador ↓ mais no topo, ↑ mais no fim, nenhum quando cabe | REQ-005 | compact.ts | no | - | TODO |
| U-015 | Deviation | resize 120→60: measure refeito, mesmos nós e arestas | REQ-005 | compact.ts | no | - | TODO |
| U-016 | Success | chip '🟢 baixo' nunca separado em 34/26/18 colunas | REQ-006 | compact.ts | no | - | TODO |
| U-017 | Deviation | persona longa: quebra só entre chips | REQ-006 | compact.ts | no | - | TODO |
| U-018 | Success | pill presente em todos os 6 estados e título longo (…) | REQ-007 | compact.ts | no | - | TODO |
| U-019 | Success | título sem prefixo ✓; pill Concluído | REQ-007 | compact.ts | no | - | TODO |
| U-020 | Error | trilha longa corta por item com …; sem aspa solta | REQ-008 | compact.ts | no | - | TODO |
| U-021 | Success | legenda 60 cols: nenhuma palavra cortada | REQ-009 | actions.ts | no | - | TODO |
| U-022 | Success | j: desce / k: sobe presentes no Mapa e detalhe | REQ-009 | actions.ts | no | - | TODO |
| U-023 | Success | detalhe: um só ← voltar, sem [ [ e sem 'b voltar' | REQ-010 | view-detail.ts | no | - | TODO |
| U-024 | Success | custo mostrado; '~$ —' só sem usage | REQ-010 | view-detail.ts | no | - | TODO |
| U-025 | Success | sem linha '_'; prompt quebra em palavra inteira | REQ-010 | view-detail.ts | no | - | TODO |
| U-026 | Success | Irmãos i/n: rótulo antes dos itens, itens com espaço | REQ-010 | view-detail.ts | no | - | TODO |
| U-027 | Success | 500 nós: measure < 50 ms (memo) | REQ-002 | compact.ts | no | - | TODO |

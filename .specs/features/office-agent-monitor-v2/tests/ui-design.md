---
type: ui-design
status: TODO
progress: 0/24
updated: 2026-11-05
covers: [AC-015..AC-046]
contract: test-flow/1
---
# Testes — telas — office-agent-monitor-v2

Viewports do canvas: 1280, 768, 390. Os 375 e 1920 do modelo não se aplicam. Fontes de prova: terminal em sessão real, app pelo próprio app. Uma linha sem execução fica `not verified`, nunca PASS. Console do navegador: not applicable.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| UI-001 | Success | Terminal, sessão real, 100 e 60 colunas: Árvore conforme Term5 | AC-018 | smoke | no | - | TODO |
| UI-002 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Árvore legível | AC-015 | smoke | no | - | TODO |
| UI-003 | Success | App Claude 1280, 768, 390: Árvore conforme Responsive5. Não verificado até ser executado | AC-018, AC-043 | smoke | no | - | TODO |
| UI-004 | Success | Terminal, sessão real, 100 e 60 colunas: Worktrees conforme Term5 | AC-021 | smoke | no | - | TODO |
| UI-005 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Worktrees legível | AC-015 | smoke | no | - | TODO |
| UI-006 | Success | App Claude 1280, 768, 390: Worktrees conforme Responsive5. Não verificado até ser executado | AC-021, AC-043 | smoke | no | - | TODO |
| UI-007 | Success | Terminal, sessão real, 100 e 60 colunas: Workflow conforme Term5 | AC-024 | smoke | no | - | TODO |
| UI-008 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Workflow legível | AC-015 | smoke | no | - | TODO |
| UI-009 | Success | App Claude 1280, 768, 390: Workflow conforme Responsive5. Não verificado até ser executado | AC-024, AC-043 | smoke | no | - | TODO |
| UI-010 | Success | Terminal, sessão real, 100 e 60 colunas: Custo conforme Term5 | AC-031 | smoke | no | - | TODO |
| UI-011 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Custo legível | AC-015 | smoke | no | - | TODO |
| UI-012 | Success | App Claude 1280, 768, 390: Custo conforme Responsive5. Não verificado até ser executado | AC-031, AC-043 | smoke | no | - | TODO |
| UI-013 | Success | Terminal, sessão real, 100 e 60 colunas: Ferramentas conforme Term5 | AC-033 | smoke | no | - | TODO |
| UI-014 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Ferramentas legível | AC-015 | smoke | no | - | TODO |
| UI-015 | Success | App Claude 1280, 768, 390: Ferramentas conforme Responsive5. Não verificado até ser executado | AC-033, AC-043 | smoke | no | - | TODO |
| UI-016 | Success | Terminal, sessão real, 100 e 60 colunas: Decisões conforme Term5 | AC-034 | smoke | no | - | TODO |
| UI-017 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Decisões legível | AC-015 | smoke | no | - | TODO |
| UI-018 | Success | App Claude 1280, 768, 390: Decisões conforme Responsive5. Não verificado até ser executado | AC-034, AC-043 | smoke | no | - | TODO |
| UI-019 | Success | Terminal, sessão real, 100 e 60 colunas: Detalhe conforme Term5 | AC-027 | smoke | no | - | TODO |
| UI-020 | Deviation | Terminal `OFFICE_ASCII=1` e `NO_COLOR`: Detalhe legível | AC-015 | smoke | no | - | TODO |
| UI-021 | Success | App Claude 1280, 768, 390: Detalhe conforme Responsive5. Não verificado até ser executado | AC-027, AC-043 | smoke | no | - | TODO |
| UI-022 | Deviation | Movimento reduzido em terminal: nada se move | AC-046 | smoke | no | - | TODO |
| UI-023 | Error | Tela vazia em cada visão | AC-020 | smoke | no | - | TODO |
| UI-024 | Deviation | Controle sem capacidade não aparece nas duas superfícies | AC-041 | smoke | no | - | TODO |

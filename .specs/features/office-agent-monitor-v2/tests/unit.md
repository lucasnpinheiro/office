---
type: unit
status: TODO
progress: 0/22
updated: 2026-11-05
covers: [AC-004..AC-047]
contract: test-flow/1
---
# Testes — unidade — office-agent-monitor-v2

Funções puras, `claude plugin test .`, import de `claude-code/testing`. Limites em tabela de casos.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| U-001 | Success | `buildRunModel` é determinístico para a mesma entrada | AC-004 | unit | no | - | TODO |
| U-002 | Deviation | Pai ausente vira raiz | AC-005 | unit | no | - | TODO |
| U-003 | Error | Horário inválido dá tempo indefinido | AC-006 | unit | no | - | TODO |
| U-004 | Success | Passos em ordem de início com chamadas paralelas | AC-007 | unit | no | - | TODO |
| U-005 | Deviation | Limite 200: 201º passo descarta o primeiro e incrementa `droppedSteps` | AC-007 | unit | no | - | TODO |
| U-006 | Deviation | `Usage` vazio permanece `undefined` | AC-008 | unit | no | - | TODO |
| U-007 | Success | Máscara: um caso por padrão de `spec/04-contracts.md` | AC-010 | unit | no | - | TODO |
| U-008 | Error | Máscara com exceção devolve o marcador | AC-012 | unit | no | - | TODO |
| U-009 | Success | Mascara antes de truncar: segredo no limite não vaza partes | AC-013 | unit | no | - | TODO |
| U-010 | Success | Todo `RunState` tem rótulo, cor, glifo e ASCII | AC-014 | unit | no | - | TODO |
| U-011 | Deviation | Modo ASCII não tem caractere fora de ASCII | AC-015 | unit | no | - | TODO |
| U-012 | Error | Estado desconhecido usa `?` | AC-016 | unit | no | - | TODO |
| U-013 | Success | `KEY_MAP` sem letra repetida no mesmo contexto | AC-017 | unit | no | - | TODO |
| U-014 | Deviation | Colapso em 8 e 9 irmãos iguais | AC-019 | unit | no | - | TODO |
| U-015 | Deviation | ETA com 0, 2 e 3 amostras do mesmo modelo, e 3 de modelos diferentes | AC-030 | unit | no | - | TODO |
| U-016 | Deviation | Barra só com total conhecido; nunca `%` | AC-028 | unit | no | - | TODO |
| U-017 | Deviation | Total parcial com um desconhecido | AC-032 | unit | no | - | TODO |
| U-018 | Error | Nenhum dado dá `—`, nunca `~$0,00` | AC-033 | unit | no | - | TODO |
| U-019 | Success | Limites de largura: 59, 60, 99, 100 colunas; 519, 520, 779, 780, 1039, 1040 px | AC-042 | unit | no | - | TODO |
| U-020 | Deviation | Limites de detalhe: 899 e 900 px | AC-043 | unit | no | - | TODO |
| U-021 | Deviation | Quadro: reduzido dá 1000 ms; padrão, cerca de 166 ms | AC-046 | unit | no | - | TODO |
| U-022 | Success | Redutor de confirmação: `confirm`, `sending`, `error` | AC-038, AC-039 | unit | no | - | TODO |

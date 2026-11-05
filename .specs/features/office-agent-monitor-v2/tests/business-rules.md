---
type: business-rules
status: TODO
progress: 0/9
updated: 2026-11-05
covers: [AC-014..AC-041]
contract: test-flow/1
---
# Testes — regras — office-agent-monitor-v2

Transições de `flows.md` FLOW-004 e honestidade dos números.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| R-001 | Success | Toda transição legal de FLOW-004 | AC-014 | unit | no | - | TODO |
| R-002 | Error | Transição ilegal, como `done` para `paused`, é rejeitada | AC-016 | unit | no | - | TODO |
| R-003 | Deviation | Pausar sem capacidade nunca gera `paused` | AC-041 | unit | no | - | TODO |
| R-004 | Deviation | Estado só muda após resposta do engine | AC-038 | integration | no | - | TODO |
| R-005 | Error | Falha mantém estado anterior | AC-040 | integration | no | - | TODO |
| R-006 | Deviation | Recusar mantém `running` e não vira `stopped` | AC-037 | integration | no | - | TODO |
| R-007 | Success | Duas decisões em fila, respostas por `tool_use_id` | AC-034 | integration | no | - | TODO |
| R-008 | Deviation | Agente termina durante `sending`: mostra estado real | AC-038 | integration | no | - | TODO |
| R-009 | Deviation | `stalled` volta a `running` com nova atividade | AC-014 | unit | no | - | TODO |

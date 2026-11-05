---
type: validation
status: TODO
progress: 0/5
updated: 2026-11-05
covers: [AC-011..AC-044]
contract: test-flow/1
---
# Testes — validação — office-agent-monitor-v2

Entradas de ambiente, largura e dados de evento.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| V-001 | Success | `OFFICE_CAPTURE_IO=1` liga | AC-013 | unit | no | - | TODO |
| V-002 | Deviation | Valores `0`, `true`, ` 1`, vazio: não ligam | AC-011 | unit | no | - | TODO |
| V-003 | Error | Largura 0, negativa, `NaN`: uma coluna | AC-044 | unit | no | - | TODO |
| V-004 | Error | Input do Workflow sem `name`, com `phases` inválido: lista simples | AC-026 | unit | no | - | TODO |
| V-005 | Deviation | `tool_use_id` desconhecido na resposta: ignorado | AC-035 | unit | no | - | TODO |

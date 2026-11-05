---
type: security
status: TODO
progress: 0/10
updated: 2026-11-05
covers: [AC-009..AC-038]
contract: test-flow/1
---
# Testes — segurança — office-agent-monitor-v2

Linhas `@security`. Injeção SQL, XSS, CSRF, IDOR: not applicable — sem banco, sem HTML próprio e sem HTTP.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| SEC-001 | Success | Cada padrão de segredo mascarado em prompt, rótulo e I/O, antes do estado | AC-010, AC-013 | unit | no | - | TODO |
| SEC-002 | Error | Máscara falha fechada | AC-012 | unit | no | - | TODO |
| SEC-003 | Deviation | Sem opt-in, estado não tem campo `io` | AC-011 | integration | no | - | TODO |
| SEC-004 | Error | Teste com `$.fs` e rede espiões: nenhuma chamada de escrita ou rede | AC-009, AC-013 | integration | no | - | TODO |
| SEC-005 | Success | `drawSig` e cópia `y` só veem texto mascarado | AC-010 | unit | no | - | TODO |
| SEC-006 | Success | Allow vale só para aquele `tool_use_id`, sem regra permanente | AC-034 | integration | no | - | TODO |
| SEC-007 | Error | Nunca há resposta sem ação da pessoa; `ceiling` respeitado | AC-034, AC-035 | integration | no | - | TODO |
| SEC-008 | Error | Nome de branch com caracteres especiais vai em argv, sem shell | AC-023 | unit | no | - | TODO |
| SEC-009 | Error | Sequências de controle em descrição e rótulo são removidas ao desenhar | AC-016 | unit | no | - | TODO |
| SEC-010 | Deviation | Retry não reenvia prompt mascarado | AC-038 | integration | no | - | TODO |

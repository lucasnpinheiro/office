---
type: e2e-flow
status: TODO
progress: 0/9
updated: 2026-11-05
covers: [AC-001..AC-038]
contract: test-flow/1
---
# Testes — fluxos em sessão real — office-agent-monitor-v2

Sessão real do Claude com o plugin. Agentes descartáveis. App: não verificado até ser executado.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Flow | Status |
|---|---|---|---|---|---|---|---|---|
| F-001 | Success | Rodar o spike em terminal e registrar cada veredito na ADR | AC-001, AC-002 | e2e | yes | Remover a mod temporária e encerrar os subagentes | FLOW-001 | TODO |
| F-002 | Error | Rodar o spike no app Claude ou registrar `not-verified` | AC-003 | e2e | yes | Remover a mod temporária | FLOW-001 | TODO |
| F-003 | Success | Orquestrador com filhos: seguir a árvore até o fim | AC-018 | e2e | no | - | FLOW-001 | TODO |
| F-004 | Success | Dois agentes em worktrees aparecem nos grupos certos | AC-021, AC-022 | e2e | yes | `git worktree remove` sem force; branch fica | FLOW-002 | TODO |
| F-005 | Success | Workflow salvo roda e aparece com fases, se T-001 provar o evento | AC-024 | e2e | yes | Encerrar o workflow | FLOW-003 | TODO |
| F-006 | Success | Pedido de permissão: permitir pelo painel | AC-034 | e2e | yes | Reverter arquivo de teste | FLOW-006 | TODO |
| F-007 | Deviation | Responder no diálogo nativo limpa a pendência | AC-035 | e2e | no | - | FLOW-006 | TODO |
| F-008 | Success | Parar agente descartável com confirmação | AC-038 | e2e | yes | Encerrar subagente | FLOW-005 | TODO |
| F-009 | Deviation | Ciclo de vida percorre `queued`, `running` e `done` | AC-027 | e2e | no | - | FLOW-004 | TODO |

---
type: e2e-regression
status: TODO
progress: 0/7
updated: 2026-11-05
covers: [AC-004..AC-048]
contract: test-flow/1
---
# Testes — regressão — office-agent-monitor-v2

Fluxos existentes tocados. Valem na base antes de codar; hoje cobertos por 147 testes.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| ER-001 | Success | `/office` abre e fecha, e `ctrl+x tab` foca (`command.test.ts`) | AC-004 | smoke | no | - | TODO |
| ER-002 | Success | Modo `map` e `v` seguem funcionando (`actions.test.ts`) | AC-004 | integration | no | - | TODO |
| ER-003 | Success | Agente em worktree reconhecido (`worktree.test.ts`) | AC-021 | integration | no | - | TODO |
| ER-004 | Success | `isQuotaError` com `HTTP/1.1 429` (`review.test.ts:33`) | AC-014 | unit | no | - | TODO |
| ER-005 | Success | Largura de emoji (`review.test.ts:38`) | AC-042 | unit | no | - | TODO |
| ER-006 | Success | Limite de 60 agentes (`register.tsx:338`) | AC-005 | integration | no | - | TODO |
| ER-007 | Success | Instalação do plugin segue igual, e `docs/privacy.md` das outras partes não muda | AC-048 | smoke | no | - | TODO |

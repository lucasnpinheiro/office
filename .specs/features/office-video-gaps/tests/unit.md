---
type: unit
status: DONE
progress: 5/5
updated: 2026-11-17
covers: [REQ-401, REQ-402, REQ-403]
contract: test-flow/1
---
# Tests — unit — office-video-gaps

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| U-401 | Success | agente na metade do run: coluna agora tem │ em todas as linhas | REQ-401 | compact.ts | no | - | DONE |
| U-402 | Success | rótulo agora alinhado à coluna sob o eixo | REQ-401 | compact.ts | no | - | DONE |
| U-403 | Success | 2 agentes: o de maior fim leva ◂ fim | REQ-402 | compact.ts | no | - | DONE |
| U-404 | Deviation | 1 agente só: sem marca ◂ fim | REQ-402 | compact.ts | no | - | DONE |
| U-405 | Success | pendente mostra aguarda 1ª ação… sem barra | REQ-403 | compact.ts | no | - | DONE |

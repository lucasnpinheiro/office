---
type: unit
status: TODO
progress: 0/6
updated: 2026-11-16
covers: [REQ-201, REQ-202, REQ-203]
contract: test-flow/1
---
# Tests — unit — office-header-usage-limits

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| U-201 | Success | usage() com limites: probe expõe campos; sem campo: nada muda | REQ-201 | register.tsx | no | - | TODO |
| U-202 | Success | usageLimits: 4% e reset em 4h vira '5h 4% · reinicia em 4h' | REQ-202 | run-model.ts | no | - | TODO |
| U-203 | Success | semanal 12% reset 2d vira 'Semana 12% · reinicia em 2d' | REQ-202 | run-model.ts | no | - | TODO |
| U-204 | Success | campo por modelo presente renderiza 'Semana <modelo>' | REQ-202 | run-model.ts | no | - | TODO |
| U-205 | Error | NaN, negativo ou >100 omite o segmento | REQ-203 | run-model.ts | no | - | TODO |
| U-206 | Deviation | sem dado: header igual ao atual (snapshot) | REQ-203 | compact.ts | no | - | TODO |

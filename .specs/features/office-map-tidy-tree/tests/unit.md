---
type: unit
status: TODO
progress: 0/22
updated: 2026-11-15
covers: [REQ-101, REQ-102, REQ-103, REQ-104, REQ-111, REQ-112, REQ-113, REQ-114, REQ-115]
contract: test-flow/1
---
# Tests — unit — office-map-tidy-tree

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| U-101 | Success | raiz->3 filhos; A com 3 netos, B e C com 1: pai centrado sobre seus filhos | REQ-101 | compact.ts | no | - | TODO |
| U-102 | Success | 1 filho: queda reta, mesma coluna do pai | REQ-101 | compact.ts | no | - | TODO |
| U-103 | Success | netos na mesma linha, agrupados por pai, sem sobrepor | REQ-101 | compact.ts | no | - | TODO |
| U-104 | Success | barramento cobre do 1º ao último filho, não o pai | REQ-102 | compact.ts | no | - | TODO |
| U-105 | Success | • em cada queda; ascii usa o | REQ-103 | compact.ts | no | - | TODO |
| U-106 | Deviation | 8 filhos: linha 1 de 6 e linha 2 sob o mesmo pai, barramento por linha | REQ-103 | compact.ts | no | - | TODO |
| U-107 | Error | avail<18: 1 por linha, sem corte, sem scroll horizontal | REQ-104 | compact.ts | no | - | TODO |
| U-108 | Success | rodando: borda azul sólida, glifo ● | REQ-112 | compact.ts | no | - | TODO |
| U-109 | Success | concluído sem filhos rodando: borda verde sólida | REQ-112 | compact.ts | no | - | TODO |
| U-110 | Success | concluído com descendente rodando: borda tracejada | REQ-112 | compact.ts | no | - | TODO |
| U-111 | Success | falha vermelha, atenção amarela | REQ-112 | compact.ts | no | - | TODO |
| U-112 | Success | card compacto: L1..L4 conforme resposta ASK-1/4, título com … | REQ-111 | compact.ts | no | - | TODO |
| U-113 | Success | rodando mostra trilha ▸ a ‹ b ‹ c | REQ-111 | compact.ts | no | - | TODO |
| U-114 | Success | recolher pai oculta ramo; modelo intacto; ▾ vira ▸ | REQ-113 | monitor.ts | no | - | TODO |
| U-115 | Success | barra Ramos lista só pais com filhos; − expandido | REQ-113 | compact.ts | no | - | TODO |
| U-116 | Deviation | recolher e expandir tudo preserva estado entre Mapa e Árvore | REQ-113 | register.tsx | no | - | TODO |
| U-117 | Success | legenda tem 8 itens incluindo Inativo, aguarda filhos, ⧉ | REQ-114 | compact.ts | no | - | TODO |
| U-118 | Success | Níveis de profundidade N/10 no Mapa e na Árvore | REQ-114 | compact.ts | no | - | TODO |
| U-119 | Success | cabeçalho: Progresso Geral %, Decorrido, Estimativa (ASK-2) | REQ-115 | compact.ts | no | - | TODO |
| U-120 | Deviation | sem agentes: sem barra, sem NaN | REQ-115 | compact.ts | no | - | TODO |
| U-121 | Success | cabeçalho em 60 colunas não corta palavra | REQ-115 | compact.ts | no | - | TODO |
| U-122 | Success | 500 nós: measure < 50 ms | REQ-104 | compact.ts | no | - | TODO |

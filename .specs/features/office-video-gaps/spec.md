---
status: TODO
progress: 0/4
updated: 2026-11-17
---
# office-video-gaps (agent-office, base main + PR #98 0.28.23)

Pedido 2026-11-17: vídeo ~/Movies/agent-office-demo.mp4 (5m09s, 14 capítulos) x CLI e desktop. Sucede office-video-parity (0.28.18), que fechou abas, map/cards, agrupado e pílula.
Frames: 62 (1 a cada 5 s), lidos em contact sheets 4x4.

## Delta real
| Vídeo | Terminal | Desktop | Falta |
|---|---|---|---|
| Waterfall: linha vertical "agora" | só eixo 0s..Ns (compact.ts:727) | idem (texto) | REQ-401 |
| Waterfall: destaque "segura o fim" | ausente | ausente | REQ-402 |
| Waterfall: "aguarda 1ª ação…" na linha pendente | só nos cards (compact.ts:533) | idem | REQ-403 |
| Desktop: captura real Mapa/Waterfall/detalhe 110 col | - | README: "Not verified in the Claude app" | REQ-404 |
| Demais 13 telas (header, limites, estados, 429, 30 s, cards v/g/o/f/s, agrupado, custo parcial, ferramentas, detalhe, máscara, comandos, larguras) | ok | ok | nada |

## Requisitos
- REQ-401 Waterfall desenha marcador vertical "agora" na coluna do instante atual, com rótulo `agora` sob o eixo.
- REQ-402 O agente com o maior fim (ou rodando com maior início+duração) recebe marca "segura o fim" (glifo + cor de atenção, não só cor).
- REQ-403 Linha de agente pendente mostra `aguarda 1ª ação…` em DIM no lugar da barra.
- REQ-404 README do plugin: substituir SVG esquemático por captura real do desktop; sem captura = marcar UNVERIFIED.
Fora de escopo: versão gráfica de Agrupado/Custo/Ferramentas no desktop (decidido em office-video-parity: YAGNI, vídeo não distingue superfície).

Índice: spec/01-tech.md · tasks/README.md · tests.md · acceptance/waterfall.feature
Não verificado: áudio; telas entre frames de 5 s.

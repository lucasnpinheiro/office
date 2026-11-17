---
status: TODO
progress: 0/5
updated: 2026-11-17
---
# office-video-parity (agent-office, base main 0.28.17)

Pedido (2026-11-17): analisar ~/Movies/agent-office-demo.mp4 (5m09s, 14 capítulos, legendas pt-BR) e validar o que falta no terminal (CLI) e no app desktop. Áudio não transcrito (sem whisper); inventário pelas legendas queimadas nos frames.

## Delta real vs main 0.28.17
| Vídeo | Terminal | Desktop | Falta |
|---|---|---|---|
| 8 abas mapa·tree·grouped·cards·waterfall·cost·tools·workflow | 5-6 abas, sem waterfall/cards; Workflow só se houver (compact.ts:232) | 6 abas, sem cards/waterfall (register.tsx:814) | REQ-301 |
| Mapa (árvore c/ barramento) ≠ Cards (grade) | modo cards = mapa; sem grade (compact.ts:78,734) | ok: appMap e appGrid (register.tsx:853,869) | REQ-302 |
| Agrupado por estado sem worktree; por worktree c/ commits | só worktree (compact.ts:354); ×N só >8 irmãos (compact.ts:91) | texto do terminal | REQ-303 |
| Pílula "Atenção" (rate limit) | "Aguarda você" (compact.ts:440) | idem | REQ-304 (ASK-1) |
| Demais telas: header, limites, custo parcial, ferramentas, detalhe, máscara, p/n, comandos, larguras 150/110, 30 s | ok | ok (modos ≠ mapa/cards em texto, register.tsx:851) | nada |

## Requisitos
- REQ-301 Barra de abas igual nas duas superfícies, na ordem do vídeo; waterfall e cards clicáveis; workflow sempre listado (esmaecido sem workflow).
- REQ-302 Terminal: modo `map` (árvore com barramento, default) separado de `cards` (grade por largura); `g` cicla 8 modos; `/office mode map|cards` aceitos.
- REQ-303 Agrupado: sem worktrees = divisores por estado (Rodando ×N, Concluído ×N, Falhou ×N, Na fila ×N); com worktrees = comportamento atual.
- REQ-304 Rótulo da pílula de atenção conforme ASK-1.
- REQ-305 README + versão 0.28.18.
Fora de escopo: redesenho gráfico dos modos texto no desktop (YAGNI; vídeo não distingue superfície).
Índice: tasks/README.md · tests.md · acceptance/video-parity.feature
Não verificado: áudio; frames a cada 8 s (pode haver tela não capturada).

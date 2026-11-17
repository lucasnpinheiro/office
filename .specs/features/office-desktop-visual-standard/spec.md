---
status: READY
progress: 0/4
updated: 2026-11-17
---
# office-desktop-visual-standard (agent-office, base main e41382e)

Pedido 2026-11-17: vídeo ~/Movies/agent-office-demo.mp4 + 12 prints do desktop (Office Agent Monitor). Prior-Art Gate: office-video-gaps (mesmo vídeo, mesmo dia) já cobre o delta do vídeo (REQ-401..404, pendentes); este bundle NÃO repete o vídeo, só o desvio visual do desktop. Executar junto com T-401..T-404.

## Delta real (vídeo x CLI x desktop)
| Item | Vídeo | CLI | Desktop | Falta |
|---|---|---|---|---|
| Waterfall "agora" / "segura o fim" / "aguarda 1ª ação" | 0:40-1:20 cap. waterfall | ausente | ausente | office-video-gaps REQ-401..403 |
| Captura real desktop no README | - | - | SVG | REQ-404 |
| Um só visual em todas as abas | header colorido + custo + pílulas (cap. 03) | ok (compact.ts) | 2 visuais: Mapa/Cards = appChrome (register.tsx:821, texto puro, sem custo, "0 falha"); demais abas = compactFrame ANSI (register.tsx:660) | REQ-501 |
| Réguas horizontais vazias / área vazia | não | - | Waterfall/Workflow/Custo sem agentes: 2 réguas sem conteúdo | REQ-502 |
| Rodapé de atalhos igual em toda aba | 1 linha fixa | ok | varia por aba (omite F/S, quebra "| Tab entre cards") | REQ-503 |
| Detalhe: linhas ANDAMENTO | `▸ Edit  arquivo` | ok | `Skill Skill`, `Bash -d`, `Bash cat` (rótulo duplicado, arg cortado) | REQ-504 |
| Demais telas (mapa, cartão, estados, cabeçalho, limites) | - | ok | ok | nada |

Causa raiz REQ-501: register.tsx:856 (`onApp && view==='map'`) e :876 (`mode in map,cards`) desenham chrome gráfico próprio; outros modos caem no compactFrame com header/abas ANSI. Duas fontes de cabeçalho/abas/rodapé.

## Requisitos
- REQ-501 Superfícies app (desktop/vscode/mobile): uma única fonte de header, contadores e abas para TODOS os modos e estados (vazio, rodando, detalhe). Header = `Office · repo · ⎇ branch · #sha · ~$custo`; contadores coloridos com plural via mesma função do compact.ts:214 ("0 falhas"); aba ativa destacada igual em todas.
- REQ-502 Sem agentes, todo modo mostra só `Aguardando agentes… use o Claude normalmente` + legenda; nunca régua sem conteúdo entre elas.
- REQ-503 Rodapé de atalhos vem de footerRows (register.tsx:697) idêntico em todas as abas; quebra de linha só por largura, nunca separador `|` no fim/início de linha.
- REQ-504 Linha de ferramenta no detalhe: `▸ <Ferramenta> <alvo>`; rótulo não repete o nome; alvo = description/arquivo/skill, nunca flag solta (`-d`).
Fora de escopo: redesign do mapa gráfico (Chips) — mantido.

Índice: tasks/README.md · tests.md · acceptance/desktop-visual.feature
Não verificado: telas entre frames de 20 s; vscode/mobile.

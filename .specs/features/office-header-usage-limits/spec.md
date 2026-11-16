---
status: TODO
progress: 0/6
updated: 2026-11-16
---
# office-header-usage-limits (agent-office, base main 0.28.16)

Pedido (2026-11-16, 3 imagens + artifact Claude Design): incluir no header tempo decorrido da sessão e quanto falta para estourar a sessão de 5 h e a semanal (modelo: menu "PLAN USAGE LIMITS"); atualizar o layout do Claude Design com os últimos ajustes; atualizar README.md.

## Delta real vs main 0.28.16
| Alvo | Já existe | Falta |
|---|---|---|
| Tempo decorrido | elapsedOf (run-model.ts:158) desde o 1º agente; header compact.ts:210 (HMS), register.tsx:825 (MM:SS) | nada (ASK-1: manter) |
| Limites 5 h / semanal / Weekly por modelo | nada: grep rate_limits/five_hour/resets_at = 0; engine só lido em cost.usd (register.tsx:200-208) | probe do shape de $.session.usage(), render condicional |
| Design Claude Design | 51 arquivos, artboards .dc.html (Main, Proto5, Grafo6, Term*, AppCards...) | refletir tidy-tree, linha do pai pela folga central, header de limites |
| README | README.md linha ~35 fala ETA/header | seção de limites + imagens |

## Decisões do usuário (ASK-1, 2026-11-16: "1º agente + engine")
- Decorrido mantém a definição atual (desde o 1º agente).
- Limites 5 h / semanal (+ Weekly por modelo se vier) SÓ se $.session.usage() expuser; ausente = oculto, nunca inventar, nunca zero.

## Requisitos
- REQ-201 Probe: T-201 registra o shape real de $.session.usage() (campos de limite, % usado, reset). NÃO VERIFICADO até rodar no engine.
- REQ-202 Header (terminal compact.ts:208-213 e app register.tsx:812-826): "5h N% · reinicia em Xh Ym" e "Semana N% · reinicia em Xd Yh" (+ "Semana <modelo>" se vier), após o decorrido; tempo restante = reset - agora.
- REQ-203 Dado ausente/NaN/fora de 0..100: segmento omitido; header idêntico ao atual; sem erro; largura 60 não corta palavra.
- REQ-204 Atualizar artboards do Claude Design (URL do pedido) com tidy tree, linha do pai pela folga central e header de limites (via Artifact publish, só em project/).
- REQ-205 README.md do plugin + versão 0.28.17 + imagens.
Índice: tasks/README.md · tests.md · acceptance/usage-limits.feature
Não verificado: fonte dos limites no engine; OpenSpec CLI ausente (sem openspec/ no repo).

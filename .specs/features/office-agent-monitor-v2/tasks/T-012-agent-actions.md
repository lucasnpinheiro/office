---
id: T-012
title: Ações: Pause, Stop, Retry e open-in-chat
type: frontend
status: TODO
progress: 0/4
updated: 2026-11-05
depends_on: [T-001, T-009, T-011]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-012]
estimate: L
skills: []
executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
risk: concurrency
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-012 — Ações: Pause, Stop, Retry e open-in-chat

Executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
Risk: concurrency

## Objetivo
Oferecer cada ação com suporte provado, confirmação na própria linha e resultado vindo do engine.

Fora: Ações em lote.

## Critérios de aceite
- [ ] AC-038 — WHEN o usuário confirmar uma ação suportada, the system SHALL mostrar `Enviando…` e só mudar o estado do card quando o engine responder. Cenário: S-038 @success.
- [ ] AC-039 — WHILE a confirmação estiver aberta, the system SHALL interpretar `y` e `n` como resposta, e `n` SHALL cancelar sem chamar o engine. Cenário: S-039 @deviation.
- [ ] AC-040 — IF o engine recusar ou falhar, the system SHALL mostrar a mensagem no card e manter o estado anterior. Cenário: S-040 @error.
- [ ] AC-041 — WHERE `CAPABILITIES` for falso para uma ação, the system SHALL não desenhar botão nem tecla dessa ação em nenhuma superfície. Cenário: S-041 @deviation.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-038 a AC-041) · cenários: `acceptance/actions.feature` tag `@T-012` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [ ] Branch dedicada, nunca `main`
- [ ] Teste RED antes do GREEN
- [ ] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 147
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes
- [ ] Julgada por subagente diferente do implementador

## Evidência
Preencher ao concluir: comando, exit code e data. DONE sem evidência é inválido.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/agent-actions.ts`, `plugins/agent-office/hooks/agent-actions.test.ts`.
`actions.ts` hoje é só redutor de UI. Retry precisa do prompt original: ver Unresolved 1. Tecla de pausa proposta: `u`.

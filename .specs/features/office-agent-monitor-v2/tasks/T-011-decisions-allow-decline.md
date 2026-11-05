---
id: T-011
title: Decisões: Precisa de você, Allow e Decline
type: frontend
status: TODO
progress: 0/4
updated: 2026-11-05
depends_on: [T-001, T-004, T-006, T-009]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-011]
estimate: L
skills: []
executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
risk: auth, concurrency
judge: 🛡️ AppSec · 🪶 Haiku · 🟢 baixo
---
# T-011 — Decisões: Precisa de você, Allow e Decline

Executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
Judge: 🛡️ AppSec · 🪶 Haiku · 🟢 baixo
Risk: auth, concurrency

## Objetivo
Detectar pedido pendente, mostrar a pergunta e responder uma vez.

Fora: Regras permanentes de permissão.

## Critérios de aceite
- [ ] AC-034 — WHEN um agente pedir permissão, the system SHALL marcá-lo `◆`, mostrar o comando mascarado com `1 Permitir`, `2 Recusar`, `3 Ver detalhe`, e aplicar a resposta só àquela chamada. Cenário: S-034 @success.
- [ ] AC-035 — WHEN o pedido for respondido em outro lugar, ou `CAPABILITIES.allow` ou `decline` for falso, the system SHALL remover o `◆` respondido e não desenhar opção sem suporte, mantendo o diálogo nativo. Cenário: S-035 @deviation.
- [ ] AC-036 — IF o engine rejeitar a resposta, the system SHALL mostrar a mensagem no card e manter `◆`. Cenário: S-036 @error.
- [ ] AC-037 — WHEN o usuário recusar, the system SHALL entregar a recusa ao agente e mantê-lo `Rodando`, sem marcá-lo como Interrompido. Cenário: S-037 @deviation.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-034 a AC-037) · cenários: `acceptance/actions.feature` tag `@T-011` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/decisions.ts`, `plugins/agent-office/hooks/decisions.test.ts`.
Hipótese não verificada: `tool.check` com `agentId`. Depende do veredito da ADR 0002. Regras de segurança em `spec/03-architecture.md`.

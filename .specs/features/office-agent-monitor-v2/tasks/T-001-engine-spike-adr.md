---
id: T-001
title: Spike bloqueante: provar o que o engine expõe e registrar em ADR
type: qa
status: TODO
progress: 0/3
updated: 2026-11-05
depends_on: []
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-001]
estimate: M
skills: []
executor: 📐 Arquiteto · 🎼 Sonnet · 🟢 baixo
judge: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
---
# T-001 — Spike bloqueante: provar o que o engine expõe e registrar em ADR

Executor: 📐 Arquiteto · 🎼 Sonnet · 🟢 baixo
Judge: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo

## Objetivo
Provar, em sessão real, quais ações e eventos existem, e publicar a matriz de capacidades.

Fora: Qualquer tela ou ação de produto; o código de spike não entra no plugin.

## Critérios de aceite
- [ ] AC-001 — WHEN o spike termina, the system SHALL publicar a ADR 0002 com uma linha para cada capacidade de `CapabilityKey`, cada uma com veredito `yes`, `no` ou `not-verified` e evidência (`file:line` do tipo e trecho do log da execução). Cenário: S-001 @success.
- [ ] AC-002 — IF uma ação Pause, Stop, Retry, Allow, Decline ou open-in-chat não tiver suporte, the system SHALL gravar `false` em `CAPABILITIES` e escalar ao usuário com `ASK:` antes de T-011 e T-012. Cenário: S-002 @deviation.
- [ ] AC-003 — IF a superfície do app Claude não puder ser executada no spike, the system SHALL registrar `not-verified` e tratar a capacidade como falsa naquela superfície. Cenário: S-003 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-001 a AC-003) · cenários: `acceptance/foundation.feature` tag `@T-001` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `.specs/architecture/adr/0002-capacidades-do-engine.md`, `plugins/agent-office/hooks/capabilities.ts`.
Hipóteses estáticas e método em `spec/02-research.md`. Bloqueia T-002 em diante. Gap de ação vira ASK ao usuário, nunca simulação.

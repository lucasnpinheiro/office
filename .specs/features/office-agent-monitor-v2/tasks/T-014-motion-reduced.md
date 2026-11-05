---
id: T-014
title: Movimento e movimento reduzido
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-05
depends_on: [T-005, T-013]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-014]
estimate: S
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-014 — Movimento e movimento reduzido

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Aplicar a tabela de efeitos e o modo reduzido.

Fora: Efeitos fora da tabela do Padrão.

## Critérios de aceite
- [ ] AC-045 — WHILE houver agente rodando, the system SHALL animar o spinner a 6 quadros/s; WHEN surgir `◆`, the system SHALL subi-lo ao topo e soar o sino uma vez. Cenário: S-045 @success.
- [ ] AC-046 — WHERE `OFFICE_REDUCED_MOTION`, `CI` ou o movimento reduzido do sistema estiverem ativos, the system SHALL usar ponto fixo e 1 quadro/s. Cenário: S-046 @deviation.
- [ ] AC-047 — IF a superfície não aceitar um efeito, the system SHALL trocar direto de estado, sem erro e sem simular. Cenário: S-047 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-045 a AC-047) · cenários: `acceptance/layout.feature` tag `@T-014` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/motion.ts`, `plugins/agent-office/hooks/motion.test.ts`.
`FRAME_MS` (office.ts:46), `COMPACT_FRAME_MS` (office.ts:71), `TICK_MS` (office.ts:47). Spinner a 6 quadros/s pelo canvas, no modo compacto também (assunção). Pulso e crossfade do app dependem da ADR 0002.

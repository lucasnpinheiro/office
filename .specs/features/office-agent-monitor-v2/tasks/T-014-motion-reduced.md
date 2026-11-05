---
id: T-014
title: Movimento e movimento reduzido
type: frontend
status: IN_PROGRESS
progress: 1/3
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
- [ ] AC-045 — PARCIAL. Feito: intervalo de quadro de 6/s (`motion.ts`, ligado em `office.ts` `nextDelay`, usado por `register.tsx`). Não feito: o glifo do spinner não cicla no render (`vocabulary.ts` segue com `⠹` fixo; `spinnerGlyph` não está ligado); o sino não é emitido (`bellOnNewDecision` não está ligado); `◆` subir ao topo já existia em `compact.ts`, não reverificado com teste de movimento. Cenário: S-045 @success.
- [ ] AC-046 — PARCIAL. Feito: `nextDelay` com movimento reduzido = 1000 ms (`frameIntervalMs`); `register.tsx` zera `frame` com `caps.reducedMotion`; barra e cards estáticos em reduzido (`compact.ts`, já existente). Não verificado: sinal de movimento reduzido do sistema e o app (ADR 0002). Cenário: S-046 @deviation.
- [ ] AC-047 — PARCIAL. Feito: regra pura `transitionFor` (sem `appMotion` = troca direta). Não ligado a nenhuma superfície: o app não tem render verificado (ADR 0002, `appMotion` not-verified). Cenário: S-047 @error.

## Evidência parcial
- Baseline antes da mudança: `claude plugin test /…/plugins/agent-office` → 336 pass, 0 fail, exit 0 (o brief citava base de 147; a base real é 336).
- RED: `hooks/motion.test.ts` não carregava (módulo ausente); `office.test.ts` T-014 falhava com 250 ms de compacto.
- GREEN: mesmo comando → 342 pass, 0 fail, exit 0 (27 arquivos).
- `drawSig` test ajustado para início de quadro (`6 * FRAME_MS`), porque FRAME_MS passou de 150 para 167.

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

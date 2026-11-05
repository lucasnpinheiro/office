---
id: T-003
title: Capturar linha do tempo por ferramenta, tokens e custo em memória
type: backend
status: TODO
progress: 0/3
updated: 2026-11-05
depends_on: [T-002]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-003]
estimate: M
skills: []
executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-003 — Capturar linha do tempo por ferramenta, tokens e custo em memória

Executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Registrar `ToolStep` ordenado por agente e tokens/custo quando houver fonte, só em memória.

Fora: Entrada e saída de ferramentas (T-004); renderização (T-009, T-010).

## Critérios de aceite
- [ ] AC-007 — WHEN uma chamada de ferramenta termina, the system SHALL acrescentar ao agente um `ToolStep` com ferramenta, rótulo, início, `durationMs` e resultado, na ordem de início. Cenário: S-007 @success.
- [ ] AC-008 — WHERE a fonte de tokens ou custo não existir para o agente, the system SHALL manter o campo `undefined` e nunca zero. Cenário: S-008 @deviation.
- [ ] AC-009 — IF a captura falhar durante uma chamada, the system SHALL devolver o resultado da ferramenta inalterado e não gravar nada em disco nem em rede. Cenário: S-009 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-007 a AC-009) · cenários: `acceptance/foundation.feature` tag `@T-003` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/capture.ts`, `plugins/agent-office/hooks/capture.test.ts`.
Duração medida em volta de `next(e)` no `tool.call` (register.tsx:388). Hoje só há as 3 últimas (stats.ts:78). Limite 200 passos por agente, descartando os mais antigos com contador. Fonte de tokens por `turn.step` e de custo conforme ADR 0002.

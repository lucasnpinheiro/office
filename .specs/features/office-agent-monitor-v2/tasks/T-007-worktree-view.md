---
id: T-007
title: Visão Worktrees com saúde por branch
type: frontend
status: IN_PROGRESS
progress: 0/3
updated: 2026-11-05
depends_on: [T-005, T-006]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-007]
estimate: M
skills: []
executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-007 — Visão Worktrees com saúde por branch

Executor: 🦉 Senior · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Agrupar por worktree, reconhecer isolamento vindo da definição e contar commits à frente da base.

Fora: Criar, remover ou integrar worktrees.

## Critérios de aceite
- [ ] AC-021 — WHEN agentes rodam em worktrees, the system SHALL agrupá-los por branch sob divisor com quantidade, falhas, arquivos e `base <branch> +N commits`. Cenário: S-021 @success.
- [ ] AC-022 — WHEN um agente tiver isolamento vindo da própria definição, sem `isolation` na chamada, the system SHALL reconhecê-lo pelo caminho do primeiro arquivo ou pelo `cwd` como agente de worktree. Cenário: S-022 @deviation.
- [ ] AC-023 — IF `$.process` não existir ou o git falhar ou passar de 2 s, the system SHALL omitir `+N commits` sem mostrar zero. Cenário: S-023 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-021 a AC-023) · cenários: `acceptance/views.feature` tag `@T-007` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/view-worktrees.ts`, `plugins/agent-office/hooks/view-worktrees.test.ts`.
Reaproveita `isolatedCall` (stats.ts:195), `worktreeOf` (stats.ts:134), `worktreeFromPath` (git.ts:53). Lacuna do PR #5. Contagem via `$.process` (argv, sem shell) com timeout de 2 s e no máximo uma vez a cada 30 s por worktree; `$.process` é só CLI pelos tipos, então no app a contagem é omitida salvo prova na ADR 0002.

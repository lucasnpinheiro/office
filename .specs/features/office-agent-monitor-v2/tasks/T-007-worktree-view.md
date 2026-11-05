---
id: T-007
title: Visão Worktrees com saúde por branch
type: frontend
status: IN_PROGRESS
progress: 3/3
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
- [x] AC-021 — WHEN agentes rodam em worktrees, the system SHALL agrupá-los por branch sob divisor com quantidade, falhas, arquivos e `base <branch> +N commits`. Cenário: S-021 @success. (Integração: no modo agrupado cada agente aparece uma vez, aninhado sob o divisor do seu worktree; agente sem worktree conhecido vai sob "sem worktree conhecido". A `base` é a real, upstream ou `origin/HEAD`, nunca o nome da própria branch; sem base conhecida, sem a linha. Testes: `view-worktrees.test.ts`, `integration.test.ts`.)
- [x] AC-022 — WHEN um agente tiver isolamento vindo da própria definição, sem `isolation` na chamada, the system SHALL reconhecê-lo pelo caminho do primeiro arquivo ou pelo `cwd` como agente de worktree. Cenário: S-022 @deviation. (Por fixture. NÃO verificado com agente real isolado pela definição: `worktreeFromDefinition` segue `not-verified` na ADR 0002.)
- [x] AC-023 — IF `$.process` não existir ou o git falhar ou passar de 2 s, the system SHALL omitir `+N commits` sem mostrar zero. Cenário: S-023 @error. (`git.ts` `aheadOf`/`cachedAhead`: segundo plano, 2 s via `Promise.race`, 30 s de cache por worktree, falha também em cache, saída só aceita se exit 0 e `^\d+$`. Provado no CLI: ADR 0002 Probes 5. App: sem contagem (CLI only). Git lento de verdade não foi exercitado, só simulado com um `run` que nunca resolve.)

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-021 a AC-023) · cenários: `acceptance/views.feature` tag `@T-007` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main` (`feat/office-t007-t010-integration`)
- [x] Teste RED antes do GREEN (git.test.ts e integration.test.ts rodaram vermelhos antes de `aheadOf` e da ligação no register; os testes de nesting do modo agrupado foram escritos junto com o código)
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova (base desta integração: 286 pass, 0 fail)
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes (não executadas)
- [ ] Julgada por subagente diferente do implementador
- [ ] Render real no terminal (`claude -p` não desenha o painel; só o kit de teste do engine montou o `ui.render`)

## Evidência
2026-11-05, branch `feat/office-t007-t010-integration`: `claude plugin test .` em `plugins/agent-office` => 323 pass, 0 fail (exit 0); `check_bundle.py` => OK. Status segue IN_PROGRESS: falta juiz independente, e2e-regression e render interativo.
Não atendido/limitado: contagem no App; AC-022 só por fixture; base é upstream ou `origin/HEAD` (um worktree sem nenhum dos dois não mostra `+N`).

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-worktrees.ts`, `plugins/agent-office/hooks/view-worktrees.test.ts`.
Reaproveita `isolatedCall` (stats.ts:195), `worktreeOf` (stats.ts:134), `worktreeFromPath` (git.ts:53). Lacuna do PR #5. Contagem via `$.process` (argv, sem shell) com timeout de 2 s e no máximo uma vez a cada 30 s por worktree; `$.process` é só CLI pelos tipos, então no app a contagem é omitida salvo prova na ADR 0002.

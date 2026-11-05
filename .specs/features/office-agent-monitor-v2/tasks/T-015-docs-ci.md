---
id: T-015
title: README, documentação e CI
type: docs
status: IN_PROGRESS
progress: 1/3
updated: 2026-11-05
depends_on: [T-012, T-013, T-014]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-015]
estimate: S
skills: []
executor: ⚙️ DevOps · 🪶 Haiku · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-015 — README, documentação e CI

Executor: ⚙️ DevOps · 🪶 Haiku · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Documentar teclas, variáveis e limites, e fazer os testes bloquearem no CI quando o CLI existir.

Fora: Publicação em marketplace.

## Critérios de aceite
- [x] AC-048 — WHEN a entrega termina, the system SHALL ter no README todas as teclas, variáveis `OFFICE_*`, capacidades ausentes e a nota de não verificado do app. Cenário: S-048 @success.
- [ ] AC-049 (NÃO CUMPRIDO: o passo segue `continue-on-error`; não há como verificar aqui se a imagem do CI tem `claude plugin test` e o runtime `claude-code/testing`) — WHERE `claude plugin test` estiver disponível no CI, the system SHALL fazer a falha de teste bloquear o job. Cenário: S-049 @deviation.
- [ ] AC-050 (PARCIAL: o passo imprime `SKIPPED` e grava no resumo quando o subcomando falta; só verificado por leitura, não observado no CI) — IF o CLI não existir no CI, the system SHALL registrar `skipped` de forma explícita e nunca `pass`. Cenário: S-050 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-048 a AC-050) · cenários: `acceptance/delivery.feature` tag `@T-015` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [ ] Branch dedicada, nunca `main`
- [ ] Teste RED antes do GREEN
- [ ] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 147
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes
- [ ] Julgada por subagente diferente do implementador

## Evidência parcial
`claude plugin test .` em `plugins/agent-office`: base nova de main 352 pass, 0 fail; após esta task 358 pass, 0 fail (2026-11-05). `depends_on` T-012 não cumprida (BLOCKED): task segue IN_PROGRESS, não DONE.

## Notas técnicas
Arquivos prováveis: `.github/workflows/validate.yml`, `plugins/agent-office/README.md`.
`validate.yml:39` hoje usa `continue-on-error`. O CLI de `claude plugin test` não tem opção de cobertura (`--help` executado). Versão de plugin sobe de 0.15.3 para 0.16.0.

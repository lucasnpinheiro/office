---
id: T-015
title: README, documentação e CI
type: docs
status: TODO
progress: 0/3
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
- [ ] AC-048 — WHEN a entrega termina, the system SHALL ter no README todas as teclas, variáveis `OFFICE_*`, capacidades ausentes e a nota de não verificado do app. Cenário: S-048 @success.
- [ ] AC-049 — WHERE `claude plugin test` estiver disponível no CI, the system SHALL fazer a falha de teste bloquear o job. Cenário: S-049 @deviation.
- [ ] AC-050 — IF o CLI não existir no CI, the system SHALL registrar `skipped` de forma explícita e nunca `pass`. Cenário: S-050 @error.

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

## Evidência
Preencher ao concluir: comando, exit code e data. DONE sem evidência é inválido.

## Notas técnicas
Arquivos prováveis: `.github/workflows/validate.yml`, `plugins/agent-office/README.md`.
`validate.yml:39` hoje usa `continue-on-error`. O CLI de `claude plugin test` não tem opção de cobertura (`--help` executado). Versão de plugin sobe de 0.15.3 para 0.16.0.

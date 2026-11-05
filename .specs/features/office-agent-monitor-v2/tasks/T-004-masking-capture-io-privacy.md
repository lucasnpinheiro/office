---
id: T-004
title: Mascarar segredos, opt-in OFFICE_CAPTURE_IO e atualizar privacidade
type: backend
status: TODO
progress: 0/4
updated: 2026-11-05
depends_on: [T-003]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-004]
estimate: M
skills: []
executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
risk: pii
judge: 🛡️ AppSec · 🪶 Haiku · 🟢 baixo
---
# T-004 — Mascarar segredos, opt-in OFFICE_CAPTURE_IO e atualizar privacidade

Executor: 🧠 Especialista · 🎼 Sonnet · 🟢 baixo
Judge: 🛡️ AppSec · 🪶 Haiku · 🟢 baixo
Risk: pii

## Objetivo
Mascarar antes de guardar: prompt, rótulos, e entrada/saída opcional. Atualizar `docs/privacy.md`.

Fora: Interface de exibição (T-009).

## Critérios de aceite
- [ ] AC-010 — WHEN um prompt ou rótulo de comando for capturado, the system SHALL substituir cada segredo reconhecido por `••••••••` antes de guardar o texto no estado. Cenário: S-010 @success.
- [ ] AC-011 — WHILE `OFFICE_CAPTURE_IO` for diferente de `1`, the system SHALL não guardar entrada nem saída de ferramentas e SHALL mostrar a nota de desligado no detalhe. Cenário: S-011 @deviation.
- [ ] AC-012 — IF o mascaramento falhar, the system SHALL guardar `[mascaramento falhou]` no lugar do texto original. Cenário: S-012 @error.
- [ ] AC-013 — WHEN `OFFICE_CAPTURE_IO=1`, the system SHALL guardar entrada e saída mascaradas e limitadas a 2000 caracteres por campo, somente em memória, e `docs/privacy.md` SHALL declarar esse comportamento. Cenário: S-013 @success.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-010 a AC-013) · cenários: `acceptance/foundation.feature` tag `@T-004` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [ ] Branch dedicada, nunca `main`
- [ ] Teste RED antes do GREEN
- [ ] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 147
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes
- [x] Julgada por subagente diferente do implementador: achados do juiz corrigidos (2026-11-05)

## Evidência
Preencher ao concluir: comando, exit code e data. DONE sem evidência é inválido.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/mask.ts`, `docs/privacy.md`.
Hoje o prompt só é truncado. Padrões mínimos em `spec/04-contracts.md`. Lista em `tests/security.md`. Falha fechada. `docs/privacy.md:5` hoje declara nomes, descrições, rótulos e durações: acrescentar tokens/custo, prompt mascarado e o opt-in.

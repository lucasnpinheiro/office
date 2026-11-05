---
id: T-013
title: Regras de layout responsivo
type: frontend
status: TODO
progress: 0/3
updated: 2026-11-05
depends_on: [T-006, T-007, T-008, T-009, T-010]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-013]
estimate: M
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-013 — Regras de layout responsivo

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Aplicar larguras do terminal e grade por container do app.

Fora: Novos conteúdos de tela.

## Critérios de aceite
- [ ] AC-042 — WHEN a largura mudar, the system SHALL usar 100+ colunas completo, 60 a 99 compacto, abaixo de 60 só lista, e no app 1, 2, 3 e 4 colunas em 0, 520, 780 e 1040 px de container. Cenário: S-042 @success.
- [ ] AC-043 — WHERE o container tiver menos de 900 px, the system SHALL abrir o detalhe sobre a lista, e abaixo de 520 px SHALL trocar cards por linhas de status, nome e tempo. Cenário: S-043 @deviation.
- [ ] AC-044 — IF a largura for desconhecida ou zero, the system SHALL usar o layout de uma coluna, encolher primeiro o `agora` e manter custo, tempo, falha e decisão visíveis. Cenário: S-044 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-042 a AC-044) · cenários: `acceptance/layout.feature` tag `@T-013` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/layout.ts`, `plugins/agent-office/hooks/layout.test.ts`.
Evolui `layoutLevel` (compact.ts). Regras em `spec/05-ui-design.md`. O app usa a largura recebida em `ui.render`; altura de 44 px depende da ADR 0002.

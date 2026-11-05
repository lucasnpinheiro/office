---
id: T-005
title: Vocabulário de estado, tokens, fallback de glifos e mapa de teclas único
type: frontend
status: IN_PROGRESS
progress: 4/4
updated: 2026-11-05
depends_on: [T-002]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-005]
estimate: M
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-005 — Vocabulário de estado, tokens, fallback de glifos e mapa de teclas único

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Criar a tabela única de estados, tokens de cor e teclas, usada pelas duas superfícies.

Fora: Layout de telas específicas.

## Critérios de aceite
- [x] AC-014 — The system SHALL exibir cada estado de `RunState` com o mesmo rótulo, glifo e cor do Padrão nas duas superfícies. Cenário: S-014 @success.
- [x] AC-015 — WHERE `OFFICE_ASCII=1` ou `NO_COLOR` estiver definido, the system SHALL usar a coluna ASCII (`[??]`, `[!!]`, `[xx]`, `[ok]`) e conectores `+ - :` sem caracteres de cor. Cenário: S-015 @deviation.
- [x] AC-016 — IF um estado desconhecido chegar ao renderizador, the system SHALL desenhar o rótulo em `muted` com glifo `?` e não lançar exceção. Cenário: S-016 @error.
- [x] AC-017 — WHEN uma visão é desenhada, the system SHALL derivar rodapé e botões do mesmo `KEY_MAP`, com a mesma letra para a mesma ação nas duas superfícies. Cenário: S-017 @success.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-014 a AC-017) · cenários: `acceptance/foundation.feature` tag `@T-005` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main`
- [x] Teste RED antes do GREEN
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova sobre a base de 160
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes (não verificado: sem sessão real)
- [x] Julgada por subagente diferente do implementador (achados corrigidos neste commit)

## Evidência
Preencher ao concluir: comando, exit code e data. DONE sem evidência é inválido.
- RED: `claude plugin test .` em `plugins/agent-office` com `hooks/vocabulary.test.ts` sem módulo: 160 pass, 1 fail (import), exit 1, 2026-11-05.
- GREEN: `claude plugin test .` em `plugins/agent-office`: 170 pass, 0 fail, exit 0, 2026-11-05. Base 160 sem falha nova.

- 2026-11-05, correção dos achados do juiz: RED = `hooks/render-vocab.test.ts` falha ao carregar (export ausente); GREEN = 179 pass, 0 fail. Telas ligadas ao vocabulário (`monitor.ts`, `compact.ts`, `actions.ts`); `g` = modo e `o` = ordenar no `KEY_MAP`.
- Testes antigos alterados porque a spec exige o rótulo, glifo e cor da tabela (`compact.test.ts`: 'Em execução ×3' para 'Rodando ×3', '●' para '⠹', legenda, `statusText`, cores de borda e contadores, '● Dev: r' para '⠹ Dev: r'; `monitor.test.ts`: `STATE_COLOR`, legenda, mixHex em minúsculas; `render.test.ts`: /rodando/ para /Rodando/).
- Não verificado: sessão real nas duas superfícies; App.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/vocabulary.ts`, `plugins/agent-office/hooks/vocabulary.test.ts`.
Tabela em `spec/05-ui-design.md`. Substitui `State` (monitor.ts:18), incluindo a saída de `inactive`. `STATE_COLOR` passa a derivar daqui.

---
id: T-013
title: Regras de layout responsivo
type: frontend
status: IN_PROGRESS
progress: 2/3
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
- [x] AC-042 — WHEN a largura mudar, the system SHALL usar 100+ colunas completo, 60 a 99 compacto, abaixo de 60 só lista, e no app 1, 2, 3 e 4 colunas em 0, 520, 780 e 1040 px de container. Cenário: S-042 @success. (Terminal: `layoutLevel` delega a `layout.ts`; `renderCompact` testado em 100, 60 e 59 colunas (`layout.test.ts`). Mudou de 50 para 60 o corte da lista; dois testes antigos (`compact.test.ts` estreito, `review.test.ts` 50 colunas) foram ajustados à regra nova. App: `containerPx` limita os cards por fileira via `appColumns`, provado só no kit de testes do engine; `containerWidth` está `not-verified` na ADR 0002 e `register.tsx` só repassa o valor se a matriz virar `yes`, então hoje o app nunca o recebe.)
- [ ] AC-043 — WHERE o container tiver menos de 900 px, the system SHALL abrir o detalhe sobre a lista, e abaixo de 520 px SHALL trocar cards por linhas de status, nome e tempo. Cenário: S-043 @deviation. (PARCIAL: abaixo de 520 px os cards viram linhas com estado, nome e tempo em `renderCompact` (testado com `containerPx` 390 e 1040). `sideDetail` decide detalhe ao lado (900 px) ou sobre a lista e está ligado em `register.tsx`, mas sem `containerWidth` verificado o ramo de 900 px nunca roda num painel real e o desenho do detalhe sobre a lista não tem teste de render. Altura de 44 px não tratada, depende da ADR 0002.)
- [ ] AC-044 — IF a largura for desconhecida ou zero, the system SHALL usar o layout de uma coluna, encolher primeiro o `agora` e manter custo, tempo, falha e decisão visíveis. Cenário: S-044 @error. (`renderCompact` com 0, negativa ou NaN usa 80 colunas e uma coluna; falha primeiro, custo e tempo ficam; o `agora` (ferramenta em curso na linha da árvore) encolhe por `fitAgora` antes de nome, métrica e tempo.)

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-042 a AC-044) · cenários: `acceptance/layout.feature` tag `@T-013` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main` (`feat/office-t013`)
- [x] Teste RED antes do GREEN (`layout.test.ts` falhou por módulo ausente: 323 pass, 1 fail)
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova (base medida em 2026-11-05: 323 pass, 0 fail; a base de 147 está defasada)
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes
- [ ] Julgada por subagente diferente do implementador

## Evidência
`claude plugin test .` em `plugins/agent-office`: 336 pass, 0 fail, 2026-11-05. Task segue IN_PROGRESS: AC-043 parcial, linhas de `e2e-regression.md` e julgamento por outro subagente pendentes.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/layout.ts`, `plugins/agent-office/hooks/layout.test.ts`.
Evolui `layoutLevel` (compact.ts). Regras em `spec/05-ui-design.md`. O app usa a largura recebida em `ui.render`; altura de 44 px depende da ADR 0002.

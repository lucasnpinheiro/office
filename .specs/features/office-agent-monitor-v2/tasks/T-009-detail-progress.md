---
id: T-009
title: Tela de detalhe e fluxo de progresso honesto
type: frontend
status: TODO
progress: 0/4
updated: 2026-11-05
depends_on: [T-003, T-004, T-005]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-009]
estimate: M
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-009 — Tela de detalhe e fluxo de progresso honesto

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Detalhe na ordem do Padrão e regras de progresso e ETA do canvas.

Fora: Executar ações (T-012).

## Critérios de aceite
- [ ] AC-027 — WHEN um agente é aberto, the system SHALL mostrar, nesta ordem, trilha, estado, persona e modelo, worktree, tempo, tokens, custo, erro, linha do tempo, dependências e prompt mascarado. Cenário: S-027 @success.
- [ ] AC-028 — WHEN o total de passos não for conhecido, the system SHALL mostrar só os segmentos feitos, sem percentual e sem promessa. Cenário: S-028 @deviation.
- [ ] AC-029 — IF o agente selecionado sair da lista, the system SHALL voltar à lista com aviso sem quebrar. Cenário: S-029 @error.
- [ ] AC-030 — WHILE houver menos de 3 agentes concluídos do mesmo modelo, the system SHALL não mostrar ETA. Cenário: S-030 @deviation.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-027 a AC-030) · cenários: `acceptance/views.feature` tag `@T-009` · demais linhas por `Covers` em `tests/`.

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
Arquivos prováveis: `plugins/agent-office/hooks/view-detail.ts`, `plugins/agent-office/hooks/view-detail.test.ts`.
Substitui `detailLines` (monitor.ts:519) e `detailCompact` (compact.ts:526). Corrige `progressOf` (monitor.ts:131) e `etaOf` (monitor.ts:158; hoje usa 2 amostras e trata paralelo como sequencial).

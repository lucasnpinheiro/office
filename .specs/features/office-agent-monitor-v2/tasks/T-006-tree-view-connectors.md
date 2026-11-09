---
id: T-006
title: Visão Árvore com conectores para agentes e subagentes
type: frontend
status: IN_PROGRESS
progress: 3/3
updated: 2026-11-05
depends_on: [T-005]
origin: null
branch: spec/office-agent-monitor-v2
covers: [REQ-006]
estimate: M
skills: []
executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
judge: 🧪 QA · 🪶 Haiku · 🟢 baixo
---
# T-006 — Visão Árvore com conectores para agentes e subagentes

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo
Judge: 🧪 QA · 🪶 Haiku · 🟢 baixo

## Objetivo
Árvore de agentes (a visão inicial segue Unresolved 3): resumo, faixas de ação e conectores.

Fora: Cards responsivos (T-013); animação (T-014).

## Critérios de aceite
- [ ] AC-018 (PARCIAL) — WHEN há agentes e subagentes, the system SHALL desenhar a árvore com conectores `├ └`, cabeçalho com tempo, rodando e custo, e `◆`/`✗` fixados no topo com a tecla da ação. Cenário: S-018 @success.
  - Atendido: conectores `├ └`, cabeçalho com tempo, rodando e custo (forma curta a partir de 60 colunas), `✗` fixado no topo. Pendente: `◆` e a tecla `d` aguardam T-011 (estado needs-you); a tecla `r` só aparece com a capability `retry` em `yes`, que depende de T-012. Fechar o AC nessas tasks.
- [x] AC-019 — WHEN irmãos com mesmo estado excederem 8 linhas, the system SHALL colapsá-los em `Rodando ×N` e a tecla `g` SHALL alternar para todos. Cenário: S-019 @deviation.
- [x] AC-020 — IF não houver agente na sessão, the system SHALL mostrar o estado vazio sem barra de progresso. Cenário: S-020 @error.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-018 a AC-020) · cenários: `acceptance/views.feature` tag `@T-006` · demais linhas por `Covers` em `tests/`.

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
- 2026-11-05: `claude plugin test .` em `plugins/agent-office` → 193 pass, 0 fail (base 179 pass, 0 fail). Exit 0.
- 2026-11-05: `python3 <agents-home>/skills/tlc-spec-driven/scripts/check_bundle.py .specs/features/office-agent-monitor-v2` → exit 0.

- 2026-11-05 (achados do juiz): `claude plugin test .` em `plugins/agent-office` → 199 pass, 0 fail. Exit 0.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-tree.ts`, `plugins/agent-office/hooks/view-tree.test.ts`.
Reaproveita `renderCompact` (compact.ts) e `MAX_DEPTH`. Modo `map` segue disponível: ver Unresolved 3.

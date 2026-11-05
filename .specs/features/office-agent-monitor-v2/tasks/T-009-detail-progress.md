---
id: T-009
title: Tela de detalhe e fluxo de progresso honesto
type: frontend
status: IN_PROGRESS
progress: 4/4
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
- [x] AC-027 — WHEN um agente é aberto, the system SHALL mostrar, nesta ordem, trilha, estado, persona e modelo, worktree, tempo, tokens, custo, erro, linha do tempo, dependências e prompt mascarado. Cenário: S-027 @success. (`view-detail.ts` `detailView`, ligado em `register.tsx` para o painel compacto, o painel lateral e o mapa; antes `detailCompact` e `detailLines` ficavam no lugar. Todo texto do agente (nome, ferramenta, worktree, pai, filhos, descrição, erro, passos, arquivos, tarefas) passa por `maskText`. `Custo` é sempre `—` (sem fonte por agente, ADR 0002).)
- [x] AC-028 — WHEN o total de passos não for conhecido, the system SHALL mostrar só os segmentos feitos, sem percentual e sem promessa. Cenário: S-028 @deviation.
- [x] AC-029 — IF o agente selecionado sair da lista, the system SHALL voltar à lista com aviso sem quebrar. Cenário: S-029 @error. (A lista aparece com o aviso e um botão voltar; a seleção velha é limpa pela próxima ação. Não há escrita de átomo dentro do `ui.render`.)
- [x] AC-030 — WHILE houver menos de 3 agentes concluídos do mesmo modelo, the system SHALL não mostrar ETA. Cenário: S-030 @deviation. (`etaOf` agora: modelo conhecido, restante só do mesmo modelo e sem tarefas nem dupla contagem de pai e filho, paralelismo só o observado nas amostras (sobreposição de início e fim); sem como derivar = sequencial, mais lento que o real, nunca mais rápido.)

Conteúdo do detalhe antigo que mudou de lugar ou foi retirado: mantidos `Descrição`, `Agora`, links de pai, filhos e irmãos, `p` e `n`, anexos clicáveis (a prévia usa o caminho real, o texto exibido é mascarado), tarefas, nota de captura desligada e `b voltar`. Retirados: a linha `Bloqueia: —` (sempre `—`, sem fonte), a linha `Log` com os 3 recentes quando há passos (a linha do tempo a substitui) e os dois cabeçalhos de duas linhas do painel antigo (glifo e nome, persona), já cobertos por trilha e `Persona e modelo`. A linha `Branch` virou `Worktree: ⧉ nome · ⎇ branch`.

## Testes vinculados
integração: `tests/integration.md` (linhas de AC-027 a AC-030) · cenários: `acceptance/views.feature` tag `@T-009` · demais linhas por `Covers` em `tests/`.

## Dependências
`depends_on` acima é a fonte única. Bloqueada até cada task listada estar DONE.

## Validação (IMPLEMENTATION_COMPLETE)
- [x] Branch dedicada, nunca `main` (`feat/office-t007-t010-integration`)
- [x] Teste RED antes do GREEN (integration.test.ts vermelho antes da ligação no register; testes de `etaOf` e de máscara escritos junto com o código)
- [x] `claude plugin test .` em `plugins/agent-office` sem falha nova (base desta integração: 286 pass, 0 fail)
- [ ] Linhas de `tests/e2e-regression.md` impactadas verdes (não executadas)
- [ ] Julgada por subagente diferente do implementador
- [ ] Render real no terminal (`claude -p` não desenha o painel)

## Evidência
2026-11-05: `claude plugin test .` em `plugins/agent-office` => 323 pass, 0 fail (exit 0). Testes de registro (`integration.test.ts`) montam o `ui.render` real: ordem do detalhe, nota de captura, segredo nunca exibido, agente sumido com aviso e botão voltar, ETA com modelos mistos.
Achado na integração: a captura de tokens da sessão principal estava morta (`register.tsx` só lia `usage` com `agentId`); corrigida, com teste.
Status segue IN_PROGRESS: falta juiz independente, e2e-regression e render interativo.

## Notas técnicas
Arquivos prováveis: `plugins/agent-office/hooks/view-detail.ts`, `plugins/agent-office/hooks/view-detail.test.ts`.
Substitui `detailLines` (monitor.ts:519) e `detailCompact` (compact.ts:526). Corrige `progressOf` (monitor.ts:131) e `etaOf` (monitor.ts:158; hoje usa 2 amostras e trata paralelo como sequencial).

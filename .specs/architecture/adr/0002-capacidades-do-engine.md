# 0002. Capacidades do engine da mod

Status: proposta por T-001. Veredito de tipo tem evidência de arquivo; probe parcial em sessão não interativa (ver "Evidência de execução"). Retry, Allow e Decline têm prova não interativa; Stop e o dialogo humano seguem não verificados.

## Contexto
O usuário decidiu por controles completos, sem fingir: controle sem suporte não aparece, e a lacuna vai ao usuário.

## Fontes e versões observadas
- Tipos gerados do engine: `/Users/lucasnpinheiro/.agents/mods/agent-office-marketplace/plugins/agent-office/.claude-plugin/types/claude-code/index.d.ts`, cabeçalho "Written by Claude Code 2.1.292", 15776 linhas. Citações abaixo usam este arquivo.
- CLI instalado: `claude --version` = `2.1.311 (Claude Code)`.
- Referências do skill mod-builder (`~/.claude/plugins/marketplaces/claude-code-mods/plugins/mod-builder/skills/mod-builder/`): `data/api-map.json` marca versão `2.1.287`; `references/events.md`, `nouns.md`, `limits.md`. Versão do mapa é anterior ao tipo; divergência registrada.
- Caminho anotado em `spec/02-research.md` (`.claude-plugin/types`, `$.agent` em `:3252`, `:566`) não bate com o arquivo acima: as linhas citadas em 02-research são de outra build. Este ADR usa só as linhas de 2.1.292 deste arquivo.

## Matriz (uma linha por `CapabilityKey` de `spec/04-contracts.md`)
Veredito: `yes` = tipo declara a operação; `no` = tipo não declara e a superfície de API ao redor mostra só leitura ou outro escopo; `not-verified` = depende de execução ou de regra não provada. Superfície App não foi executada: `yes` de tipo vira `not-verified` nela (AC-003).

| Capacidade | Terminal | App | Evidência de tipo (arquivo:linha) | Evidência de execução |
|---|---|---|---|---|
| pause | no | no | `$.agent` tem só `spawn`, `list`, `register` (`index.d.ts:3138-3186`); `$.turn` tem só `abort` (`:2890-2904`); status `waiting`/`idle` é leitura (`:533-539`) | pendente |
| stop | not-verified | not-verified | `$.turn.abort({turnId})` cancela o turno que o plugin recebeu em `turn.start`, não um agente (`:2890-2903`); status `killed` existe (`:539`) sem método que o defina; uso por `turnId` de subagente não documentado | nao provado: `$.turn.abort` exige `turnId` do turno que o plugin recebeu; nenhuma forma de abortar subagente achada nem tentada. Probe nao executada (precisa sessao interativa) |
| retry (retomar por id) | yes | not-verified | agente encerrado (`completed`, `failed`, `killed`) pode voltar com mensagem sob o mesmo id (`:535-537`); `SendMessage` está na lista de ferramentas do api-map (`data/api-map.json`). Sem reenvio do prompt original | PROVADO terminal (print): `claude -p --model haiku "Agent foreground 'reply ALPHA', depois SendMessage ao mesmo id 'reply BETA'"` -> `{"success":true,"message":"Resuming agent a78e708","resumedAgentId":"a78e7088a6b36b476"}` e agente respondeu BETA. App: nao verificado |
| allow | not-verified | not-verified | `tool.check` recebe `tool_use_id` e `agentId` e responde `allow`/`ask`/`deny` (`:12731-12786`); para tool que pede a pessoa, hook só endurece: "its `allow` does not dismiss the dialog" (`:12784`); orçamento de hook 10 s, `$` waits fora da conta (`references/limits.md:14`) | PROVADO so em modo nao interativo: mod com `tool.check` -> `{decision:'allow'}` em Bash; sem mod, `touch /tmp/...` foi bloqueado ("needs approval"); com mod rodou e criou o arquivo. NAO provado: efeito sobre o dialogo humano em sessao interativa (`:12784`) |
| decline | not-verified | not-verified | mesmo caminho de `tool.check`, veredito `deny` (`:12786`); mesma dúvida de espera humana dentro de 10 s | PROVADO so em modo nao interativo: mod `tool.check` -> `{decision:'deny'}` => `Permission to use Bash denied by plugin probe: PROBE_DENIED_BY_MOD id=toolu_01Dp...`. NAO provado: recusar um dialogo humano pendente (continua o agente, AC-037) |
| openInChat | no | no | `SiteView` informa qual agente está em foco, "Read-only" (`:11792-11797`); nenhum setter achado; `prompt.fill` (`:4087`) põe texto na caixa, não abre transcrição | pendente |
| toolTiming | yes | not-verified | `tool.call` roda antes de cada ferramenta, inclusive de subagente e MCP (`references/events.md:14`, `nouns.md:142`); `next(e)` permite medir em volta (`events.md:141`); `ToolCallInput` traz `tool_use_id` e `agentId` (`:12574-12584`) | pendente |
| tokensPerAgent | yes | not-verified | `TurnStepInput` tem `agentId` opcional e `usage: TurnUsage \| null` por passo (`:13296-13330`, `:13396`); `TurnUsage` = `ModelUsage` + `model` (`:13522`); `ModelUsage` tem quatro contagens de token, sem $ (`:6393-6415`) | pendente |
| costPerAgent | no | no | `SessionCost` só no nível da sessão (`$.session.usage`, `:11035`, `:11650`); `ModelUsage` sem campo monetário; nenhuma tabela de preço. Pela Unresolved 4, mostrar `—` | não aplicável |
| permissionEvent | yes | not-verified | `tool.check` dispara em toda decisão de permissão com `tool_use_id` e `agentId` (`:12715-12731`; `nouns.md:143`) | pendente |
| workflowEvent | no | no | agentes de workflow trazem `workflow.runId` e `agentIndex` no spawn (`:357-371`), mas não aparecem em `$.agent.list()` (`:3156-3157`); nenhum campo de fase ou rodada. `Workflow` existe como nome de ferramenta (api-map) e `name` só para tarefa de workflow (`:821`) | pendente |
| worktreeFromDefinition | not-verified | not-verified | definição aceita `isolation: 'worktree'` (`:528`), mas `AgentInfo` (`:125-184`) não traz caminho do worktree; `WorktreeRemove` traz `worktree_path` (`:14512-14514`) só no hook de remoção | pendente |
| commitsAhead | yes | no | `$.process.run` roda argv sem shell (`:3470-3480`), e o doc diz "Commands on the host ... CLI only" (`:3465`) | pendente |
| containerWidth | yes | not-verified | `ui.render` é chamado por "viewport width" (`:3944`) | pendente |
| appMotion | not-verified | not-verified | `grep motion` no `index.d.ts` sem resultado; nenhuma API de movimento | pendente |
| reducedMotionSignal | not-verified | not-verified | `grep reduce` no `index.d.ts` sem resultado; sinal do sistema não provado | pendente |

Método de verificação de tipo: `command grep` e busca por regex em Python (`python3 -I`) sobre o arquivo acima; leitura de faixas com `python3 -I`. Não houve execução de mod de prova.

## Evidência de execução
Probe feita em 2026-11-05 com mod descartável em scratch (fora do repo), carregada por `--plugin-dir`; CLI 2.1.311, `claude -p --model haiku`, comandos inofensivos (`echo`, `touch` em /tmp). Nenhuma config, hook ou plugin do usuário foi alterado. A mod não pode importar `node:fs` (so `claude-code` e relativos), então a prova vem da saída do Claude.
- Retry por id: provado no terminal (linha da matriz).
- Deny por `tool.check`: provado, não interativo.
- Allow por `tool.check`: provado, não interativo. O comportamento do dialogo humano (hook so endurece) fica `not verified`.
- Stop: não provado.
- Superfície App: não executada; tudo `not-verified` lá.
- Passos manuais para o usuário (sessão interativa, mod via `--plugin-dir`, sem editar settings): (1) mod com `tool.check` que devolve `allow` para Bash e rode um comando que pede permissão: o dialogo aparece ou some? (2) idem com `deny`: o agente continua e o dialogo fecha? (3) com subagente em segundo plano rodando, chame `$.turn.abort` a partir de um comando da mod e veja se o subagente para ou só o turno principal. Reportar o resultado de cada um.

## Decisão e consequências
1. AC-002 disparou: Pause e openInChat são `no`; Stop, Allow e Decline são `not-verified`. Ficam `false` em `CAPABILITIES` (T-011/T-012 não expõem esses controles). Pergunta ao usuário registrada abaixo.
2. Retry por id é `yes` de tipo no terminal: serve ao Retry sem cópia do prompt (Unresolved 1). Ainda precisa de probe antes de T-012.
3. Custo por agente é `no`: o engine só dá tokens por agente. Coluna mostra `—` (Unresolved 4 segue aberta para o usuário).
4. Tempo por ferramenta, tokens por agente e evento de permissão são `yes` de tipo no terminal: T-003 e T-011 podem usar, com probe antes do merge.
5. Workflow sem fases: T-008 não pode mostrar fase ou rodada com dado do engine. Mostrar só o que `workflow.runId` e `agentIndex` dão, ou ficar com a lacuna.
6. Commits à frente: só terminal (`process.run` é CLI). App mostra ausência, conforme `spec/06-gaps.md` linha 8.
7. Versão: tipo 2.1.292, CLI 2.1.311, mapa 2.1.287. Qualquer mudança de build invalida esta matriz; recheck na próxima build.

## Decisões do usuário (2026-11-05, finais)
1. Controles: provar em sessão real primeiro, entregar só o provado, trazer cada lacuna ao usuário. Outras tasks seguem.
2. Custo: tokens por agente mais total real da sessão; custo por agente fica `—`; sem tabela de preço.

## Perguntas ao usuário (AC-002) - respondida acima
ASK: Pause, Stop, Allow, Decline e openInChat sem suporte comprovado no engine 2.1.292; como seguir para T-011 e T-012? | Seguir sem esses controles (recomendado, controle não aparece); Provar por probe em sessão real antes de T-011; Remover esses controles da spec

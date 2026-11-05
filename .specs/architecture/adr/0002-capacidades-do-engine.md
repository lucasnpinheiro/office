# 0002. Capacidades do engine da mod

Status: proposta por T-001 (spike de tipos). Veredito de tipo tem evidência de arquivo; execução em sessão real não foi feita nesta rodada (ver "Evidência de execução"). Nada aqui é runtime provado.

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
| stop | not-verified | not-verified | `$.turn.abort({turnId})` cancela o turno que o plugin recebeu em `turn.start`, não um agente (`:2890-2903`); status `killed` existe (`:539`) sem método que o defina; uso por `turnId` de subagente não documentado | pendente |
| retry (retomar por id) | yes | not-verified | agente encerrado (`completed`, `failed`, `killed`) pode voltar com mensagem sob o mesmo id (`:535-537`); `SendMessage` está na lista de ferramentas do api-map (`data/api-map.json`). Sem reenvio do prompt original | pendente |
| allow | not-verified | not-verified | `tool.check` recebe `tool_use_id` e `agentId` e responde `allow`/`ask`/`deny` (`:12731-12786`); para tool que pede a pessoa, hook só endurece: "its `allow` does not dismiss the dialog" (`:12784`); orçamento de hook 10 s, `$` waits fora da conta (`references/limits.md:14`) | pendente |
| decline | not-verified | not-verified | mesmo caminho de `tool.check`, veredito `deny` (`:12786`); mesma dúvida de espera humana dentro de 10 s | pendente |
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
Nenhuma probe em sessão real foi feita nesta rodada. O método de T-001 (mod temporária fora do plugin, tentando cada ação) fica pendente: exige sessão interativa e login, e a superfície App não pôde ser executada (AC-003). Por isso toda coluna de execução está `pendente`, e os `yes` de tipo valem só como indício de contrato.

## Decisão e consequências
1. AC-002 disparou: Pause e openInChat são `no`; Stop, Allow e Decline são `not-verified`. Ficam `false` em `CAPABILITIES` (T-011/T-012 não expõem esses controles). Pergunta ao usuário registrada abaixo.
2. Retry por id é `yes` de tipo no terminal: serve ao Retry sem cópia do prompt (Unresolved 1). Ainda precisa de probe antes de T-012.
3. Custo por agente é `no`: o engine só dá tokens por agente. Coluna mostra `—` (Unresolved 4 segue aberta para o usuário).
4. Tempo por ferramenta, tokens por agente e evento de permissão são `yes` de tipo no terminal: T-003 e T-011 podem usar, com probe antes do merge.
5. Workflow sem fases: T-008 não pode mostrar fase ou rodada com dado do engine. Mostrar só o que `workflow.runId` e `agentIndex` dão, ou ficar com a lacuna.
6. Commits à frente: só terminal (`process.run` é CLI). App mostra ausência, conforme `spec/06-gaps.md` linha 8.
7. Versão: tipo 2.1.292, CLI 2.1.311, mapa 2.1.287. Qualquer mudança de build invalida esta matriz; recheck na próxima build.

## Perguntas ao usuário (AC-002)
ASK: Pause, Stop, Allow, Decline e openInChat sem suporte comprovado no engine 2.1.292; como seguir para T-011 e T-012? | Seguir sem esses controles (recomendado, controle não aparece); Provar por probe em sessão real antes de T-011; Remover esses controles da spec

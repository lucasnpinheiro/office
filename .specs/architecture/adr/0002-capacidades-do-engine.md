# 0002. Capacidades do engine da mod

Status: proposta por T-001. Cada linha traz evidência de tipo (`arquivo:linha`). Só as linhas com trecho de log em "Evidência de execução" foram executadas (CLI, `claude -p`, não interativo); as demais têm veredito só de tipo e a coluna de execução diz isso. AC-001 está parcial: faltam logs de execução para as linhas marcadas `só tipo`.

## Contexto
O usuário decidiu por controles completos, sem fingir: controle sem suporte não aparece, e a lacuna vai ao usuário.

## Fontes e versões observadas
- Tipos gerados do engine: `<marketplace>/plugins/agent-office/.claude-plugin/types/claude-code/index.d.ts`, cabeçalho "Written by Claude Code 2.1.292", 15776 linhas. Citações abaixo usam este arquivo.
- CLI instalado: `claude --version` = `2.1.311 (Claude Code)`.
- Referências do skill mod-builder (`~/.claude/plugins/marketplaces/claude-code-mods/plugins/mod-builder/skills/mod-builder/`): `data/api-map.json` marca versão `2.1.287`; `references/events.md`, `nouns.md`, `limits.md`. Versão do mapa é anterior ao tipo; divergência registrada.
- Caminho anotado em `spec/02-research.md` (`.claude-plugin/types`, `$.agent` em `:3252`, `:566`) não bate com o arquivo acima: as linhas citadas em 02-research são de outra build. Este ADR usa só as linhas de 2.1.292 deste arquivo.

## Matriz (uma linha por `CapabilityKey` de `spec/04-contracts.md`)
Veredito: `yes` = tipo declara E há log de execução; `no` = tipo não declara e a superfície de API ao redor mostra só leitura ou outro escopo (veredito de ausência, `só tipo`); `not-verified` = depende de execução ou de regra não provada. Linha só de tipo com operação declarada fica `not-verified`: o contrato (`spec/04-contracts.md`) só admite `yes`, `no`, `not-verified`. Superfície App não foi executada: `yes` de tipo vira `not-verified` nela (AC-003).

| Capacidade | Terminal | App | Evidência de tipo (arquivo:linha) | Evidência de execução |
|---|---|---|---|---|
| pause | no | no | `$.agent` tem só `spawn`, `list`, `register` (`index.d.ts:3138-3186`); `$.turn` tem só `abort` (`:2890-2904`); status `waiting`/`idle` é leitura (`:533-539`) | só tipo (veredito de ausência), não executado |
| stop | not-verified | not-verified | `$.turn.abort({turnId})` cancela o turno que o plugin recebeu em `turn.start`, não um agente (`:2890-2903`); status `killed` existe (`:539`) sem método que o defina; uso por `turnId` de subagente não documentado | nao provado: `$.turn.abort` exige `turnId` do turno que o plugin recebeu; nenhuma forma de abortar subagente achada nem tentada. Probe nao executada (precisa sessao interativa) |
| retry (retomar por id) | not-verified | not-verified | agente encerrado (`completed`, `failed`, `killed`) pode voltar com mensagem sob o mesmo id (`:535-537`); `$.session.send({to:{agentId},text})` é o caminho da mod, "the model's SendMessage tool's own call and delivery" (`:2850-2862`). Sem reenvio do prompt original | O que foi provado foi o MODELO chamando `SendMessage` (print: `claude -p --model haiku "Agent foreground 'reply ALPHA', depois SendMessage ao mesmo id 'reply BETA'"` -> `{"success":true,"message":"Resuming agent a78e708","resumedAgentId":"a78e7088a6b36b476"}`), não uma mod. Probe de mod (Probe 3 abaixo): `$.session.send({to:{agentId}})` devolveu `isDelivered:false` (classificador do modo auto, 2 tentativas) e `$.agent.list()` veio vazio após o fim do agente. Mod disparar retomada: NÃO provado |
| allow | not-verified | not-verified | `tool.check` recebe `tool_use_id` e `agentId` e responde `allow`/`ask`/`deny` (`:12731-12786`); para tool que pede a pessoa, hook só endurece: "its `allow` does not dismiss the dialog" (`:12784`); orçamento de hook 10 s, `$` waits fora da conta (`references/limits.md:14`) | PROVADO so em modo nao interativo: mod com `tool.check` -> `{decision:'allow'}` em Bash; sem mod, `touch /tmp/...` foi bloqueado ("needs approval"); com mod rodou e criou o arquivo. NAO provado: efeito sobre o dialogo humano em sessao interativa (`:12784`) |
| decline | not-verified | not-verified | mesmo caminho de `tool.check`, veredito `deny` (`:12786`); mesma dúvida de espera humana dentro de 10 s | PROVADO so em modo nao interativo: mod `tool.check` -> `{decision:'deny'}` => `Permission to use Bash denied by plugin probe: PROBE_DENIED_BY_MOD id=toolu_01Dp...`. NAO provado: recusar um dialogo humano pendente (continua o agente, AC-037) |
| openInChat | no | no | `SiteView` informa qual agente está em foco, "Read-only" (`:11792-11797`); nenhum setter achado; `prompt.fill` (`:4087`) põe texto na caixa, não abre transcrição | só tipo (veredito de ausência), não executado |
| toolTiming | yes | not-verified | `tool.call` roda antes de cada ferramenta, inclusive de subagente e MCP (`references/events.md:14`, `nouns.md:142`); `next(e)` permite medir em volta (`events.md:141`); `ToolCallInput` traz `tool_use_id` e `agentId` (`:12574-12584`) | PROVADO terminal (Probe 2): `tool.call` com `next(e)` em volta mede duração por `tool_use_id`/`agentId` (`TOOLCALL tool=Bash id=toolu_015aHo... agentId=a2b961be... durMs=3041`, comando `sleep 1; echo hi`). Mede só `claude -p` |
| tokensPerAgent | yes | not-verified | `TurnStepInput` tem `agentId` opcional e `usage: TurnUsage \| null` por passo (`:13296-13330`, `:13396`); `TurnUsage` = `ModelUsage` + `model` (`:13522`); `ModelUsage` tem quatro contagens de token, sem $ (`:6393-6415`) | PROVADO terminal (Probe 2, repetida em 2026-11-05 na T-003): `turn.step` traz `agentId` e `usage` (`TURNSTEP agentId=a2b961be... idx=0 usage={"input_tokens":2,"output_tokens":87,"cache_read_input_tokens":8252,"cache_creation_input_tokens":14998,"model":"claude-haiku-5-5"}`); passo da sessão principal tem `agentId=-` |
| costPerAgent | no | no | `SessionCost` só no nível da sessão (`$.session.usage`, `:11035`, `:11650`); `ModelUsage` sem campo monetário; nenhuma tabela de preço. Pela Unresolved 4, mostrar `—` | não aplicável (ausência de campo; `usage` real da Probe 2 só tem contagens de token) |
| permissionEvent | yes | not-verified | `tool.check` dispara em toda decisão de permissão com `tool_use_id` e `agentId` (`:12715-12731`; `nouns.md:143`) | PROVADO terminal (Probe 2): `tool.check` dispara por chamada com `tool_use_id` e `agentId` (`TOOLCHECK tool=Bash id=toolu_015aHo... agentId=a2b961be...`), também para chamadas sem diálogo. NÃO provado: distinguir diálogo humano pendente (T-011 depende disso) |
| workflowEvent | yes (só `runId` e `agentIndex`) | not-verified | agentes de workflow trazem `workflow.runId` e `agentIndex` no spawn (`:357-371`), mas não aparecem em `$.agent.list()` (`:3156-3157`); nenhum campo de fase, rodada ou nome. `Workflow` existe como nome de ferramenta (api-map) e `name` só para tarefa de workflow (`:821`) | PROVADO terminal (Probe 4, 2026-11-05): `agent.spawn` de um `agent()` de workflow traz `workflow:{runId:"wf_e1777de3-314",agentIndex:1\|2}`; o Agent comum traz `workflow` ausente. ATENÇÃO: os dois agentes do mesmo run chegaram com o MESMO `tool_use_id` (ver Probe 4). Fases, rodada e nome: sem fonte no engine |
| worktreeFromDefinition | not-verified | not-verified | definição aceita `isolation: 'worktree'` (`:528`), mas `AgentInfo` (`:125-184`) não traz caminho do worktree; `WorktreeRemove` traz `worktree_path` (`:14512-14514`) só no hook de remoção | só tipo, não executado |
| commitsAhead | yes | no | `$.process.run` roda argv sem shell (`:3470-3480`), e o doc diz "Commands on the host ... CLI only" (`:3465`) | PROVADO terminal (Probe 5, 2026-11-05): `$.process.run(argv, {cwd, timeoutMs:2000})` rodou `rev-parse @{upstream}` => `origin/main` (exit 0, 20 ms), `symbolic-ref origin/HEAD` => `origin/main` (17 ms) e `rev-list --count HEAD~3..HEAD` => `6` (exit 0, 19 ms). App: `no` (CLI only) |
| containerWidth | not-verified | not-verified | `ui.render` é chamado por "viewport width" (`:3944`) | só tipo. `ui.render` não disparou em `claude -p` (não há tela); precisa sessão interativa. Não provado |
| appMotion | not-verified | not-verified | `grep motion` no `index.d.ts` sem resultado; nenhuma API de movimento | só tipo, não executado |
| reducedMotionSignal | not-verified | not-verified | `grep reduce` no `index.d.ts` sem resultado; sinal do sistema não provado | só tipo, não executado |

Método de verificação de tipo: `command grep` e busca por regex em Python (`python3 -I`) sobre o arquivo acima; leitura de faixas com `python3 -I`. Execução: ver "Evidência de execução"; linhas sem trecho de log são só de tipo.

## Evidência de execução
Probe feita em 2026-11-05 com mod descartável em scratch (fora do repo), carregada por `--plugin-dir`; CLI 2.1.311, `claude -p --model haiku`, comandos inofensivos (`echo`, `touch` em /tmp). Nenhuma config, hook ou plugin do usuário foi alterado. A mod não pode importar `node:fs` (so `claude-code` e relativos), então a prova vem da saída do Claude.
- Retry por id: o modelo chamando `SendMessage` retomou o agente (linha da matriz). Mod chamando `$.session.send`: não entregue (Probe 3). Retry via mod: não provado.
- Deny por `tool.check`: provado, não interativo.
- Allow por `tool.check`: provado, não interativo. O comportamento do dialogo humano (hook so endurece) fica `not verified`.
- Stop: não provado.
- Superfície App: não executada; tudo `not-verified` lá.
- Probe 2 (2026-11-05, mod com `tool.call`, `tool.check`, `turn.step` gravando por `$.process.run`; `claude -p --model haiku`, subagente rodou `sleep 1; echo hi`): prova toolTiming, tokensPerAgent e permissionEvent no terminal (trechos na matriz). Log: `TOOLCHECK tool=Bash id=toolu_015aHo... agentId=a2b961be...` / `TURNSTEP agentId=a2b961be... idx=0 usage={...}` / `TOOLCALL tool=Bash ... durMs=3041`.
- Probe 3 (mod chama `$.session.send({to:{agentId}, text:'reply BETA'})` após o subagente terminar): `SEND={"isDelivered":false,"reason":"The server-side auto mode classifier gave no verdict for SendMessage ..."}` nas 2 tentativas; `$.agent.list()` = `[]` depois do fim do agente. Bloqueio do ambiente, não prova de impossibilidade nem de possibilidade.
- containerWidth: `ui.render` não disparou em modo não interativo; sem prova.
- T-012 NÃO deve renderizar Retry até uma sessão provar que a mod dispara a retomada (ou que o App/terminal aceita outro caminho).
- Passos manuais para o usuário (sessão interativa, mod via `--plugin-dir`, sem editar settings): (1) mod com `tool.check` que devolve `allow` para Bash e rode um comando que pede permissão: o dialogo aparece ou some? (2) idem com `deny`: o agente continua e o dialogo fecha? (3) com subagente em segundo plano rodando, chame `$.turn.abort` a partir de um comando da mod e veja se o subagente para ou só o turno principal. Reportar o resultado de cada um.

- Probe 4 (2026-11-05, mod descartável em scratch, `--plugin-dir`, `claude -p --model haiku`, sem tocar em settings; o modelo rodou o `Workflow` com um script de dois `agent('reply OK')` e um `Agent` comum): log da mod em `agent.spawn`:
  - `SPAWN {"id":"toolu_01XDpe…","workflow":{"runId":"wf_e1777de3-314","agentIndex":1},"keys":["tool_use_id","prompt","description","subagentType","provider","model","parentModel","permissionMode","background","fork","workflow","name","cwd"]}`
  - `SPAWN {"id":"toolu_01RYtk…","workflow":null,"keys":[…sem workflow…]}` (o Agent comum)
  - `SPAWN {"id":"toolu_01XDpe…","workflow":{"runId":"wf_e1777de3-314","agentIndex":2},…}`
  - Conclusão: `workflow.runId` e `agentIndex` chegam ao `agent.spawn`; os dois agentes do run têm o MESMO `tool_use_id` (o da chamada `Workflow`). O plugin usa `tool_use_id:runId:agentIndex` como id do registro, senão os cards se fundem. Nenhum campo de fase, rodada ou nome. A visão Workflow agrupa por `runId` e declara as fases indisponíveis.
- Probe 5 (mesma mod; `agent.spawn` rodando `$.process.run(argv, {cwd, timeoutMs: 2000})` no worktree de trabalho): `rev-parse --abbrev-ref --symbolic-full-name @{upstream} => {"exit":0,"out":"origin/main","ms":20}`; `symbolic-ref --short refs/remotes/origin/HEAD => {"exit":0,"out":"origin/main","ms":17}`; `rev-list --count origin/main..HEAD => {"exit":0,"out":"0","ms":19}`; `rev-list --count HEAD~3..HEAD => {"exit":0,"out":"6","ms":19}`. Base = upstream, senão `origin/HEAD`; sem nenhuma das duas, sem `+N`. Não provado: git lento (o limite de 2 s é do plugin, `Promise.race`) e o App.
- Probe 6 (mesma execução): `$.session.usage()` => `{"cost":{"usd":0.0005161300000000001}}` no terminal. O USD da SESSÃO existe no CLI; o custo por agente segue `no`. O cabeçalho mostra o `~$` da sessão só quando esta leitura vem (`cost.usd` numérico). App: não executado, `not-verified`.

## Decisão e consequências
1. AC-002 disparou: Pause e openInChat são `no`; Stop, Retry, Allow e Decline são `not-verified`. Nenhum é `yes` em `CAPABILITIES` (`plugins/agent-office/hooks/capabilities.ts`, `canUse` falso) (T-011/T-012 não expõem esses controles). Pergunta ao usuário registrada abaixo.
2. Retry é `not-verified`: a retomada por id foi provada com o modelo chamando `SendMessage`, e a mod chamando `$.session.send` não foi entregue (Probe 3). Sem prova de que a mod dispara a retomada, T-012 não renderiza Retry (Unresolved 1 segue aberta).
3. Custo por agente é `no`: o engine só dá tokens por agente. Coluna mostra `—` (Unresolved 4 segue aberta para o usuário).
4. Tempo por ferramenta, tokens por agente e evento de permissão são `yes` no terminal, provados em `claude -p` (Probe 2). Diálogo humano pendente segue não provado.
5. Workflow sem fases: T-008 não mostra fase, rodada nem total. A visão agrupa por `workflow.runId` na ordem de `agentIndex` (provados na Probe 4) e diz "Fases: indisponíveis"; o id do registro inclui o índice (mesmo `tool_use_id` por run). Lacuna para o usuário: nome do workflow, fases e rodada não têm fonte no engine 2.1.311.
6. Commits à frente: só terminal (`process.run` é CLI), provado na Probe 5. Base = upstream ou `origin/HEAD`; a contagem roda em segundo plano, com 2 s de limite e 30 s de cache por worktree (falha também fica em cache). App mostra ausência, conforme `spec/06-gaps.md` linha 8.
7. Versão: tipo 2.1.292, CLI 2.1.311, mapa 2.1.287. Qualquer mudança de build invalida esta matriz; recheck na próxima build.

## Total da sessão (T-003)
- `SessionCost` (`index.d.ts:10904`) é só `usd`: não traz tokens, então não serve de total de tokens. O total real vem de somar os `turn.step` com `agentId` (por agente) e os sem `agentId` (sessão principal), ambos provados na repetição da Probe 2 (`TURNSTEP agentId=- idx=0 usage={...}` e `TURNSTEP agentId=afaa7f... idx=0 usage={...}`).
- Correção na integração T-007 a T-010: `register.tsx` só lia `usage` quando o passo tinha `agentId`, então o átomo `sessionTokens` nunca recebia o turno principal e o total ficava `parcial` para sempre; agora lê sempre (teste de registro em `integration.test.ts`).
- Regra: `totals.tokens` = soma por agente + tokens do turno principal (átomo `sessionTokens`, `register.tsx`). Se a figura do turno principal não foi capturada, ou algum agente é desconhecido, `totals.partial = true`: nunca se apresenta como completo.
- Decisão (T-004): o total conta tokens novos = `input_tokens` + `output_tokens` + `cache_creation_input_tokens`. `cache_read_input_tokens` fica de fora: o mesmo contexto em cache é relido a cada passo e inflava o total (ex.: 8252 lidos para 2 de entrada na Probe 2). Não verificado: comparar com `/cost` em sessão interativa.
- AC-009 (memória): a captura grava só via `update($, atom, ...)` (átomos de estado do plugin, `register.tsx`) e `capture.ts` não importa `$.fs`, `$.store` nem `$.net`; não há escrita em disco nem rede no caminho. Não verificado: se o engine persiste átomos por conta própria (comportamento interno do engine, não observado).

## Decisões do usuário (2026-11-05, finais)
1. Controles: provar em sessão real primeiro, entregar só o provado, trazer cada lacuna ao usuário. Outras tasks seguem.
2. Custo: tokens por agente mais total real da sessão; custo por agente fica `—`; sem tabela de preço.

## Perguntas ao usuário (AC-002) - respondida acima
ASK: Pause, Stop, Allow, Decline e openInChat sem suporte comprovado no engine 2.1.292; como seguir para T-011 e T-012? | Seguir sem esses controles (recomendado, controle não aparece); Provar por probe em sessão real antes de T-011; Remover esses controles da spec

## Decisão do usuário (2026-11-14): needs-you
`needs-you` fica oculto até o engine distinguir um diálogo humano pendente: `tool.check` dispara a cada decisão de permissão, não só no diálogo, então nenhum produtor emite esse estado.

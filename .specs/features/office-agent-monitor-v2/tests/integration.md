---
type: integration
status: TODO
progress: 0/50
updated: 2026-11-05
covers: [AC-001..AC-050]
contract: test-flow/1
---
# Testes — integração — office-agent-monitor-v2

Kit `claude-code/testing` de `claude plugin test`, sem banco. Hook real e `$` de teste. T-001 é provado por sessão real, ver `e2e-flow.md`.

| ID | Scenario | Given/When/Then | Covers | Level | State | Cleanup | Status |
|---|---|---|---|---|---|---|---|
| I-001 | Success | Dado o plugin carregado em uma sessão real com um subagente em execução; quando o spike exercita cada ação e cada evento listados; então a ADR mostra um veredito e uma evidência para cada capacidade | AC-001 | integration | no | - | TODO |
| I-002 | Deviation | Dado o engine não oferece uma forma de pausar um agente; quando o spike conclui o veredito de pausa; então a capacidade fica falsa e a lacuna é levada ao usuário | AC-002 | integration | no | - | TODO |
| I-003 | Error | Dado nenhuma sessão do app Claude disponível para o teste; quando o spike chega às linhas do app; então as linhas ficam como não verificadas e nada é declarado suportado | AC-003 | integration | no | - | TODO |
| I-004 | Success | Dado a lista de agentes de uma sessão com pai e filhos; quando os renderizadores de terminal e app desenham; então os dois leem o mesmo modelo e a saída atual não muda | AC-004 | integration | no | - | TODO |
| I-005 | Deviation | Dado um agente cujo pai saiu pelo limite de 60 entradas; quando o modelo é montado; então o agente aparece como raiz com seus filhos | AC-005 | integration | no | - | TODO |
| I-006 | Error | Dado um agente com horário de início inválido; quando o modelo é montado; então o agente aparece com tempo desconhecido e o painel segue funcionando | AC-006 | integration | no | - | TODO |
| I-007 | Success | Dado um agente que roda Read e depois Bash; quando as duas chamadas terminam; então a linha do tempo tem dois passos em ordem, cada um com sua duração | AC-007 | integration | no | - | TODO |
| I-008 | Deviation | Dado um agente sem dado de tokens na superfície; quando o modelo é montado; então tokens e custo ficam desconhecidos, não zerados | AC-008 | integration | no | - | TODO |
| I-009 | Error | Dado um erro interno na captura de um passo; quando a ferramenta responde; então o agente recebe o resultado normal e o passo é omitido | AC-009 | integration | no | - | TODO |
| I-010 | Success | Dado um prompt que contém um token de API; quando o agente é registrado; então o estado guarda só a versão mascarada | AC-010 | integration | no | - | TODO |
| I-011 | Deviation | Dado a variável de captura não definida; quando uma ferramenta termina; então nenhuma entrada ou saída é guardada e o detalhe explica como ligar | AC-011 | integration | no | - | TODO |
| I-012 | Error | Dado um texto que faz o mascaramento falhar; quando o texto é capturado; então o original não entra no estado | AC-012 | integration | no | - | TODO |
| I-013 | Success | Dado a captura ligada pelo usuário; quando uma ferramenta termina; então entrada e saída ficam mascaradas e limitadas, sem arquivo novo em disco | AC-013 | integration | no | - | TODO |
| I-014 | Success | Dado um agente em cada um dos oito estados; quando a árvore é desenhada; então cada estado mostra forma, nome e cor da tabela, sem depender só da cor | AC-014 | integration | no | - | TODO |
| I-015 | Deviation | Dado o terminal em modo ASCII sem cor; quando a árvore é desenhada; então só aparecem glifos ASCII e o estado continua identificável | AC-015 | integration | no | - | TODO |
| I-016 | Error | Dado um estado que a tabela não conhece; quando a linha é desenhada; então o painel continua, com o estado marcado como desconhecido | AC-016 | integration | no | - | TODO |
| I-017 | Success | Dado a visão de árvore aberta em terminal e app; quando o usuário consulta os atalhos; então as letras coincidem nos dois lados | AC-017 | integration | no | - | TODO |
| I-018 | Success | Dado um orquestrador com quatro filhos, um falho e um pedindo decisão; quando a árvore é aberta; então a decisão e a falha aparecem acima da árvore com suas teclas | AC-018 | integration | no | - | TODO |
| I-019 | Deviation | Dado 21 irmãos rodando; quando a árvore é desenhada e o usuário aperta g; então primeiro aparece o grupo colapsado, depois todos | AC-019 | integration | no | - | TODO |
| I-020 | Error | Dado uma sessão sem agentes; quando o painel é aberto; então aparece a mensagem de vazio com as teclas válidas | AC-020 | integration | no | - | TODO |
| I-021 | Success | Dado dois worktrees e a branch principal com agentes; quando a visão Worktrees é aberta; então cada grupo mostra seus agentes e sua saúde | AC-021 | integration | no | - | TODO |
| I-022 | Deviation | Dado um agente cuja definição pede worktree; quando ele edita um arquivo dentro de `.claude/worktrees`; então ele aparece no grupo da worktree certa | AC-022 | integration | no | - | TODO |
| I-023 | Error | Dado o git indisponível naquela superfície; quando a visão Worktrees é atualizada; então o divisor aparece sem a contagem de commits | AC-023 | integration | no | - | TODO |
| I-024 | Success | Dado um workflow em execução com três fases; quando a visão Workflow é aberta; então as fases aparecem ligadas, com a contagem de cada uma | AC-024 | integration | no | - | TODO |
| I-025 | Deviation | Dado uma sessão só com agentes avulsos; quando a visão Workflow é aberta; então aparece a mensagem, sem fases | AC-025 | integration | no | - | TODO |
| I-026 | Error | Dado um workflow cujo formato mudou; quando o evento chega; então os agentes aparecem em lista simples e nenhuma fase é inventada | AC-026 | integration | no | - | TODO |
| I-027 | Success | Dado um agente concluído com passos; quando o usuário aperta Enter nele; então o detalhe aparece na ordem do Padrão e b volta à lista | AC-027 | integration | no | - | TODO |
| I-028 | Deviation | Dado um agente sem total conhecido; quando o progresso é desenhado; então aparecem segmentos e nenhum percentual | AC-028 | integration | no | - | TODO |
| I-029 | Error | Dado um agente aberto que sai pelo limite de 60; quando a tela é atualizada; então a lista volta com um aviso | AC-029 | integration | no | - | TODO |
| I-030 | Deviation | Dado dois agentes concluídos com o mesmo modelo; quando o cabeçalho é desenhado; então nenhuma estimativa de término aparece | AC-030 | integration | no | - | TODO |
| I-031 | Success | Dado agentes com tokens conhecidos; quando a visão Custo é aberta; então cada linha mostra os valores com til e o total aparece no topo | AC-031 | integration | no | - | TODO |
| I-032 | Deviation | Dado um agente sem dado de custo entre outros com dado; quando a visão Custo é aberta; então o agente mostra traço e o total indica que é parcial | AC-032 | integration | no | - | TODO |
| I-033 | Error | Dado uma sessão sem nenhum dado de custo; quando as visões são abertas; então o total fica em traço e as ferramentas seguem listadas | AC-033 | integration | no | - | TODO |
| I-034 | Success | Dado um agente pedindo para publicar uma release; quando o usuário aperta 1; então só aquela chamada é permitida e o agente volta a rodar | AC-034 | integration | no | - | TODO |
| I-035 | Deviation | Dado o usuário responde no diálogo nativo; quando a resposta é dada; então o painel limpa a pendência sem responder de novo | AC-035 | integration | no | - | TODO |
| I-036 | Error | Dado o engine recusa a resposta enviada; quando o usuário aperta 2; então a mensagem aparece e a decisão continua pendente | AC-036 | integration | no | - | TODO |
| I-037 | Deviation | Dado um pedido pendente; quando o usuário aperta 2 e o engine confirma; então o agente segue sem executar o comando | AC-037 | integration | no | - | TODO |
| I-038 | Success | Dado um agente rodando com parar suportado; quando o usuário aperta x e depois y; então aparece enviando e o estado vira Interrompido só após a resposta | AC-038 | integration | no | - | TODO |
| I-039 | Deviation | Dado a pergunta de parar aberta; quando o usuário aperta n; então nada é enviado e o estado continua igual | AC-039 | integration | no | - | TODO |
| I-040 | Error | Dado o engine devolve erro ao parar; quando o usuário confirma; então a mensagem aparece e o estado anterior fica | AC-040 | integration | no | - | TODO |
| I-041 | Deviation | Dado o engine sem suporte a pausa; quando o detalhe é aberto; então pausar não aparece no rodapé nem nos botões | AC-041 | integration | no | - | TODO |
| I-042 | Success | Dado um painel com largura de 100 colunas; quando a largura cai para 60; então o conteúdo passa ao modo compacto sem perder estado | AC-042 | integration | no | - | TODO |
| I-043 | Deviation | Dado um container de 390 px; quando o usuário abre um agente; então o detalhe cobre a lista e os cards viram linhas | AC-043 | integration | no | - | TODO |
| I-044 | Error | Dado nenhuma largura informada; quando o painel é desenhado; então falha e decisão aparecem primeiro em uma coluna | AC-044 | integration | no | - | TODO |
| I-045 | Success | Dado um agente rodando que pede decisão; quando o pedido chega; então o spinner segue e o sino toca uma única vez | AC-045 | integration | no | - | TODO |
| I-046 | Deviation | Dado o movimento reduzido ligado; quando um agente roda; então nada se move e a tela atualiza uma vez por segundo | AC-046 | integration | no | - | TODO |
| I-047 | Error | Dado uma superfície sem transição; quando o usuário troca de visão; então a tela muda direto, sem erro | AC-047 | integration | no | - | TODO |
| I-048 | Success | Dado a versão nova do plugin; quando o usuário lê o README; então encontra teclas, variáveis e limites reais | AC-048 | integration | no | - | TODO |
| I-049 | Deviation | Dado um teste falhando em uma PR; quando o CI roda com o CLI disponível; então o job fica vermelho | AC-049 | integration | no | - | TODO |
| I-050 | Error | Dado o CI sem o binário; quando o passo de teste roda; então o log diz que os testes foram pulados | AC-050 | integration | no | - | TODO |

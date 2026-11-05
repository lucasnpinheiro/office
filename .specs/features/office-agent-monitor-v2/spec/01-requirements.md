---
spec_id: SPEC-OFFICE-V2
prd_id: PRD-USER-2026-11-05
approval: draft
status: TODO
progress: 0/15
updated: 2026-11-05
generated_by: tlc-spec-driven
---
# Feature Spec — office-agent-monitor-v2

## Problema
Ver `spec.md`. O monitor não sabe tempo por ferramenta, tokens, workflows nem pedidos de permissão, e não age sobre agentes.

## Objetivos
Ver `spec.md`.

## Fora de escopo
Ver `spec.md`.

## Premissas
| Assumption | Default | Rationale |
|---|---|---|
| Tecla de pausa ausente no canvas | `u` pausa e retoma | `p` já é irmão anterior (Foundations5) |
| Conflito de `y` e `n` | Confirmação aberta tem prioridade sobre copiar e próximo irmão | Term5 usa as duas funções |
| Recusar | Agente segue rodando, sem Interrompido | Texto do Proto5 prevalece sobre a simulação, que marca parado |
| Frequência no modo compacto | 6 quadros/s, trocando os 250 ms de `office.ts:71` | Foundations5 define uma só taxa |
| Limite de linhas por agente | 200 passos em memória | Teto de memória; valor próprio, ajustável |
| Limite de entrada e saída | 2000 caracteres por campo | Valor próprio; só com opt-in |
| Colapso de irmãos | Mais de 8 linhas iguais | Responsive5 cita ×21 e não dá limiar |

## Histórias de usuário
### US-01 — Saber o que o engine permite antes de construir (REQ-001, T-001)
**Acceptance Criteria**
1. WHEN o spike termina, the system SHALL publicar a ADR 0002 com uma linha para cada capacidade de `CapabilityKey`, cada uma com veredito `yes`, `no` ou `not-verified` e evidência (`file:line` do tipo e trecho do log da execução). (AC-001)
2. IF uma ação Pause, Stop, Retry, Allow, Decline ou open-in-chat não tiver suporte, the system SHALL gravar `false` em `CAPABILITIES` e escalar ao usuário com `ASK:` antes de T-011 e T-012. (AC-002)
3. IF a superfície do app Claude não puder ser executada no spike, the system SHALL registrar `not-verified` e tratar a capacidade como falsa naquela superfície. (AC-003)
### US-02 — Uma fonte de dados para os dois renderizadores (REQ-002, T-002)
**Acceptance Criteria**
1. The system SHALL calcular a tela a partir de `buildRunModel(agents, now, caps)`, função pura sem `$`, sem relógio e sem E/S, mantendo verdes os 147 testes de base. (AC-004)
2. WHEN um agente citar um pai ausente da lista, the system SHALL tratá-lo como raiz sem perdê-lo. (AC-005)
3. IF um registro de agente trouxer horário inválido, the system SHALL manter o nó com tempo `—` e não lançar exceção. (AC-006)
### US-03 — Ver o que cada agente fez, quanto durou e quanto gastou (REQ-003, T-003)
**Acceptance Criteria**
1. WHEN uma chamada de ferramenta termina, the system SHALL acrescentar ao agente um `ToolStep` com ferramenta, rótulo, início, `durationMs` e resultado, na ordem de início. (AC-007)
2. WHERE a fonte de tokens ou custo não existir para o agente, the system SHALL manter o campo `undefined` e nunca zero. (AC-008)
3. IF a captura falhar durante uma chamada, the system SHALL devolver o resultado da ferramenta inalterado e não gravar nada em disco nem em rede. (AC-009)
### US-04 — Inspecionar agentes sem expor segredos (REQ-004, T-004)
**Acceptance Criteria**
1. WHEN um prompt ou rótulo de comando for capturado, the system SHALL substituir cada segredo reconhecido por `••••••••` antes de guardar o texto no estado. (AC-010)
2. WHILE `OFFICE_CAPTURE_IO` for diferente de `1`, the system SHALL não guardar entrada nem saída de ferramentas e SHALL mostrar a nota de desligado no detalhe. (AC-011)
3. IF o mascaramento falhar, the system SHALL guardar `[mascaramento falhou]` no lugar do texto original. (AC-012)
4. WHEN `OFFICE_CAPTURE_IO=1`, the system SHALL guardar entrada e saída mascaradas e limitadas a 2000 caracteres por campo, somente em memória, e `docs/privacy.md` SHALL declarar esse comportamento. (AC-013)
### US-05 — Mesmo nome e mesma forma em terminal e app (REQ-005, T-005)
**Acceptance Criteria**
1. The system SHALL exibir cada estado de `RunState` com o mesmo rótulo, glifo e cor do Padrão nas duas superfícies. (AC-014)
2. WHERE `OFFICE_ASCII=1` ou `NO_COLOR` estiver definido, the system SHALL usar a coluna ASCII (`[??]`, `[!!]`, `[xx]`, `[ok]`) e conectores `+ - :` sem caracteres de cor. (AC-015)
3. IF um estado desconhecido chegar ao renderizador, the system SHALL desenhar o rótulo em `muted` com glifo `?` e não lançar exceção. (AC-016)
4. WHEN uma visão é desenhada, the system SHALL derivar rodapé e botões do mesmo `KEY_MAP`, com a mesma letra para a mesma ação nas duas superfícies. (AC-017)
### US-06 — Enxergar pais, filhos e o que pede ação (REQ-006, T-006)
**Acceptance Criteria**
1. WHEN há agentes e subagentes, the system SHALL desenhar a árvore com conectores `├ └`, cabeçalho com tempo, rodando e custo, e `◆`/`✗` fixados no topo com a tecla da ação. (AC-018)
2. WHEN irmãos com mesmo estado excederem 8 linhas, the system SHALL colapsá-los em `Rodando ×N` e a tecla `g` SHALL alternar para todos. (AC-019)
3. IF não houver agente na sessão, the system SHALL mostrar o estado vazio sem barra de progresso. (AC-020)
### US-07 — Saber quem está em cada worktree e o que falta integrar (REQ-007, T-007)
**Acceptance Criteria**
1. WHEN agentes rodam em worktrees, the system SHALL agrupá-los por branch sob divisor com quantidade, falhas, arquivos e `base <branch> +N commits`. (AC-021)
2. WHEN um agente tiver isolamento vindo da própria definição, sem `isolation` na chamada, the system SHALL reconhecê-lo pelo caminho do primeiro arquivo ou pelo `cwd` como agente de worktree. (AC-022)
3. IF `$.process` não existir ou o git falhar ou passar de 2 s, the system SHALL omitir `+N commits` sem mostrar zero. (AC-023)
### US-08 — Acompanhar um workflow por fases (REQ-008, T-008)
**Acceptance Criteria**
1. WHEN o evento provado na ADR 0002 trouxer um workflow, the system SHALL mostrar nome, rodada, fases na ordem com `feitos/total` e os agentes da fase atual. (AC-024)
2. WHEN a sessão não tiver workflow, the system SHALL mostrar `Nenhum workflow nesta sessão` e nenhuma fase. (AC-025)
3. IF os dados do workflow vierem em formato não reconhecido ou faltar nome de fase, the system SHALL listar os agentes sem fases e não inventar nome nem total. (AC-026)
### US-09 — Entender um agente sem abrir o chat (REQ-009, T-009)
**Acceptance Criteria**
1. WHEN um agente é aberto, the system SHALL mostrar, nesta ordem, trilha, estado, persona e modelo, worktree, tempo, tokens, custo, erro, linha do tempo, dependências e prompt mascarado. (AC-027)
2. WHEN o total de passos não for conhecido, the system SHALL mostrar só os segmentos feitos, sem percentual e sem promessa. (AC-028)
3. IF o agente selecionado sair da lista, the system SHALL voltar à lista com aviso sem quebrar. (AC-029)
4. WHILE houver menos de 3 agentes concluídos do mesmo modelo, the system SHALL não mostrar ETA. (AC-030)
### US-10 — Ver o gasto e o uso de ferramentas (REQ-010, T-010)
**Acceptance Criteria**
1. WHEN a visão Custo é aberta, the system SHALL mostrar por agente barra de tempo, tokens, `~$` e tempo, e no topo total, tokens e o mais caro. (AC-031)
2. WHERE um agente não tiver tokens ou custo, the system SHALL mostrar `—` e o total SHALL somar só os conhecidos com a marca `parcial`. (AC-032)
3. IF nenhum agente tiver dado, the system SHALL mostrar `—` no total e nunca `~$0,00`; na visão Ferramentas SHALL ainda listar contagem e duração. (AC-033)
### US-11 — Responder pedidos de permissão pelo painel (REQ-011, T-011)
**Acceptance Criteria**
1. WHEN um agente pedir permissão, the system SHALL marcá-lo `◆`, mostrar o comando mascarado com `1 Permitir`, `2 Recusar`, `3 Ver detalhe`, e aplicar a resposta só àquela chamada. (AC-034)
2. WHEN o pedido for respondido em outro lugar, ou `CAPABILITIES.allow` ou `decline` for falso, the system SHALL remover o `◆` respondido e não desenhar opção sem suporte, mantendo o diálogo nativo. (AC-035)
3. IF o engine rejeitar a resposta, the system SHALL mostrar a mensagem no card e manter `◆`. (AC-036)
4. WHEN o usuário recusar, the system SHALL entregar a recusa ao agente e mantê-lo `Rodando`, sem marcá-lo como Interrompido. (AC-037)
### US-12 — Agir sobre um agente sem sair do painel (REQ-012, T-012)
**Acceptance Criteria**
1. WHEN o usuário confirmar uma ação suportada, the system SHALL mostrar `Enviando…` e só mudar o estado do card quando o engine responder. (AC-038)
2. WHILE a confirmação estiver aberta, the system SHALL interpretar `y` e `n` como resposta, e `n` SHALL cancelar sem chamar o engine. (AC-039)
3. IF o engine recusar ou falhar, the system SHALL mostrar a mensagem no card e manter o estado anterior. (AC-040)
4. WHERE `CAPABILITIES` for falso para uma ação, the system SHALL não desenhar botão nem tecla dessa ação em nenhuma superfície. (AC-041)
### US-13 — Usar o painel em qualquer largura (REQ-013, T-013)
**Acceptance Criteria**
1. WHEN a largura mudar, the system SHALL usar 100+ colunas completo, 60 a 99 compacto, abaixo de 60 só lista, e no app 1, 2, 3 e 4 colunas em 0, 520, 780 e 1040 px de container. (AC-042)
2. WHERE o container tiver menos de 900 px, the system SHALL abrir o detalhe sobre a lista, e abaixo de 520 px SHALL trocar cards por linhas de status, nome e tempo. (AC-043)
3. IF a largura for desconhecida ou zero, the system SHALL usar o layout de uma coluna, encolher primeiro o `agora` e manter custo, tempo, falha e decisão visíveis. (AC-044)
### US-14 — Perceber mudanças sem distração (REQ-014, T-014)
**Acceptance Criteria**
1. WHILE houver agente rodando, the system SHALL animar o spinner a 6 quadros/s; WHEN surgir `◆`, the system SHALL subi-lo ao topo e soar o sino uma vez. (AC-045)
2. WHERE `OFFICE_REDUCED_MOTION`, `CI` ou o movimento reduzido do sistema estiverem ativos, the system SHALL usar ponto fixo e 1 quadro/s. (AC-046)
3. IF a superfície não aceitar um efeito, the system SHALL trocar direto de estado, sem erro e sem simular. (AC-047)
### US-15 — Instalar e confiar no plugin (REQ-015, T-015)
**Acceptance Criteria**
1. WHEN a entrega termina, the system SHALL ter no README todas as teclas, variáveis `OFFICE_*`, capacidades ausentes e a nota de não verificado do app. (AC-048)
2. WHERE `claude plugin test` estiver disponível no CI, the system SHALL fazer a falha de teste bloquear o job. (AC-049)
3. IF o CLI não existir no CI, the system SHALL registrar `skipped` de forma explícita e nunca `pass`. (AC-050)

## Casos de borda
Lista completa em `spec/02-research.md`. Principais: agente sai pelo limite de 60; dois pedidos de permissão simultâneos; resposta nativa concorrendo com a do painel; largura zero.

## Rastreabilidade
Matriz em `spec.md`. Cada AC tem cenário 1:1 em `acceptance/` e linha em `tests/integration.md`.

## Critérios de sucesso
Todos os ACs verdes, nenhuma falha nova sobre os 147 testes de base, e smoke por tela registrada em `tests/ui-design.md`. App Claude só conta como verificado depois de executado.

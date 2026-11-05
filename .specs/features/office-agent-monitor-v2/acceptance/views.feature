# language: pt
# status: TODO
# progress: 0/16
# updated: 2026-11-05
Funcionalidade: Visões do monitor

  @T-006 @success @AC-018
  Cenário: S-018 um orquestrador com quatro filhos, um falho e um pedindo decisão
    Dado um orquestrador com quatro filhos, um falho e um pedindo decisão
    Quando a árvore é aberta
    Então a decisão e a falha aparecem acima da árvore com suas teclas

  @T-006 @deviation @AC-019
  Cenário: S-019 21 irmãos rodando
    Dado 21 irmãos rodando
    Quando a árvore é desenhada e o usuário aperta g
    Então primeiro aparece o grupo colapsado, depois todos

  @T-006 @error @AC-020
  Cenário: S-020 uma sessão sem agentes
    Dado uma sessão sem agentes
    Quando o painel é aberto
    Então aparece a mensagem de vazio com as teclas válidas

  @T-007 @success @AC-021
  Cenário: S-021 dois worktrees e a branch principal com agentes
    Dado dois worktrees e a branch principal com agentes
    Quando a visão Worktrees é aberta
    Então cada grupo mostra seus agentes e sua saúde

  @T-007 @deviation @AC-022
  Cenário: S-022 um agente cuja definição pede worktree
    Dado um agente cuja definição pede worktree
    Quando ele edita um arquivo dentro de `.claude/worktrees`
    Então ele aparece no grupo da worktree certa

  @T-007 @error @AC-023
  Cenário: S-023 o git indisponível naquela superfície
    Dado o git indisponível naquela superfície
    Quando a visão Worktrees é atualizada
    Então o divisor aparece sem a contagem de commits

  @T-008 @success @AC-024
  Cenário: S-024 um workflow em execução com três fases
    Dado um workflow em execução com três fases
    Quando a visão Workflow é aberta
    Então as fases aparecem ligadas, com a contagem de cada uma

  @T-008 @deviation @AC-025
  Cenário: S-025 uma sessão só com agentes avulsos
    Dado uma sessão só com agentes avulsos
    Quando a visão Workflow é aberta
    Então aparece a mensagem, sem fases

  @T-008 @error @AC-026
  Cenário: S-026 um workflow cujo formato mudou
    Dado um workflow cujo formato mudou
    Quando o evento chega
    Então os agentes aparecem em lista simples e nenhuma fase é inventada

  @T-009 @success @AC-027
  Cenário: S-027 um agente concluído com passos
    Dado um agente concluído com passos
    Quando o usuário aperta Enter nele
    Então o detalhe aparece na ordem do Padrão e b volta à lista

  @T-009 @deviation @AC-028
  Cenário: S-028 um agente sem total conhecido
    Dado um agente sem total conhecido
    Quando o progresso é desenhado
    Então aparecem segmentos e nenhum percentual

  @T-009 @error @AC-029
  Cenário: S-029 um agente aberto que sai pelo limite de 60
    Dado um agente aberto que sai pelo limite de 60
    Quando a tela é atualizada
    Então a lista volta com um aviso

  @T-009 @deviation @AC-030
  Cenário: S-030 dois agentes concluídos com o mesmo modelo
    Dado dois agentes concluídos com o mesmo modelo
    Quando o cabeçalho é desenhado
    Então nenhuma estimativa de término aparece

  @T-010 @success @AC-031
  Cenário: S-031 agentes com tokens conhecidos
    Dado agentes com tokens conhecidos
    Quando a visão Custo é aberta
    Então cada linha mostra os valores com til e o total aparece no topo

  @T-010 @deviation @AC-032
  Cenário: S-032 um agente sem dado de custo entre outros com dado
    Dado um agente sem dado de custo entre outros com dado
    Quando a visão Custo é aberta
    Então o agente mostra traço e o total indica que é parcial

  @T-010 @error @AC-033
  Cenário: S-033 uma sessão sem nenhum dado de custo
    Dado uma sessão sem nenhum dado de custo
    Quando as visões são abertas
    Então o total fica em traço e as ferramentas seguem listadas

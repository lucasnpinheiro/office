# language: pt
# status: TODO
# progress: 0/17
# updated: 2026-11-05
Funcionalidade: Fundação do monitor

  @T-001 @success @AC-001
  Cenário: S-001 o plugin carregado em uma sessão real com um subagente em execução
    Dado o plugin carregado em uma sessão real com um subagente em execução
    Quando o spike exercita cada ação e cada evento listados
    Então a ADR mostra um veredito e uma evidência para cada capacidade

  @T-001 @deviation @AC-002
  Cenário: S-002 o engine não oferece uma forma de pausar um agente
    Dado o engine não oferece uma forma de pausar um agente
    Quando o spike conclui o veredito de pausa
    Então a capacidade fica falsa e a lacuna é levada ao usuário

  @T-001 @error @AC-003
  Cenário: S-003 nenhuma sessão do app Claude disponível para o teste
    Dado nenhuma sessão do app Claude disponível para o teste
    Quando o spike chega às linhas do app
    Então as linhas ficam como não verificadas e nada é declarado suportado

  @T-002 @success @AC-004
  Cenário: S-004 a lista de agentes de uma sessão com pai e filhos
    Dado a lista de agentes de uma sessão com pai e filhos
    Quando os renderizadores de terminal e app desenham
    Então os dois leem o mesmo modelo e a saída atual não muda

  @T-002 @deviation @AC-005
  Cenário: S-005 um agente cujo pai saiu pelo limite de 60 entradas
    Dado um agente cujo pai saiu pelo limite de 60 entradas
    Quando o modelo é montado
    Então o agente aparece como raiz com seus filhos

  @T-002 @error @AC-006
  Cenário: S-006 um agente com horário de início inválido
    Dado um agente com horário de início inválido
    Quando o modelo é montado
    Então o agente aparece com tempo desconhecido e o painel segue funcionando

  @T-003 @success @AC-007
  Cenário: S-007 um agente que roda Read e depois Bash
    Dado um agente que roda Read e depois Bash
    Quando as duas chamadas terminam
    Então a linha do tempo tem dois passos em ordem, cada um com sua duração

  @T-003 @deviation @AC-008
  Cenário: S-008 um agente sem dado de tokens na superfície
    Dado um agente sem dado de tokens na superfície
    Quando o modelo é montado
    Então tokens e custo ficam desconhecidos, não zerados

  @T-003 @error @AC-009
  Cenário: S-009 um erro interno na captura de um passo
    Dado um erro interno na captura de um passo
    Quando a ferramenta responde
    Então o agente recebe o resultado normal e o passo é omitido

  @T-004 @success @AC-010
  Cenário: S-010 um prompt que contém um token de API
    Dado um prompt que contém um token de API
    Quando o agente é registrado
    Então o estado guarda só a versão mascarada

  @T-004 @deviation @AC-011
  Cenário: S-011 a variável de captura não definida
    Dado a variável de captura não definida
    Quando uma ferramenta termina
    Então nenhuma entrada ou saída é guardada e o detalhe explica como ligar

  @T-004 @error @AC-012
  Cenário: S-012 um texto que faz o mascaramento falhar
    Dado um texto que faz o mascaramento falhar
    Quando o texto é capturado
    Então o original não entra no estado

  @T-004 @success @AC-013
  Cenário: S-013 a captura ligada pelo usuário
    Dado a captura ligada pelo usuário
    Quando uma ferramenta termina
    Então entrada e saída ficam mascaradas e limitadas, sem arquivo novo em disco

  @T-005 @success @AC-014
  Cenário: S-014 um agente em cada um dos oito estados
    Dado um agente em cada um dos oito estados
    Quando a árvore é desenhada
    Então cada estado mostra forma, nome e cor da tabela, sem depender só da cor

  @T-005 @deviation @AC-015
  Cenário: S-015 o terminal em modo ASCII sem cor
    Dado o terminal em modo ASCII sem cor
    Quando a árvore é desenhada
    Então só aparecem glifos ASCII e o estado continua identificável

  @T-005 @error @AC-016
  Cenário: S-016 um estado que a tabela não conhece
    Dado um estado que a tabela não conhece
    Quando a linha é desenhada
    Então o painel continua, com o estado marcado como desconhecido

  @T-005 @success @AC-017
  Cenário: S-017 a visão de árvore aberta em terminal e app
    Dado a visão de árvore aberta em terminal e app
    Quando o usuário consulta os atalhos
    Então as letras coincidem nos dois lados

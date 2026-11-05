# language: pt
# status: TODO
# progress: 0/6
# updated: 2026-11-05
Funcionalidade: Layout e movimento

  @T-013 @success @AC-042
  Cenário: S-042 um painel com largura de 100 colunas
    Dado um painel com largura de 100 colunas
    Quando a largura cai para 60
    Então o conteúdo passa ao modo compacto sem perder estado

  @T-013 @deviation @AC-043
  Cenário: S-043 um container de 390 px
    Dado um container de 390 px
    Quando o usuário abre um agente
    Então o detalhe cobre a lista e os cards viram linhas

  @T-013 @error @AC-044
  Cenário: S-044 nenhuma largura informada
    Dado nenhuma largura informada
    Quando o painel é desenhado
    Então falha e decisão aparecem primeiro em uma coluna

  @T-014 @success @AC-045
  Cenário: S-045 um agente rodando que pede decisão
    Dado um agente rodando que pede decisão
    Quando o pedido chega
    Então o spinner segue e o sino toca uma única vez

  @T-014 @deviation @AC-046
  Cenário: S-046 o movimento reduzido ligado
    Dado o movimento reduzido ligado
    Quando um agente roda
    Então nada se move e a tela atualiza uma vez por segundo

  @T-014 @error @AC-047
  Cenário: S-047 uma superfície sem transição
    Dado uma superfície sem transição
    Quando o usuário troca de visão
    Então a tela muda direto, sem erro

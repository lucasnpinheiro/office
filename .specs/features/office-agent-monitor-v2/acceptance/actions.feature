# language: pt
# status: TODO
# progress: 0/8
# updated: 2026-11-05
Funcionalidade: Decisões e ações sobre agentes

  @T-011 @success @AC-034
  Cenário: S-034 um agente pedindo para publicar uma release
    Dado um agente pedindo para publicar uma release
    Quando o usuário aperta 1
    Então só aquela chamada é permitida e o agente volta a rodar

  @T-011 @deviation @AC-035
  Cenário: S-035 o usuário responde no diálogo nativo
    Dado o usuário responde no diálogo nativo
    Quando a resposta é dada
    Então o painel limpa a pendência sem responder de novo

  @T-011 @error @AC-036
  Cenário: S-036 o engine recusa a resposta enviada
    Dado o engine recusa a resposta enviada
    Quando o usuário aperta 2
    Então a mensagem aparece e a decisão continua pendente

  @T-011 @deviation @AC-037
  Cenário: S-037 um pedido pendente
    Dado um pedido pendente
    Quando o usuário aperta 2 e o engine confirma
    Então o agente segue sem executar o comando

  @T-012 @success @AC-038
  Cenário: S-038 um agente rodando com parar suportado
    Dado um agente rodando com parar suportado
    Quando o usuário aperta x e depois y
    Então aparece enviando e o estado vira Interrompido só após a resposta

  @T-012 @deviation @AC-039
  Cenário: S-039 a pergunta de parar aberta
    Dado a pergunta de parar aberta
    Quando o usuário aperta n
    Então nada é enviado e o estado continua igual

  @T-012 @error @AC-040
  Cenário: S-040 o engine devolve erro ao parar
    Dado o engine devolve erro ao parar
    Quando o usuário confirma
    Então a mensagem aparece e o estado anterior fica

  @T-012 @deviation @AC-041
  Cenário: S-041 o engine sem suporte a pausa
    Dado o engine sem suporte a pausa
    Quando o detalhe é aberto
    Então pausar não aparece no rodapé nem nos botões

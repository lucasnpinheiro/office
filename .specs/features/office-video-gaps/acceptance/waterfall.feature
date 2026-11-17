# status: TODO
# progress: 0/3
# updated: 2026-11-17
# language: pt
Funcionalidade: Waterfall igual ao vídeo

  Cenário: Linha agora
    Dado 2 agentes rodando há 60 s e 120 s
    Quando o modo Waterfall é aberto
    Então uma linha vertical "agora" cruza todas as linhas na coluna do instante atual

  Cenário: Quem segura o fim
    Dado 3 agentes e o de "Implementar endpoint PIX" com o maior fim
    Quando o modo Waterfall é aberto
    Então só a linha "Implementar endpoint PIX" mostra a marca "fim"

  Cenário: Agente pendente
    Dado o agente "Revisar segurança" na fila sem ação
    Quando o modo Waterfall é aberto
    Então a linha mostra "aguarda 1ª ação…" e nenhuma barra

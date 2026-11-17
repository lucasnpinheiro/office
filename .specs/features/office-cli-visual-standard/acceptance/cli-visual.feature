# language: pt
Funcionalidade: Visual único do painel CLI
  Esquema do Cenário: rodapé completo e igual em toda aba
    Dado o painel de terminal com 80 colunas e 3 agentes
    Quando abro a aba "<aba>"
    Então o rodapé mostra "g: modo", "o: ordenar" e "q: fechar" sem corte
    E nenhuma linha do rodapé excede a largura menos 2
    Exemplos:
      | aba |
      | Mapa |
      | Árvore |
      | Worktrees |
      | Cards |
      | Waterfall |
      | Custo |
      | Ferramentas |
      | Workflow |
  Cenário: aba longa cabe na altura com indicador
    Dado 40 agentes e um terminal de 24 linhas
    Quando abro a aba "Custo"
    Então vejo no máximo 24 linhas
    E a última linha é o rodapé
    E vejo "↓" seguido do número de linhas escondidas e "mais"
  Cenário: um formato de tempo
    Dado um agente rodando há 3 horas e 9 minutos
    Quando abro "Waterfall" e "Custo"
    Então vejo "3:09" nos dois e nunca "11362s" nem "189:22"
  Cenário: nomes repetidos
    Dado 6 agentes com o nome "QA: teste de regressao"
    Quando abro "Ferramentas"
    Então vejo "#1" até "#6"
  Cenário: linha longa termina em reticências
    Dado um agente com descrição maior que a largura
    Quando abro "Worktrees" com 80 colunas
    Então a linha termina em "…" e não excede 80 colunas

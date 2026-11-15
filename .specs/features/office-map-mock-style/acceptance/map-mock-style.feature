# status: TODO
# progress: 0/4
# updated: 2026-11-15
# language: pt
Funcionalidade: Mapa de tarefas no estilo do mock

  Cenário: Sete filhos formam duas linhas
    Dado uma raiz com 7 filhos diretos
    Quando o Mapa é desenhado
    Então a linha 1 tem 6 cards e a linha 2 começa no sétimo

  Cenário: Largura abaixo do mínimo reduz colunas
    Dado um painel estreito onde cabem menos de 2 cards de 18 colunas
    Quando o Mapa é desenhado
    Então há 1 card por linha, sem texto cortado e sem rolagem horizontal

  Cenário: Nível 10 mostra ocultos
    Dado uma cadeia de 12 níveis
    Quando o Mapa é desenhado
    Então o nível 10 mostra "+N ocultos" e o detalhe do nó oculto abre

  Cenário: Card mostra pill e meta em uma linha
    Dado um agente concluído com persona, modelo e esforço
    Quando o card é desenhado em 18, 26 ou 34 colunas
    Então há pill "Concluído", sem ✓ no título, e nenhum chip é partido

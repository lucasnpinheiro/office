# status: TODO
# progress: 0/3
# updated: 2026-11-16
# language: pt
Funcionalidade: Header com limites de uso

  Cenário: Limites expostos pelo engine
    Dado o engine devolve 4% de uso na janela de 5 h reiniciando em 4 h e 12% semanal reiniciando em 2 d
    Quando o header é desenhado
    Então aparecem "5h 4% · reinicia em 4h" e "Semana 12% · reinicia em 2d"

  Cenário: Engine sem dados de limite
    Dado $.session.usage() sem campo de limite
    Quando o header é desenhado
    Então o header é idêntico ao atual, sem erro e sem zero inventado

  Cenário: Valor inválido
    Dado percentual NaN ou acima de 100
    Quando o header é desenhado
    Então o segmento é omitido

# status: TODO
# progress: 0/3
# updated: 2026-11-15
# language: pt
Funcionalidade: Mapa tidy-tree

  Cenário: Pai centrado sobre os próprios filhos
    Dado uma raiz com 3 filhos, o primeiro com 3 netos e os outros com 1 neto
    Quando o Mapa é desenhado
    Então cada pai fica centrado sobre o seu grupo e os netos ficam agrupados por pai na mesma linha

  Cenário: Concluído aguardando filhos tem borda tracejada
    Dado um agente concluído com um descendente rodando
    Quando o card é desenhado
    Então a borda é tracejada e a legenda explica "Concluído · aguarda filhos"

  Cenário: Barramento por pai com junções
    Dado um pai com 3 filhos
    Quando o Mapa é desenhado
    Então o barramento cobre só os filhos e há "•" em cada queda

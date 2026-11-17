# language: pt
Funcionalidade: Visual único do painel no desktop
  Esquema do Cenário: cabeçalho igual em toda aba
    Dado o painel no desktop sem agentes
    Quando abro a aba "<aba>"
    Então vejo "Office · office · ⎇ main" com custo e "0 falhas"
    E não vejo régua horizontal sem conteúdo
    E o rodapé mostra "G modo · O ordenar · F só falhas · S buscar"
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
  Cenário: rótulo de ferramenta no detalhe
    Dado agente que rodou Skill "office-sim"
    Quando abro o detalhe
    Então vejo "▸ Skill office-sim" e não "Skill Skill"

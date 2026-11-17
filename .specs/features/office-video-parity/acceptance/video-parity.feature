# status: TODO
# progress: 0/3
# updated: 2026-11-17
# language: pt
Funcionalidade: Paridade com o vídeo de demonstração

  Cenário: Abas completas
    Dado o painel aberto no terminal ou no desktop
    Quando o cabeçalho é desenhado
    Então aparecem as abas mapa, tree, grouped, cards, waterfall, cost, tools e workflow

  Cenário: Agrupado sem worktrees
    Dado 3 agentes rodando, 1 concluído, 1 falho e 1 na fila, todos em main
    Quando o modo Agrupado é aberto
    Então aparecem os divisores "Rodando ×3", "Concluído ×1", "Falhou ×1" e "Na fila ×1"

  Cenário: Modo inexistente
    Dado o comando "/office mode xyz"
    Quando é executado
    Então o modo atual é mantido e a ajuda lista os 8 modos

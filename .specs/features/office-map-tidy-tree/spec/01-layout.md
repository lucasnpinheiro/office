---
status: TODO
progress: 0/4
updated: 2026-11-15
---
# Spec 01 — Layout tidy-tree (terminal + app)

- REQ-101 Pai centrado sobre o próprio grupo de filhos; filhos diretamente abaixo; subárvores lado a lado ordenadas; raiz centrada na largura toda; 1 filho = queda reta curta. Terminal já faz (compact.ts:598-619); app alinhar mapTree (register.tsx:752).
- REQ-102 Barramento de cada pai cobre só do 1º ao último filho (hoje inclui a coluna do pai em lo..hi, compact.ts:~655); a vertical do pai encontra o barramento no centro do pai.
- REQ-103 Junção "•" em cada queda de filho (ascii "o"); sem tronco lateral nem laço (linha 1). Linhas 2+ (excedente >6 ou sem largura): D-1.
- REQ-104 Largura: avail por pai como hoje; mínimo 18; abaixo reduz colunas até 1; sem scroll horizontal; j/k scroll mantido; nível 10 "+N ocultos" mantido.

Exemplo-alvo: raiz -> 3 filhos; A com 3 netos no próprio barramento; B com 1 neto reto; C com 1 neto reto; netos todos na mesma linha agrupados por pai (sem sobrepor: largura da subárvore = max(card, soma dos filhos)).
Risco: subárvores largas lado a lado estouram a largura; regra 104 reduz colunas e quebra em linhas (D-1).

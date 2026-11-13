# Spec: Office panel UI (terminal + app Claude)

Fonte: artifact https://claude.ai/artifact/U1AY6NTnk43zRojzo3bxZv (tipo Design, versao 1793876125-6640, rodada 5 + arquivo rodadas 1-4). Lida somente leitura; nao alterada.
Escopo: especificar a UI. Nao implementa nada agora.

## 1. Modelo de dados (uma fonte, dois renderizadores)
- Engine emite eventos da sessao: agent.spawn, tool.call, tool.result (com duracao), permissao, workflow.
- RunModel (estado puro) vira o mesmo modelo para terminal (Line[] em celulas) e app (cards).
- Ja existe: hooks/run-model.ts, hooks/vocabulary.ts, hooks/layout.ts.

## 2. Telas (9 no artifact)
| Tela | Board | Superficie | Conteudo |
|---|---|---|---|
| T1 Sessao iniciando | Main.dc.html | terminal | cabecalho da sessao, progresso |
| T2 Arvore em execucao | TermRun.dc.html | terminal | arvore pai > filhos, barramento pontilhado |
| T3 App painel lateral | App.dc.html | app | conversa + painel agrupado por estado, cartoes largos |
| T4 Fluxo antes/depois | Flow.dc.html | doc | ergonomia e melhorias |
| T5 Fan-out agrupado | TermFan.dc.html / AppFan.dc.html | ambos | barra segmentada, grupos por estado, falha fixa no topo, gaveta de detalhe |
| T6 Lado a lado + status line | TermSplit.dc.html | terminal | monitor ao lado do chat, status line |
| T7 Detalhe do agente | TermDetail.dc.html | ambos | breadcrumb, estado, tempo, tokens, custo, ferramentas, prompt mascarado |
| T8 Todos os cards | TermCards(200).dc.html / AppCards.dc.html | ambos | variante sem agrupar, arvore com irmaos lado a lado |
| T9 Responsivo | Responsive5.dc.html | ambos | cards e detalhe em 1280, 768, 390 |
Extra: Proto/Proto5 (prototipo interativo: run ao vivo, decisao, workflow hier-orchestration, custo/tokens, ferramentas), Term5 (todas as visoes 100 e 60 colunas), Flows5 (fluxos de dados, worktrees, ciclo de vida, acoes), Foundations5 (tokens e padrao), Compat (regras multiplataforma).

## 3. Componentes
- Cabecalho de sessao: nome do projeto, id da sessao, decorrido, ETA, percentual geral.
- Barra segmentada: concluidos, em execucao, falhas, pendentes (substitui 0% por filho).
- Filtros: Tudo, Rodando, Concluidos, Atencao, Falhas (f filtra; g alterna agrupado/todos).
- Card de agente: glifo de estado, tarefa como título (nome completo), chips com ícone: persona (ícone + nome), modelo (🪶 Haiku, 🎼 Sonnet, 👑 Opus) e esforço (🟢 baixo, 🟡 médio, 🔴 alto), barra, ferramenta atual, tempo. Origem: description `<ícone> Persona · <ícone> Modelo · <ícone> esforço: tarefa`; sem esse formato cai em `🤖 Agente` e a description inteira vira o título. Terminal: card de 7 linhas (persona numa linha, modelo · esforço na seguinte); ASCII sem emojis.
- Linha de worktree (divisor de largura total): nome do worktree/branch, contagem.
- Arvore: barramento pai > irmaos, filhos recuados 5 colunas; irmaos folha lado a lado.
- Detalhe: breadcrumb, estado, branch, tempo, tokens, custo, erro, linha do tempo de ferramentas, prompt com segredos mascarados, acoes.
- Acoes na falha: ver log, reenviar em outro modelo (exige confirmacao). Parar: confirmacao na propria linha.
- Decisao pendente: cartao "Precisa de voce" com opcoes 1 Permitir, 2 Recusar, 3 Ver detalhe.
- Gaveta de anexos: texto/log (10 linhas), diff (+ verde, - vermelho), imagem (miniatura), outros (tipo, tamanho, abrir).
- Chip no chat: "↗ #3" abre o no no monitor.
- Legenda e teclas no rodape, uma vez.

## 4. Estados (vocabulario, cor escuro/claro, glifo, ASCII)
| Estado | Rotulo | Glifo | ASCII | Escuro | Claro |
|---|---|---|---|---|---|
| queued | Na fila | ○ | [ ] | #A9ADB5 | #5A5F68 |
| running | Rodando | ⠹ / .. | .. | #7FA9FF | #2257C9 |
| needs-you | Precisa de voce | ◆ | [??] | #F2B84B | #8A5A00 |
| stalled | Parado sem sinal | ▲ | [!!] | #F2B84B | #8A5A00 |
| paused | Pausado | ‖ | || | #A9ADB5 | - |
| failed | Falhou | ✗ | [xx] | #FF8A80 | #B3261E |
| done | Concluido | ✓ | [ok] | #6FD08C | #1B7A3D |
| interrupted | Interrompido | ■ | [--] | #A9ADB5 | - |
| worktree | (marca) | ⧉ | wt: | #BD9BFF | - |
Regra: forma e texto acompanham a cor. Precisa de voce e Parado sem sinal dividem cor com formas diferentes.

## 5. Tokens
- Cores: bg #141517 / #F6F7F8; surface #1C1E21 / #FFFFFF; line #303338 / #DDE0E4; text #ECEEF1 / #17191C; muted #A9ADB5 / #5A5F68; run #7FA9FF / #2257C9; ok #6FD08C / #1B7A3D; wait #F2B84B / #8A5A00; fail #FF8A80 / #B3261E.
- Raio: card 10 (artifact diz 12 em CSS; decidir na implementacao), botao 8, pilula 999.
- Espaco: 4, 8, 12, 16, 24.
- Tipo: IBM Plex Sans e Mono; numeros em mono tabular. Tamanhos mais usados: 14, 12, 13, 16, 20, 18px.
- Movimento: so muda com o estado. Trabalho 900ms linear (spinner 6 quadros/s); ligacao pai-filho 800ms; agente novo 220ms ease-out; decisao pisca 1600ms; foco 160ms; troca de visao crossfade 140ms.
- Reduzido: prefers-reduced-motion (app), OFFICE_REDUCED_MOTION, CI ou nao-TTY.
- Alvos de toque 44px no app.

## 6. Layout e responsivo
- Terminal: 100+ colunas tabela completa; 60-99 compacto; <60 so contagem; <50 so status line.
- App: 1, 2, 3, 4 colunas em 0, 520, 780, 1040px (container). Detalhe lateral >= 900px, abaixo da lista caso contrario.

## 7. Comportamento e regras
- Ordenacao: falhas e atencao sobem ao topo; falha fixa fora do grupo ate resolver.
- ETA: "calculando" ate haver amostra; nunca 0%.
- Ações do usuario: nunca em silencio; confirmacao na linha; estado so muda quando o engine responde; recusa ou erro mantem estado anterior e mostra mensagem. Botao sem suporte do engine nao aparece.
- Privacidade: prompts e saidas so com OFFICE_CAPTURE_IO=1; mascara segredos antes de guardar; tudo em memoria.
- Fallback ASCII: TERM=linux, TERM=dumb, locale nao UTF-8, conhost; forcar com OFFICE_ASCII=1 ou --ascii.
- Teclado: ↑↓ ou j k navegar; Enter abrir; Esc voltar; [ ] irmao; o abre externo; g agrupado/todos; f filtrar; l log; / busca.

## 8. Gap: artifact vs codigo atual (plugins/agent-office, 2026-11-12)
Cobertos (ja existe):
- Vocabulario de estados com glifos, ASCII e cores escuro/claro: hooks/vocabulary.ts.
- Arvore de cards e regras de colunas: hooks/layout.ts (APP_STEPS 1040/780/520/0; TERM 100/60), hooks/view-tree.ts.
- Visoes: view-cost.ts, view-detail.ts, view-tools.ts, view-workflow.ts, view-worktrees.ts.
- Modo reduzido e ASCII: OFFICE_REDUCED_MOTION e OFFICE_ASCII aparecem em 10 arquivos (motion.ts, capabilities.ts).
- Captura com OFFICE_CAPTURE_IO e mascara: capture.ts, mask.ts.
- Status line: status.ts, compact.ts.
- Worktree em roxo: monitor.ts WORKTREE_COLOR = #BD9BFF.
Lacunas:
1. Paleta: compact.ts, view-cost.ts e view-detail.ts usam cores fora dos tokens (#22c55e, #ef4444, #6b7280, #374151, #9ca3af). Artifact pede tokens unicos (ok #6FD08C, fail #FF8A80, muted #A9ADB5). Ajustar para tokens.
2. Tema claro: vocabulary.ts tem valores light, mas compact.ts nao usa a tabela de tokens; faltam bg, surface, line claros.
3. Fonte IBM Plex e numeros tabulares: nao se aplica ao terminal; no app nao ha codigo de CSS neste plugin (sem tela de app propria).
4. Painel nativo no app (T3, T5, T7, T9): cards (T8) ja em Box/Text pela surface; restam gaveta, abas e demais visoes; register.tsx e uma TUI/mod. Falta spec de integracao com o app (cards, gaveta, abas Rodando/Concluidos/Atencao/Falhas).
5. Breadcrumb e navegacao por Esc entre dependencias: so 2 ocorrencias; verificar view-detail.ts.
6. Barra segmentada e contagem por grupo (✓ ● ✗ ○): ETA existe; barra segmentada nao confirmada.
7. Acoes na falha (ver log, reenviar em outro modelo com confirmacao): nao encontrado no grep; falta.
8. Gaveta de anexos com previa, tipos e copiar: nao confirmado; falta.
9. Decisao pendente com 1/2/3 e "Precisa de voce" em cartao: estado existe (needs-you); cartao de decisao nao confirmado.
10. Chip "↗ #3" no chat: nao encontrado.
11. Agrupar/todos (g) e filtros f/l/busca /: grep achou g= em 7 arquivos; confirmar cada tecla.
12. Movimento: durações do artifact (900/800/220/1600/160/140ms) nao conferidas no motion.ts; verificar.
13. Raio: artifact usa 10 (token) e 12 (CSS); decidir um valor.
14. Estado "Parado sem sinal" a partir de 10 min: confirmar limiar em status.ts.

Painel no app (cards Chips5, T8/T9):
- Decisao: o engine nao tem elemento HTML; o app (surface desktop, vscode, mobile) desenha Box/Text graficos. register.tsx escolhe pela `e.surface` (hooks/app-cards.ts isAppSurface); terminal inalterado.
- Card do app: borda arredondada na cor do estado (theme keys: suggestion, error, warning, success, subtle; claro/escuro pelo tema do app), glifo + titulo da tarefa, chips persona/modelo/esforco com icone, linha de estado/ferramenta, barra, percentual e tempo; sem formato na description: chip 🤖 Agente. Clique abre o detalhe.
- Escopo: so a visao cards; arvore, agrupado, custo, ferramentas e workflow seguem em texto no app. Nao verificado visualmente no app (largura 34 fixa, barra por Box width %).

- Causa raiz "nada aparece" (2026-11-13): PR #32/#33 nao subiram a versao; o Claude Code compara versao e manteve o cache 0.15.2 (marketplace clone parado em d946c0c). Corrigido com bump 0.17.0; o usuario roda `claude plugin marketplace update office` e `claude plugin update agent-office@office`, depois reinicia/recarrega.
- Terminal: chips em UMA linha "🎨 UX/UI · 🎼 Sonnet · 🟢 baixo" quando cabem em 32 colunas; senao persona numa linha e "modelo · esforco" na outra; titulo longo da tarefa quebra na segunda linha reservada. Sem prefixo na description, `subagent_type` rapido/padrao/profundo da modelo (Haiku/Sonnet/Opus) e esforco baixo.
- App: chips preenchidos (backgroundColor `userMessageBackground`). `e.surface` e campo real do engine (`desktop`, `mobile`, `vscode`; ausente no terminal).

## 9. Criterios de aceite (para a futura implementacao)
- AC-1: terminal e app mostram o mesmo nome, estado e ordem a partir do mesmo RunModel.
- AC-2: cada estado tem glifo, ASCII e texto, legivel com NO_COLOR.
- AC-3: falha e atencao no topo; falha fixa ate resolver.
- AC-4: sem 0% em filhos; ETA "calculando" sem amostra.
- AC-5: acao do usuario so muda estado apos resposta do engine.
- AC-6: segredos mascarados em prompt e anexo.
- AC-7: layout sem corte de nome (titulo inteiro), 60 colunas minimo no terminal.
- AC-8: movimento desligado com reduced motion.

## 10. Fora de escopo agora
- Implementar UI, alterar artifact, publicar, comentar.

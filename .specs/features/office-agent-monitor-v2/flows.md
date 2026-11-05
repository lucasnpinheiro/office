# Fluxos — office-agent-monitor-v2

Base: Flows5 e Foundations5.

## FLOW-001 Agente e subagente
Ator: quem roda a sessão. Gatilho: `tool.call` de Agent. Passos: spawn, primeira ferramenta, filhos, fim. Estado final: árvore com o resultado de cada nó. Desvio: pai ausente vira raiz.
```mermaid
flowchart TD
  A[Agent chamado] --> B[Na fila] --> C[Rodando]
  C --> D[Subagente aparece recuado]
  D --> E{Resultado}
  E -->|ok| F[Concluído]
  E -->|erro| G[Falhou, sobe ao topo]
```

## FLOW-002 Worktree
Ator: quem acompanha. Gatilho: agente isolado ou caminho dentro de worktree. Passos: reconhecer, agrupar, contar, integrar fora do painel. Estado final: grupo com saúde da branch. Desvio: sem git, sem contagem.
```mermaid
flowchart LR
  O[Orquestrador em main] --> A[worktree spec/a]
  O --> B[worktree spec/b]
  A --> P[PR por worktree]
  B --> P
  P --> M[main]
```

## FLOW-003 Workflow
Ator: quem roda workflow. Gatilho: evento provado em T-001. Passos: detectar, listar fases, atualizar. Estado final: fases com feitos/total. Desvio: sem dado reconhecido, lista simples.
```mermaid
flowchart LR
  D{Dado reconhecido?} -->|sim| F[Fases reais]
  D -->|não| L[Lista de agentes]
  D -->|sem workflow| V[Nenhum workflow nesta sessão]
```

## FLOW-004 Ciclo de vida
Ator: engine e usuário. Gatilho: eventos e ações. Passos: diagrama abaixo. Estado final: `done`, `failed` ou `stopped`. Desvio: nova atividade tira de `stalled`.
```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running: primeira ferramenta
  running --> done: sem erro
  running --> failed: erro
  running --> needs_you: pede permissão
  needs_you --> running: respondeu
  running --> paused: pausar
  paused --> running: retomar
  running --> stopped: parar
  paused --> stopped: parar
  needs_you --> stopped: parar
  failed --> running: repetir
  running --> stalled: 10 min sem atividade
  stalled --> running: nova atividade
```

## FLOW-005 Ação do usuário
Ator: usuário. Gatilho: tecla ou botão. Passos: foco, confirma em linha, enviando, engine responde. Estado final: estado novo no card. Desvio: recusa mantém o estado com mensagem.
```mermaid
flowchart LR
  F[Foco no agente] --> S{Capacidade?}
  S -->|não| O[Controle não aparece]
  S -->|sim| C[Confirma na própria linha]
  C -->|n| F
  C -->|y| E[Enviando]
  E -->|ok| N[Estado novo]
  E -->|erro| M[Mensagem, estado anterior]
```

## FLOW-006 Decisão
Ator: usuário. Gatilho: pedido de permissão. Passos: ◆ no topo, `d`, opção. Estado final: agente volta a rodar. Desvio: resposta em outro lugar limpa a pendência.
```mermaid
flowchart LR
  P[Pedido] --> T[◆ no topo]
  T --> O{Opção}
  O -->|1 Permitir| A[Uma chamada]
  O -->|2 Recusar| R[Agente recebe a recusa e continua]
  O -->|3 Ver detalhe| D[Detalhe]
```

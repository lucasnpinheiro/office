# 0001. RunModel como fonte única das duas superfícies

Status: proposto (2026-11-05). Aguarda aprovação do bundle.

## Contexto
`monitor.ts`, `compact.ts` e `register.tsx` têm 614, 574 e 570 linhas e misturam dados e desenho; `OfficeAgent` e `AgentLike` duplicam o tipo. O canvas (Flows5) pede uma fonte e dois renderizadores.

## Decisão
`buildRunModel` puro produz `RunModel`; `Line`/`Seg` e cards do app só leem dele. Eventos passam por captura e máscara antes do estado. Capacidades entram como dado.

## Alternativa rejeitada
Renderizador do app derivando de `Line[]`: mantém formato de célula como contrato e impede cards reais.

## Consequências
Refatoração primeiro (T-002), sem mudança de saída. Reexportações provisórias até o fim das telas.

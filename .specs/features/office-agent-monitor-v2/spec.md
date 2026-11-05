---
spec_id: SPEC-OFFICE-V2
approval: draft
status: TODO
progress: 0/6
updated: 2026-11-05
---
# Office Agent Monitor v2 — índice

> Executor: 🎯 Product Owner · 👑 Opus · 🟢 baixo

Branch `spec/office-agent-monitor-v2`. Plugin `plugins/agent-office`, versão 0.15.3 (TypeScript/TSX, sem banco).
Fonte de design: canvas https://claude.ai/artifact/U1AY6NTnk43zRojzo3bxZv, página Rodada 5: Proto5, Foundations5, Term5, Flows5, Responsive5.

## Problema
Quem acompanha uma execução no `/office` não vê fluxos de worktree e workflow, nem tempo por ferramenta, tokens ou pedidos de permissão, e não consegue agir sobre um agente: `actions.ts` só altera a interface. Terminal e app não seguem um padrão comum, e o progresso depende de `etaOf` com 2 amostras.

## Objetivos
- Fluxos de worktree, workflow, agente e subagente.
- Detalhe e progresso melhores e honestos (sem % inventado, ETA com 3 amostras, custo com `~`, `—` sem dado).
- Telas e cards responsivos, movimento e UX do canvas.
- Um único padrão para terminal e app Claude.
- Controles completos: Pause, Stop, Retry, Allow, Decline e open-in-chat, sujeitos à prova do engine em T-001.

## Fora de escopo
Criar ou integrar worktrees; iniciar workflows; regras permanentes de permissão; persistir dados; alertas de gasto; qualquer SQL, OpenAPI, k6 ou AdminLTE (not applicable: plugin sem banco, sem HTTP, sem CakePHP).

## Premissas
| Assumption | Default | Rationale |
|---|---|---|
| Suporte do engine | Nenhuma ação é suportada até T-001 provar | Decisão do usuário; regra de não fingir |
| Lista completa | Ver `spec/01-requirements.md` | Evita duplicação |

## Histórias de usuário
Em `spec/01-requirements.md`, 15 histórias com 50 ACs em EARS.

## Casos de borda
Em `spec/02-research.md`.

## Arquivos
| Arquivo | Assunto | status | Requisitos |
|---|---|---|---|
| `spec/01-requirements.md` | histórias e ACs | TODO | todos |
| `spec/02-research.md` | prior art, pesquisa, hipóteses do engine | TODO | todos |
| `spec/03-architecture.md` | arquitetura e segurança | TODO | todos |
| `spec/04-contracts.md` | contratos em tipos TS | TODO | todos |
| `spec/05-ui-design.md` | telas, tokens, teclas, layout, movimento | TODO | REQ-005 a REQ-014 |
| `spec/06-gaps.md` | gaps, Swept, Observable, Unresolved | TODO | todos |
| `flows.md` | FLOW-001 a FLOW-006 com Mermaid | — | todos |
| `tasks/` | 15 tasks | TODO | todos |
| `tests.md`, `tests/*.md` | 9 tipos de teste | TODO | todos |
| `acceptance/*.feature` | 50 cenários | TODO | AC-001 a AC-050 |
| `../../architecture/adr/` | ADR 0001 (RunModel) e 0002 (capacidades, rascunho) | proposto | REQ-001, REQ-002 |

## Rastreabilidade
| REQ | Requisito | AC | Task |
|---|---|---|---|
| REQ-001 | Provar capacidades do engine; controle sem suporte não aparece | AC-001 a 003 | T-001 |
| REQ-002 | RunModel puro como fonte única | AC-004 a 006 | T-002 |
| REQ-003 | Linha do tempo, tokens e custo só em memória | AC-007 a 009 | T-003 |
| REQ-004 | Máscara e opt-in `OFFICE_CAPTURE_IO`, privacy.md | AC-010 a 013 | T-004 |
| REQ-005 | Padrão único: estados, tokens, glifos, teclas | AC-014 a 017 | T-005 |
| REQ-006 | Fluxo de agente e subagente | AC-018 a 020 | T-006 |
| REQ-007 | Fluxo de worktree | AC-021 a 023 | T-007 |
| REQ-008 | Fluxo de workflow | AC-024 a 026 | T-008 |
| REQ-009 | Detalhe e progresso | AC-027 a 030 | T-009 |
| REQ-010 | Custo e ferramentas | AC-031 a 033 | T-010 |
| REQ-011 | Decisões, Allow e Decline | AC-034 a 037 | T-011 |
| REQ-012 | Pause, Stop, Retry e open-in-chat | AC-038 a 041 | T-012 |
| REQ-013 | Telas e cards responsivos | AC-042 a 044 | T-013 |
| REQ-014 | Movimento e reduzido | AC-045 a 047 | T-014 |
| REQ-015 | README, docs e CI | AC-048 a 050 | T-015 |

## Critérios de sucesso
Ver `spec/01-requirements.md`. Estado atual: rascunho (`approval: draft`), validado só estruturalmente pelos scripts; nenhum humano aprovou, e nenhum painel independente foi rodado.

## Skills
- security-engineer: aplica. Máscara, opt-in, resposta de permissão e `$.process` em `spec/03-architecture.md` e `tests/security.md`.
- frontend-architect: aplica ao conceito (telas, estados, responsividade). Bootstrap, AdminLTE e views CakePHP: not applicable, a superfície é Box/Text/Button da mod.
- domain-expert-erp: not applicable — sem regra fiscal ou financeira; custo é estimativa de uso exibida.
- mysql: not applicable — plugin não tem banco; estado em memória.
- code-quality: aplica em conceito; ferramentas PHP not applicable. `compact.ts`, `monitor.ts` e `register.tsx` têm mais de 570 linhas, tratadas em T-002.
- performance: aplica só ao orçamento de quadros, em `spec/03-architecture.md`; k6 not applicable — sem endpoint nem SLA.

## Unresolved
Sete itens em `spec/06-gaps.md`; o item 3 (visão inicial) precisa de resposta do usuário e o item 2 bloqueia T-011 e T-012 até T-001.

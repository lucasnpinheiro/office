# Tasks (DAG)
| ID | REQ | Arquivos | depends_on |
|---|---|---|---|
| T-601 | REQ-601 | hooks/actions.ts footerRows, hooks/register.tsx:698 | - |
| T-602 | REQ-602 | hooks/compact.ts tabsLine/header | - |
| T-603 | REQ-603 | hooks/compact.ts windowBody + modos, hooks/actions.ts (j/k) | T-601 |
| T-604 | REQ-604 | hooks/monitor.ts fmtDur, compact.ts, view-cost.ts, view-detail.ts | - |
| T-605 | REQ-605 | hooks/monitor.ts clipName, view-cost.ts, view-tools.ts, compact.ts | T-604 |
| T-606 | REQ-606 | hooks/compact.ts fit/ellipsis, view-worktrees.ts | - |
| T-607 | REQ-607 | plugins/agent-office/README.md | T-601..T-606 |
Cada PR sai de main (sem pilha), RED→GREEN, CHANGELOG + versão como #106-#109; `depends_on` só ordena o merge. Detalhe por task: T-60x.md.

# HANDOFF — office (2026-11-17)

Phase: spec-research office-video-gaps DONE (TESTS_GENERATED). Next: spec-implement on literal "executar".

- Merged: #98 (0.28.25), #99, #100, #101, #102 (0.28.24), #103, #104; agents#213 (validator wires check-sanitized.test.sh, 120125f).
- Open PRs: none. Live agents: none. Blocked on user: none.
- UNVERIFIED: visual check of #98 grouped view (covered by compact.test.ts only); desktop waterfall (G5, needs the real Claude desktop app).
- Next: T-401..T-404 in .specs/features/office-video-gaps/tasks/.
- Design canvas: https://claude.ai/artifact/U1AY6NTnk43zRojzo3bxZv (board R7_10).

## 2026-11-17 office-desktop-visual-standard (spec-research + executar)
- Spec PR #105 (base main). Tasks: T-501 #106, T-502 #107 (base t501), T-503 #108 (base t501), T-504 #109. Sem CI; suite local 537-538 pass / 0 fail. Validador local `lucasnpinheiro-office.sh` não rodado.
- office-video-gaps T-401..403 já entregues na #102; T-404 só falta a captura real do desktop (UNVERIFIED).
- Designer: artifact U1AY6NTnk43zRojzo3bxZv v35, Rodada 8 (R8_01..R8_05).
- Bloqueado no usuário: aprovar merge em main (#105 e depois a pilha 106→107/108, 109). T-504 vai conflitar no CHANGELOG/README.
- Worktrees vivos: office-wt-t501..t504 (remover após merge).

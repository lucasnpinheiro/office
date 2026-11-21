# HANDOFF — office (2026-11-21)

## 2026-11-21 fix/mask-mysql-redos (0.28.45)
- Found: mysql -p rule quadratic in `hooks/mask.ts` (main: 2662 ms on `'mysql a b c '.repeat(8500)`, 1627 ms on `'mysql -h x -P 3306 '.repeat(6000)`). RED perf tests added to `mask.test.ts`.
- Fixed: options scan bounded to `{0,64}` tokens. After: 2-15 ms on the same inputs. Stated limit: `-p` more than 64 tokens after `mysql` is not masked.
- Differential 0.28.44 vs 0.28.45: 0 changed outputs over ~60k command lines. Reviewer differential: 0 regressions over 278880 cases.
- Open PR: fix/mask-mysql-redos (no merge; orchestrator/user merges per gates). Live agents: none. Blocked on user: merge.

## 2026-11-21 office-video-gaps: phases 7-9 executed (branch spec/office-video-gaps-exec)
- Phase: office-video-gaps DONE. T-401..T-403 were already in #102 (0.28.24); T-404 docs closed in this PR (0.28.42).
- Found: S-401 RED (waterfall label not masked), fixed in `hooks/compact.ts`. B-401 and V-401 passed on first run (pre-existing).
- Coverage: waterfall section of compact.ts 100% lines in node test-runner run (shim for `claude-code/testing`, unit files); gate 93% met. `claude plugin test` has no coverage flag.
- Terminal captures: `scratchpad/vgaps/wf-80x24.png`, `wf-200x60.png`. Desktop app half UNVERIFIED.
- Open PR: the 0.28.42 PR for this branch (no merge; orchestrator/user merges per gates). Live agents: none. Blocked on user: merge.
- Knowledge: `.specs/features/office-video-gaps/knowledge.md`.

## 2026-11-17 (previous round)

Phase: spec-research office-video-gaps DONE (TESTS_GENERATED). Next: spec-implement on literal "executar". (done 2026-11-21)

- Merged: #98 (0.28.25), #99, #100, #101, #102 (0.28.24), #103, #104; agents#213 (validator wires check-sanitized.test.sh, 120125f).
- Open PRs: none. Live agents: none. Blocked on user: none.
- UNVERIFIED: visual check of #98 grouped view (covered by compact.test.ts only); desktop waterfall (G5, needs the real Claude desktop app).
- Next: T-401..T-404 in .specs/features/office-video-gaps/tasks/.
- Design canvas: https://claude.ai/artifact/U1AY6NTnk43zRojzo3bxZv (board R7_10).

## 2026-11-17 office-desktop-visual-standard (spec-research + executar)
- Spec PR #105 (base main). Tasks: T-501 #106, T-502 #107 (base t501), T-503 #108 (base t501), T-504 #109. Sem CI; suite local 537-538 pass / 0 fail. Validador local não rodado.
- office-video-gaps T-401..403 já entregues na #102; T-404 só falta a captura real do desktop (UNVERIFIED).
- Designer: artifact U1AY6NTnk43zRojzo3bxZv v35, Rodada 8 (R8_01..R8_05).
- Bloqueado no usuário: aprovar merge em main (#105 e depois a pilha 106→107/108, 109). T-504 vai conflitar no CHANGELOG/README.
- Worktrees vivos: office-wt-t501..t504 (remover após merge).

## 2026-11-17 office-desktop-visual-standard: merged
- Merged into main: #105 053dd4e, #106 32b060a, #107 3f48ab5, #108 5084f0a, #109 eb7e319 (0.28.26..0.28.29). Suite 536-539 pass / 0 fail; local validator exit 0 on each.
- Worktrees office-wt-t501..t504 removed; merged local branches deleted. Open PRs: none besides the handoff PR. Blocked on user: none.
- UNVERIFIED: visual check of the new chrome/footer/tool line in the real Office panel and desktop app (tests only).

## 2026-11-17 office-cli-visual-standard: merged
- Merged into main: #111 088ab33 (spec), #112 063e43b, #113 7b5ef98, #114 06a6fbc, #115 b6fd2cf, #116 df317d4, #117 3784554 (0.28.30..0.28.35). Suite 539-548 pass / 0 fail; local validator exit 0 on each.
- Plugin agent-office 0.28.35 at user scope (only scope found); restart needed to load it.
- Open: #118 (T-607 readme, no merge marker; worktree office-wt-t607 kept). Blocked on user: approve #118 merge and this handoff PR.
- UNVERIFIED: visual check of footer/tabs/window/time/names/ellipsis in the real Office panel (tests only).

## 2026-11-21 office-dismiss-scroll: merged (docs 0.28.37)
- Merged into main: #123 f09b631 (dismiss alerts), #124 49395da (click scroll). Design artifact U1AY6NTnk43zRojzo3bxZv Rodada 9 v40.
- Docs PR (worktree office-wt-docs, branch docs/dismiss-scroll): README, CHANGELOG 0.28.37, plugin.json 0.28.36 -> 0.28.37 (0.28.36 already taken by README CLI standard on main).
- UNVERIFIED: live panel for dismiss, `e` hotkey, click scroll; Cards-tab scroll targets.
- Worktrees to remove after merge: office-wt-dismiss, office-wt-wheel, office-wt-docs.

## 2026-11-21 office-dismiss-scroll: phase dismiss + click scroll + key audit merged (docs 0.28.38)
- Merged into main: #126 5af72d3 (key audit), #127 7751a84 (dismiss in every view), #128 3b4e62e (click scroll in every tab).
- Design artifact U1AY6NTnk43zRojzo3bxZv Rodada 10: pending/published (check before next round).
- Docs PR (worktree office-wt-docs2, branch docs/views-dismiss-scroll): README (dismiss, click scroll, keyboard shortcuts), CHANGELOG 0.28.38, plugin.json 0.28.37 -> 0.28.38.
- UNVERIFIED: live panel for dismiss, `e` hotkey, click scroll in all tabs, real key delivery and `ctrl+x tab`.
- Open user decisions: remove or implement `y` (copy has no action yet); `g` from Mapa (switches mode to tree, Mapa stays drawn).

## 2026-11-21 office-wheel-copy-g: docs 0.28.39 (PR open, do not merge without gates)
- Merged into main: #130 ab2e1eb (g on Mapa opens Árvore), #131 2fbb142 (y copies the detail), #132 aec8a25 (copy answer shapes), #133 6d173bf (mouse wheel via ui.scroll).
- Design artifact U1AY6NTnk43zRojzo3bxZv Rodada 11.
- Docs PR (worktree office-wt-docs3, branch docs/wheel-copy-g): README (wheel, g to Árvore, y copiar, pt-BR key labels), CHANGELOG 0.28.39, plugin.json 0.28.38 -> 0.28.39.
- Plugin install updated to 0.28.39: final step, after merge (not done in this PR).
- UNVERIFIED: live panel for dismiss, `e`, click scroll, `y` copy real clipboard, wheel natural direction and wheel-up.
- Open decisions: none.

## 2026-11-21 fix/mask-agent-names: mask names in every view (agent-office 0.28.43)
- Choke point: `plugins/agent-office/hooks/run-model.ts` `buildGraph` sets the display name with `maskText` (agent label and task content). All views read that name, so they inherit it. Ids keep dismiss, keys and hidden sets.
- Tests: `hooks/mask-views.test.ts` (per-view RED then GREEN, plus 80-col boundary test). `npm test`: 687 pass, 0 fail.
- Docs bundle office-video-gaps: 0.28.24 replaced by shipped 0.28.42 (original target kept as note).
- PR #138 (https://github.com/lucasnpinheiro/office/pull/138): open, do not merge without gates.
- UNVERIFIED: register.tsx (desktop branch button, d.name) and monitor.ts legacy frame not tested directly; they read the masked run model.
- Known gap: mask.ts token rule needs a non-word char before the prefix (glued `x`*N + `ghp_` not masked).

## 2026-11-21 fix/mask-glued-tokens: secrets glued to letters masked (agent-office 0.28.44)
- Worktree office-wt-maskfix, branch fix/mask-glued-tokens from origin/main (c6ec1af). hooks/mask.ts prefix rules no longer need a non-word char before the prefix; per-pattern body floors in CHANGELOG 0.28.44.
- Tests: hooks/mask.test.ts (16 glued RED then GREEN, FP list), hooks/mask-views.test.ts (glued 80-col boundary), hooks/register-mask.test.ts (new, real Pane render), hooks/monitor.test.ts (legacy frame). npm test: 728 pass, 0 fail.
- UNVERIFIED: register branch chip c.name.slice(0, 14) headless (needs worktree fixture).
- PR open, not merged. Merge needs gates (CI, review SHA marker).

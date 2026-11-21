---
status: DONE
updated: 2026-11-21
---
# Knowledge — office-video-gaps (phase 9)

## Delivered before this bundle ran
- T-401..T-403 (agora column and label, `◂ fim` / `< fim`, `aguarda 1ª ação…`) shipped in PR #102 (0.28.24). The bundle still said TODO; the code already conformed.
- The bundle's `tasks/`, `tests/` and `spec.md` status headers were stale (TODO) against merged code. Fixed in this PR (DONE, progress = done/total).

## Drift between bundle and code
- S-401 (name passes through the same @security mask): code did not mask waterfall labels. RED confirmed (`video-parity.test.ts`, S-401), fixed minimal in `hooks/compact.ts` (`maskText` on the label).
- Tech spec says the ASCII bar is `|` and the mark `< fim`: V-401 now asserts it; no unicode glyph in ASCII rows.
- Waterfall "bar wins" rule: a running bar hides the agora mark on filler-free cells. Intended (spec 01-tech), not a bug.
- REQ-404 (README real capture) is only partly possible: terminal captured, desktop app not captured headless.

## Tests added (TDD)
- B-401 tie on the end (passed on first run: behaviour pre-existing, no RED possible).
- V-401 ASCII caps (passed on first run: pre-existing).
- S-401 masked label (RED, then GREEN after the fix).

## Evidence
- Traceability table: PR body of this PR.
- Terminal captures (real `renderCompact`, not the desktop app): `scratchpad/vgaps/wf-80x24.png`, `scratchpad/vgaps/wf-200x60.png`, source text `scratchpad/vgaps/wf-80x24.txt`, `scratchpad/vgaps/wf-200x60.txt`, renderer `scratchpad/vgaps/render-wf.mjs`.
- Coverage: `scratchpad/vgaps/cov-run.log` (node test runner with a local shim for `claude-code/testing`, unit files only). `claude plugin test` has no coverage flag.

## Lessons
- Bundle status can lag the code: check `gh pr list --state merged` and `git log` before running phases 7-8 again.
- `claude plugin test` gives no coverage; a node test-runner shim is needed to measure lines.

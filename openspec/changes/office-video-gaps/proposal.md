# office-video-gaps

## Why
The demo video shows waterfall details the panel lacks.

## What Changes
- Waterfall: now line, end-holder marker, pending row label.
- Desktop captures in README.
- Bundle: `.specs/features/office-video-gaps/`.

Source: `agent-office-demo.mp4` (14 chapters, 5:09). Compared with v0.28.23 (`plugins/agent-office/hooks/`).
Most of the video already shipped in `office-video-parity` (0.28.18). Real delta below.

## Gaps

| # | Chapter | Surface | State | Evidence | Missing |
|---|---------|---------|-------|----------|---------|
| G1 | 9 Waterfall | CLI + desktop | partial | `compact.ts:721` `waterfallLines` draws axis + spans only | vertical `agora` line at the current time |
| G2 | 9 Waterfall | CLI + desktop | missing | no critical-path code in `compact.ts`/`view-workflow.ts` | highlight the agent holding the session end ("segura o fim") |
| G3 | 9 Waterfall | CLI + desktop | partial | `compact.ts:533` label exists for map cards only | `aguarda 1ª ação…` text on a pending waterfall row |
| G4 (out of scope, YAGNI per office-video-parity) | 8 Agrupado, 10 Custo, 11 Ferramentas | desktop | text only | `register.tsx:876` graphical grid only for `map`/`cards` | (optional) graphical rendering on app surfaces; today they render as text cells |
| G5 | 4 Mapa, 13 Layout | desktop | unverified | README "Not verified in the Claude app" | real capture in the desktop app (lit trace, 110-col side panel) |

Implemented (no action): install/`/office start`, header (ETA, Geral, 5h/week limits, `run-model.ts:312`), map root naming (`run-model.ts:115`),
card anatomy, states incl. 429 as attention (`run-model.ts:11`) and 30 s hide (`office.ts:66`), cards keys v/g/o/f/s,
grouped by worktree with commits (`view-worktrees.ts`), cost partial total (`view-cost.ts`), tools, detail with mask and
`OFFICE_CAPTURE_IO` (`mask.ts`, `capture.ts`), `/office` commands and adaptive layout.


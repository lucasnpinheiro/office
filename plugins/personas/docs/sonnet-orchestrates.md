# Tiered delegation: Opus decides, Sonnet orchestrates, Haiku executes

Chain: main to `profundo` to `padrao` to `rapido` to `rapido` (the last level is a leaf), or main to `padrao` to
`rapido` to `rapido`. Cap: three levels below the first worker.

| Stays with `padrao` (orchestrate) | Goes to `rapido` (execute) |
|---|---|
| Read the brief, plan, split into parts with a full written brief each | Read-only lookups, greps, file:line maps, listings |
| Decide interfaces, ordering, which parts run in parallel | Exact-diff edits: the change is written in the brief, one file per part |
| Judge Haiku output against evidence, integrate | Running commands, suites, linters; return command, exit code, trimmed output |
| Design, debugging with unknown cause, QA verdicts | Docs, summaries, checklists, log reading, boilerplate from a pattern |

Rule of thumb: if the brief can be written so no judgement is left, it is a `rapido` part; if writing the brief takes
as long as the work (one small edit), do it inline.

## Procedure

1. Plan: list parts and mark each Haiku-eligible or not. If every part is Sonnet work, run inline.
2. Spawn: `Agent` with `subagent_type` `personas:rapido`, effort `low`. The brief states goal, exact files, the full
   change or exact command, expected evidence, and "do only this". One part per independent file, all in one message.
3. Verify: read the evidence (file:line, exit code); re-run the cheap check yourself when parts touch shared files.
   Never relay a subagent claim as fact. A failed part gets its correction through `SendMessage` to the same subagent;
   spawn a fresh one only if it cannot resume or fails the same correction twice.
4. Escalate: a fresh retry bumps effort one level (cap `medium`), then one tier up; never straight to `profundo`.
5. Report: parts delegated versus inline, evidence, what failed.

## Limits

- A part under about three tool calls stays inline: each spawn re-reads the project context.
- 1-20 children per round; keep the total per request small (the reference setup uses at most 200).
- `padrao` never spawns `padrao`; nothing spawns upward.
- A subagent never commits, pushes, merges or changes a spec's architecture.
- If a spawn is refused at the depth reached, run the part inline and say so.

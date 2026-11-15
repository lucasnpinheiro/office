// Estimated per-agent cost, not billing data. USD per MTok input/output of the current model per family
// (agents run unversioned aliases): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 from $0.10/$0.50 (prompts up to 100K).
// Source: platform.claude.com/docs/en/about-claude/models/overview, checked 2026-11-15.
const PRICE: Record<string, { in: number; out: number }> = { haiku: { in: 0.1, out: 0.5 }, sonnet: { in: 2, out: 10 }, opus: { in: 4, out: 20 } }
// shortcut: tracked tokens are one sum (input+output+cache write), so assume 80% input / 20% output; split them in capture.ts to be exact.
const INPUT_SHARE = 0.8

/** USD estimate for one agent from its token sum and model label; undefined when tokens or model family are unknown. */
export function estimateCostUsd(model: string | undefined, tokens: number | undefined): number | undefined {
  const fam = (model ?? '').toLowerCase().match(/haiku|sonnet|opus/)?.[0]
  if (!fam || tokens === undefined) return undefined
  const p = PRICE[fam]!
  return (tokens * (INPUT_SHARE * p.in + (1 - INPUT_SHARE) * p.out)) / 1_000_000
}

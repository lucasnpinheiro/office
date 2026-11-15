// Estimated per-agent cost. Prices are estimates (USD per MTok input/output, list prices as of 2026-11); not billing data.
const PRICE: Record<string, { in: number; out: number }> = { haiku: { in: 1, out: 5 }, sonnet: { in: 3, out: 15 }, opus: { in: 5, out: 25 } }
// shortcut: tracked tokens are one sum (input+output+cache write), so assume 80% input / 20% output; split them in capture.ts to be exact.
const INPUT_SHARE = 0.8

/** USD estimate for one agent from its token sum and model label; undefined when tokens or model family are unknown. */
export function estimateCostUsd(model: string | undefined, tokens: number | undefined): number | undefined {
  const fam = (model ?? '').toLowerCase().match(/haiku|sonnet|opus/)?.[0]
  if (!fam || tokens === undefined) return undefined
  const p = PRICE[fam]!
  return (tokens * (INPUT_SHARE * p.in + (1 - INPUT_SHARE) * p.out)) / 1_000_000
}

// Visão Custo (T-010, AC-031 a AC-033). Pure: renders from the RunModel only (no engine, no clock, no I/O).
// Tokens come from turn.step usage. Cost is never invented: no price table, so per-agent `~$` stays `—`
// and the total `~$` is `—` too. A total that leaves out an unknown agent is marked `parcial`.
import type { RunModel, RunNode } from './run-model'
import type { Caps } from './compact'
import type { Line, Seg } from './monitor'
import { fmtMMSS } from './monitor'

const DIM = '#9ca3af'
const seg = (t: string, fg?: string, extra: Partial<Seg> = {}): Seg => ({ t, ...(fg ? { fg } : {}), ...extra })

// 12300 -> "12,3 mil"; 4000 -> "4 mil"; 1_200_000 -> "1,2 mi"; under 1000 the number as is
export const fmtTokens = (n: number): string => {
  const scaled = (x: number, unit: string) => `${String(Number(x.toFixed(1))).replace('.', ',')} ${unit}`
  if (n >= 1_000_000) return scaled(n / 1_000_000, 'mi')
  if (n >= 1000) return scaled(n / 1000, 'mil')
  return String(n)
}

const dur = (n: RunNode, now: number): number | undefined => (n.startedAt === undefined ? undefined : Math.max(0, (n.endedAt ?? now) - n.startedAt))

export function costLines(model: RunModel, now: number, v: { width: number; caps: Caps }): Line[] {
  const c = v.caps, w = v.width
  const nameW = w >= 100 ? 24 : 14
  const cells = Math.max(8, w - nameW - 40)
  const [fill, track] = c.ascii ? ['#', '.'] : ['█', '▒']
  const nodes = model.nodes
  const maxDur = Math.max(1, ...nodes.map(n => dur(n, now) ?? 0))
  const t = model.totals
  const totalTxt = t.tokens === undefined ? '—' : fmtTokens(t.tokens) + (t.partial ? ' parcial' : '')
  // most expensive by tokens: there is no cost figure to rank by, so this is the honest proxy
  const top = nodes.filter(n => n.usage.tokens !== undefined).sort((a, b) => (b.usage.tokens ?? 0) - (a.usage.tokens ?? 0))[0]
  const out: Line[] = [[seg(`Custo · total ${totalTxt} · ~$ — · ${top ? `maior consumo ${top.name} ${fmtTokens(top.usage.tokens!)}` : 'maior consumo —'}`, undefined, { bold: true })]]
  if (!nodes.length) return [...out, [seg('Sem agentes com custo', DIM)]]
  for (const n of nodes) {
    const d = dur(n, now)
    const filled = d === undefined ? 0 : Math.round((cells * d) / maxDur)
    const name = (n.name.length > nameW ? n.name.slice(0, nameW - 1) + '…' : n.name).padEnd(nameW)
    const tokens = (n.usage.tokens === undefined ? '—' : fmtTokens(n.usage.tokens)).padStart(9)
    out.push([
      seg(name + ' '),
      seg(fill.repeat(filled), undefined),
      seg(track.repeat(cells - filled), DIM),
      seg(` ${tokens}  ~$ —  ${d === undefined ? '—' : fmtMMSS(d)}`),
    ])
  }
  return out
}

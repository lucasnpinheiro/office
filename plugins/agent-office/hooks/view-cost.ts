// Visão Custo (T-010, AC-031 a AC-033). Pure: renders from the RunModel only (no engine, no clock, no I/O).
// Tokens come from turn.step usage. Cost is never invented: no price table, so per-agent `~$` stays `—`;
// the session USD shows only when the caller read it from the engine (`sessionUsd`), else `~$ —`. A total that leaves out an unknown agent is marked `parcial`.
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

// Session total from `$.session.usage().cost.usd` (CLI, probe 2026-11-05, ADR 0002); per-agent cost stays unknown.
export const fmtUsd = (usd: number): string => (!Number.isFinite(usd) || usd < 0 ? '—' : usd > 0 && usd < 0.01 ? '<$0,01' : `~$${usd.toFixed(2).replace('.', ',')}`)

const dur = (n: RunNode, now: number): number | undefined => (n.startedAt === undefined ? undefined : Math.max(0, (n.endedAt ?? now) - n.startedAt))

/** Tokens no formato da visão larga: 27000 -> "27,0k"; 1_200_000 -> "1,2M"; abaixo de mil, o número. Vírgula decimal (pt-BR). */
export const fmtTokensK = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`
  return String(n)
}

/**
 * Visão Custo larga (>= 100 colunas): cabeçalho `Custo ~$X · N tokens · mais caro: <agente>`, árvore com ├ └ │,
 * régua de tempo 0s..Ns e barra █ na cor do estado deslocada pelo início do agente. Tokens sem dado = `—`, nunca 0;
 * custo por agente é sempre `—` (sem tabela de preço). Pure: mesma entrada de `costLines`.
 */
export function wideCostLines(model: RunModel, now: number, v: { width: number; caps: Caps; sessionUsd?: number }): Line[] {
  const c = v.caps, w = v.width
  const nameW = 24, cells = Math.max(10, w - nameW - 30)
  const [fill, track] = c.ascii ? ['#', '.'] : ['█', '▒']
  const nodes = model.nodes
  const t = model.totals
  const starts = nodes.map(n => n.startedAt).filter((x): x is number => x !== undefined)
  const t0 = starts.length ? Math.min(...starts) : now
  const span = Math.max(1, ...nodes.map(n => (n.startedAt === undefined ? 0 : (n.endedAt ?? now) - t0)))
  const top = nodes.filter(n => n.usage.tokens !== undefined).sort((a, b) => (b.usage.tokens ?? 0) - (a.usage.tokens ?? 0))[0]
  const totalTok = t.tokens === undefined ? '—' : fmtTokensK(t.tokens) + (t.partial ? ' parcial' : '')
  const usd = v.sessionUsd === undefined ? '~$ —' : fmtUsd(v.sessionUsd)
  const out: Line[] = [[seg(`Custo ${usd} · ${totalTok} tokens · mais caro: ${top ? top.name : '—'}`, undefined, { bold: true })]]
  if (!nodes.length) return [...out, [seg('Sem agentes com custo', DIM)]]
  const end = fmtSec(span)
  out.push([seg('Agente'.padEnd(nameW) + '0s'.padEnd(cells - end.length) + end + '    tokens   custo   tempo', DIM)])
  const kids = new Map<string, RunNode[]>()
  for (const n of nodes) if (n.parentId !== undefined) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n])
  const ids = new Set(nodes.map(n => n.id))
  const roots = nodes.filter(n => n.parentId === undefined || !ids.has(n.parentId))
  const walk = (list: RunNode[], base: string, top0: boolean) => list.forEach((n, i) => {
    const last = i === list.length - 1
    const conn = top0 ? '' : base + (last ? '└ ' : '├ ')
    const d = dur(n, now)
    const off = n.startedAt === undefined ? 0 : Math.min(cells - 1, Math.round(((n.startedAt - t0) * cells) / span))
    const len = d === undefined ? 0 : Math.max(1, Math.min(cells - off, Math.round((d * cells) / span)))
    const label = `${conn}${n.name}`
    const name = (label.length > nameW ? label.slice(0, nameW - 1) + '…' : label).padEnd(nameW)
    const tokens = (n.usage.tokens === undefined ? '—' : fmtTokensK(n.usage.tokens)).padStart(8)
    const bar = len ? ' '.repeat(off) + fill.repeat(len) : ''
    out.push([
      seg(name),
      seg(bar.padEnd(cells)),
      seg(` ${tokens}   ~$ —  ${d === undefined ? '—' : fmtMMSS(d)}`),
    ])
    const cb = top0 ? '' : base + (last ? '  ' : '│ ')
    walk(kids.get(n.id) ?? [], cb, false)
  })
  walk(roots, '', true)
  if (nodes.some(n => n.usage.tokens === undefined)) out.push([seg('Sem dado de tokens na superfície: mostra — e nunca zero.', DIM)])
  return out
}

/** Segundos inteiros para a régua de tempo: 4000 -> "4s". */
const fmtSec = (ms: number): string => `${Math.round(ms / 1000)}s`

export function costLines(model: RunModel, now: number, v: { width: number; caps: Caps; sessionUsd?: number }): Line[] {
  if (v.width >= 100) return wideCostLines(model, now, v)
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
  const out: Line[] = [[seg(`Custo · total ${totalTxt} · sessão ${v.sessionUsd === undefined ? '~$ —' : fmtUsd(v.sessionUsd)} · ${top ? `maior consumo ${top.name} ${fmtTokens(top.usage.tokens!)}` : 'maior consumo —'}`, undefined, { bold: true })]]
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

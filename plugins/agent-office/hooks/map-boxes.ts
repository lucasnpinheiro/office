// Terminal org chart (design Term5 "Mapa"): boxed agents linked parent -> children with box-drawing connectors.
// Pure: returns drawn Lines (Segs with fg/node) or null when the pane is narrower than one box (caller keeps the text map).
// Alignment never trusts the terminal: every glyph is placed by display width (strWidth), a wide glyph owns two cells.
import { buildGraph, fmtMMSS, progressBar, STATE_COLOR, WORKTREE_COLOR, strWidth, takeWidth, overallProgress, elapsedOf, etaOf } from './monitor'
import type { Line, Seg } from './monitor'
import type { AgentLike } from './office'
import type { GitInfo } from './git'
import { appMap } from './app-cards'
import type { AppMapNode } from './app-cards'
import { asciiText } from './compact'

export const BOX_W = 30 // even: the connector column is bx + BW / 2, the same for the stub above and below
export const MIN_BOX_W = 24
// a narrow side pane shrinks the boxes (even width, the 2-col trunk and 2 cols of slack kept) before giving up on boxes
export const boxWidth = (cols: number): number => Math.max(MIN_BOX_W, Math.min(BOX_W, (cols - 4) - ((cols - 4) % 2)))
const WAITING = 'Aguardando agentes… use o Claude normalmente'
const BOX_H = 6
const GAP = 2
const LINE = '#4a4e55'
const DIM = '#9ca3af'

type Cell = { c: string; fg?: string; bold?: boolean; dim?: boolean; node?: string }
export type MapOpts = { width: number; project: string; sessionId?: string; git?: GitInfo; ascii: boolean; color: boolean; query?: string; filter?: 'all' | 'failed' }

const fitW = (s: string, w: number): string => (strWidth(s) <= w ? s : `${takeWidth(s, w - 1)}…`)
const stripIcon = (s: string): string => (/^\S+\s/.test(s) && /[^\x00-\x7f]/.test(s.split(' ')[0]!) ? s.replace(/^\S+\s/, '') : s)

export function renderBoxMap(agents: AgentLike[], now: number, o: MapOpts): Line[] | null {
  // no agents yet (fresh session, right after a reload) still draws the map: header, root box, a waiting line
  if (o.width < MIN_BOX_W + 2) return null
  const BW = boxWidth(o.width)
  const root = appMap(agents, now, { query: o.query, filter: o.filter, git: o.git })
  const empty = root.card.id === 'session' && root.children.length === 0
  const g = buildGraph(agents, now, o.git)
  const grid: Cell[][] = []
  const put = (x: number, y: number, c: string, st: Omit<Cell, 'c'> = {}) => {
    const w = strWidth(c); if (w === 0 || x < 0) return
    ;(grid[y] ??= [])[x] = { c, ...st }
    if (w === 2) (grid[y] ??= [])[x + 1] = { c: '' }
  }
  const text = (x: number, y: number, s: string, st: Omit<Cell, 'c'>) => {
    let cx = x
    for (const ch of (typeof Intl !== 'undefined' && (Intl as any).Segmenter ? [...new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((z: any) => z.segment as string) : [...s])) { put(cx, y, ch, st); cx += strWidth(ch) }
  }
  const sym = o.ascii ? { h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+', d: '+', u: '+', l: '+', r: '+', x: '+' } : { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘', d: '┬', u: '┴', l: '├', r: '┤', x: '┼' }
  const dot = o.ascii ? { h: '.', v: ':' } : { h: '┄', v: '┊' }
  const col = (c?: string) => (o.color ? c : undefined)
  const T = (s: string) => (o.ascii ? asciiText(s.replace(/▾/g, 'v')) : s)

  // ---- measure
  type M = { w: number; h: number; rows: AppMapNode[][]; ws: number[] }
  const memo = new Map<AppMapNode, M>()
  const measure = (n: AppMapNode): M => {
    const hit = memo.get(n); if (hit) return hit
    const ws = n.children.map(k => measure(k).w), rows: AppMapNode[][] = []
    let cur: AppMapNode[] = [], used = 0
    n.children.forEach((k, i) => {
      const w = ws[i]!
      if (cur.length && used + GAP + w > o.width - 2) { rows.push(cur); cur = []; used = 0 }
      used += (cur.length ? GAP : 0) + w; cur.push(k)
    })
    if (cur.length) rows.push(cur)
    const rowW = rows.map(r => r.reduce((a, k, i) => a + measure(k).w + (i ? GAP : 0), 0))
    const rowH = rows.map(r => Math.max(...r.map(k => measure(k).h)))
    const tm = rows.length > 1 ? 2 : 0
    const m = { w: Math.max(BW, tm + Math.max(0, ...rowW)), h: BOX_H + rows.reduce((a, _, i) => a + 1 + rowH[i]!, 0), rows, ws }
    memo.set(n, m); return m
  }

  // ---- draw
  const box = (n: AppMapNode, bx: number, y: number) => {
    const c = n.card, fg = col(STATE_COLOR[c.state]), nd = c.id === 'session' ? undefined : c.id
    const st: Omit<Cell, 'c'> = { fg } // border: never a Button, so Tab focus does not paint it
    const x1 = bx + BW - 1
    for (let x = bx + 1; x < x1; x++) { put(x, y, sym.h, st); put(x, y + BOX_H - 1, sym.h, st) }
    put(bx, y, sym.tl, st); put(x1, y, sym.tr, st); put(bx, y + BOX_H - 1, sym.bl, st); put(x1, y + BOX_H - 1, sym.br, st)
    for (let r = 1; r < BOX_H - 1; r++) { put(bx, y + r, sym.v, st); put(x1, y + r, sym.v, st) }
    const tx = bx + 2, tw = BW - 4
    const glyph = T(c.glyph), kid = c.hasKids ? ' ▾' : ''
    text(tx, y + 1, glyph, { fg, node: nd })
    const nameRoom = tw - strWidth(glyph) - 1 - strWidth(T(kid))
    const name = fitW(T(c.title), nameRoom)
    text(tx + strWidth(glyph) + 1, y + 1, name, { bold: true, node: nd })
    if (kid) text(tx + strWidth(glyph) + 1 + strWidth(name), y + 1, T(kid), { fg: col(DIM), node: nd })
    // line 2 (design): persona · model; the effort rides on the progress line, so nothing is cut at this width
    const [pChip, mChip, eChip] = c.id === 'session' ? [c.chips[0], undefined, undefined] : [c.chips[0], c.chips[1], c.chips[2]]
    const who = [pChip, mChip].filter((x): x is string => !!x)
    const parts = o.ascii ? who.map(stripIcon) : who
    const chips = strWidth(T(parts.join(' · '))) <= tw ? parts.join(' · ') : parts.join(' ') // long persona names drop the dot before cutting
    text(tx, y + 2, fitW(T(chips), tw), { fg: col(DIM) })
    // line 3 is never blank: branch or worktree, else the tool / error, else the state in words
    const gl = c.git?.length ? c.git : o.git?.branch ? [`⎇ ${o.git.branch}`] : undefined
    const stateWord = { pending: 'aguardando', running: 'executando', done: 'concluído', failed: 'falhou', attention: 'aguarda você', inactive: 'inativo' }[c.state] ?? ''
    const l3 = gl?.length ? { t: gl.join(' '), fg: col(WORKTREE_COLOR) } : { t: c.status ? `${c.state === 'running' ? '▸ ' : ''}${c.status}` : stateWord, fg: col(DIM) }
    text(tx, y + 3, fitW(T(l3.t), tw), { fg: l3.fg })
    const bar = T(progressBar(c.pct ?? 0, 6))
    text(tx, y + 4, bar, { fg })
    const pt = `${c.pctText.padStart(5)} ${c.time}`
    text(tx + 6, y + 4, pt, { fg: col(DIM) })
    const eff = eChip ? (o.ascii ? stripIcon(eChip) : eChip) : ''
    if (eff && 6 + strWidth(pt) + 1 + strWidth(T(eff)) <= tw) text(tx + 6 + strWidth(pt) + 1, y + 4, T(eff), { fg: col(DIM) })
  }
  const draw = (n: AppMapNode, x0: number, y0: number, blockW: number) => {
    const m = measure(n)
    // wrapped rows hang off a left trunk: the parent sits over the first column so its stub meets the first child's centre
    const wrapped = m.rows.length > 1 && m.rows.every(r => r.length === 1)
    const bx = wrapped ? x0 + 2 + Math.floor((measure(m.rows[0]![0]!).w - BW) / 2) : x0 + Math.floor((blockW - BW) / 2), pcx = bx + BW / 2
    box(n, bx, y0)
    if (!m.rows.length) return
    put(pcx, y0 + BOX_H - 1, sym.d, { fg: col(STATE_COLOR[n.card.state]) })
    const tm = m.rows.length > 1 ? 2 : 0
    let y = y0 + BOX_H
    const busYs: number[] = []
    m.rows.forEach((row, ri) => {
      const rw = row.reduce((a, k, i) => a + measure(k).w + (i ? GAP : 0), 0)
      let sx = x0 + tm + (tm ? 0 : Math.floor((blockW - rw) / 2))
      const cxs: number[] = []
      const slots = row.map(k => { const s = sx; sx += measure(k).w + GAP; cxs.push(s + Math.floor(measure(k).w / 2)); return s })
      const lo = Math.min(cxs[0]!, pcx, tm ? x0 : Infinity), hi = Math.max(cxs[cxs.length - 1]!, ri === 0 ? pcx : -1)
      const line = (c: string, x: number, fg?: string) => put(x, y, c, { fg: col(fg ?? LINE) })
      busYs.push(y)
      if (lo === hi && cxs.length === 1) line(sym.v, lo, STATE_COLOR[row[0]!.card.state])
      else {
        // wrapped rows (user choice): trunk and row buses dotted and dim, so the rows never read as a frame
        for (let x = lo; x <= hi; x++) line(tm ? dot.h : sym.h, x)
        cxs.forEach((cx, i) => line(sym.d, cx, STATE_COLOR[row[i]!.card.state]))
        if (cxs.includes(lo) && lo !== hi) line(sym.tl, lo, STATE_COLOR[row[cxs.indexOf(lo)]!.card.state])
        if (cxs.includes(hi) && lo !== hi) line(sym.tr, hi, STATE_COLOR[row[cxs.indexOf(hi)]!.card.state])
        if (ri === 0) line(cxs.includes(pcx) ? (pcx === hi && lo < pcx ? sym.r : pcx === lo && hi > pcx ? sym.l : sym.x) : pcx === lo ? sym.l : pcx === hi ? sym.r : sym.u, pcx)
        if (tm) line(ri === 0 ? sym.tl : ri === m.rows.length - 1 ? sym.bl : sym.l, x0)
      }
      const rh = Math.max(...row.map(k => measure(k).h))
      row.forEach((k, i) => { draw(k, slots[i]!, y + 1, measure(k).w); put(cxs[i]!, y + 1, sym.u, { fg: col(STATE_COLOR[k.card.state]) }) })
      y += 1 + rh
    })
    if (tm) for (let yy = busYs[0]! + 1; yy < busYs[busYs.length - 1]!; yy++) if (!grid[yy]?.[x0]) put(x0, yy, dot.v, { fg: col(LINE) })
  }
  const rootM = measure(root)
  draw(root, 0, 0, Math.max(rootM.w, 0))
  const chartW = rootM.w

  // ---- header (Term5): title + project/branch/session left; overall progress + elapsed/eta right
  const pct = overallProgress(g), eta = etaOf(g)
  const left1: Seg[] = [{ t: 'Office Agent Monitor', bold: true }]
  const br = o.git?.branch ? ` · ⎇ ${o.git.branch}` : ''
  const left2: Seg[] = [{ t: T(`${o.project}${br}${o.sessionId ? ` · sessão #${o.sessionId.slice(0, 6)}` : ''}`), fg: col(DIM) }]
  const right1: Seg[] = [{ t: `Progresso geral ${pct === undefined ? '—' : `${Math.round(pct * 100)}%`} `, fg: col(DIM) }, { t: T(progressBar(pct ?? 0, 10)), fg: col(STATE_COLOR.running) }]
  const right2: Seg[] = [{ t: `Decorrido ${fmtMMSS(elapsedOf(g, now))} · Estimativa ${eta === undefined ? '—' : fmtMMSS(eta)}`, fg: col(DIM) }]
  const wOf = (l: Seg[]) => l.reduce((a, s) => a + strWidth(s.t), 0)
  const W = Math.max(chartW, wOf(left1) + 2 + wOf(right1), wOf(left2) + 2 + wOf(right2))
  const head = (l: Seg[], r: Seg[]): Line => [...l, { t: ' '.repeat(Math.max(1, W - wOf(l) - wOf(r))) }, ...r]

  // ---- cells to Lines (merge runs of equal style, skip the continuation cell of a wide glyph)
  const lines: Line[] = []
  for (const row of grid) {
    const segs: Seg[] = []
    let s = row ? row.length : 0
    while (s > 0 && (!row![s - 1] || (row![s - 1]!.c === ' '))) s--
    for (let x = 0; x < s; x++) {
      const cell = row![x]
      if (cell && cell.c === '') continue
      const t = cell ? cell.c : ' '
      const last = segs[segs.length - 1]
      if (last && last.fg === cell?.fg && last.bold === cell?.bold && last.node === cell?.node && last.dim === cell?.dim) last.t += t
      else segs.push({ t, ...(cell?.fg ? { fg: cell.fg } : {}), ...(cell?.bold ? { bold: true } : {}), ...(cell?.node ? { node: cell.node } : {}) })
    }
    lines.push(segs)
  }
  const tail: Line[] = empty ? [[], [{ t: T(agents.length === 0 ? WAITING : 'Nenhum agente corresponde ao filtro'), fg: col(DIM) }]] : []
  return [head(left1, right1), head(left2, right2), [], ...lines, ...tail]
}

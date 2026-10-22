// Office compact view: one-line tree, grouped/ungrouped modes, rounded cards, detail with dependencies,
// attachment preview and terminal capability detection. Pure (no engine APIs): the caller passes `now`.
// Terminal and app share this state model; only the drawing of the Lines differs.
import { buildGraph, progressOf, overallProgress, etaOf, durationOf, elapsedOf, hiddenIds, maxDepthOf, fmtMMSS, fmtHMS,
  truncRunes, lineWidth, STATE_COLOR, WORKTREE_COLOR, MAX_DEPTH, isQuotaError } from './monitor'
import type { Node, State, Seg, Line, Graph } from './monitor'
import type { AgentLike } from './office'

export { isQuotaError }

// ---------- capabilities ----------
export type Caps = { ascii: boolean; numbered: boolean; color: 'truecolor' | '256' | '16' | 'mono'; reducedMotion: boolean }
const truthy = (v?: string) => !!v && !['0', 'false', 'no', 'off', ''].includes(v.toLowerCase())

export function detectCaps(env: Record<string, string | undefined>, o: { isTTY?: boolean; ascii?: boolean } = {}): Caps {
  const term = (env.TERM ?? '').toLowerCase()
  const loc = env.LC_ALL || env.LC_CTYPE || env.LANG || ''
  const legacy = env.OS === 'Windows_NT' && !env.WT_SESSION && !env.TERM_PROGRAM && !env.ConEmuANSI && !env.ANSICON
  const ascii = !!o.ascii || truthy(env.OFFICE_ASCII) || term === 'linux' || term === 'dumb' || (loc !== '' && !/utf-?8/i.test(loc)) || legacy
  const tty = o.isTTY !== false
  const color: Caps['color'] = truthy(env.NO_COLOR) || !tty || term === 'dumb' ? 'mono'
    : /truecolor|24bit/i.test(env.COLORTERM ?? '') ? 'truecolor' : term.includes('256color') ? '256' : '16'
  return { ascii, numbered: legacy, color, reducedMotion: truthy(env.OFFICE_REDUCED_MOTION) || truthy(env.CI) || !tty }
}

const BASIC: [string, [number, number, number]][] = [
  ['#000000', [0, 0, 0]], ['#ef4444', [205, 49, 49]], ['#22c55e', [13, 188, 121]], ['#eab308', [229, 229, 16]],
  ['#3b82f6', [36, 114, 200]], ['#a855f7', [188, 63, 188]], ['#06b6d4', [17, 168, 205]], ['#e5e7eb', [229, 229, 229]],
]
// Color adapted to the terminal depth. The engine downsamples truecolor itself; this keeps 16/mono honest.
export function quantize(hex: string | undefined, level: Caps['color']): string | undefined {
  if (!hex || level === 'mono') return undefined
  if (level === 'truecolor' || level === '256') return hex
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  let best = BASIC[0]![0], d = Infinity
  for (const [h, r] of BASIC) { const x = (r[0] - c[0]!) ** 2 + (r[1] - c[1]!) ** 2 + (r[2] - c[2]!) ** 2; if (x < d) { d = x; best = h } }
  return best
}

export const layoutLevel = (w: number): 'full' | 'abbr' | 'line' => (w >= 100 ? 'full' : w >= 50 ? 'abbr' : 'line')

// ---------- glyphs ----------
const GL_U: Record<State, string> = { running: '●', attention: '▲', failed: '✗', pending: '○', done: '✓', inactive: '◌' }
const GL_A: Record<State, string> = { running: '*', attention: '!', failed: 'x', pending: 'o', done: 'v', inactive: '-' }
const glyph = (c: Caps, s: State) => (c.ascii ? GL_A : GL_U)[s]
type Box = { tl: string; tr: string; bl: string; br: string; v: string; h: string }
export const boxChars = (c: Caps): Box =>
  c.numbered ? { tl: '+', tr: '+', bl: '+', br: '+', v: '|', h: '-' }
    : c.ascii ? { tl: '.', tr: '.', bl: "'", br: "'", v: '|', h: '-' }
      : { tl: '╭', tr: '╮', bl: '╰', br: '╯', v: '│', h: '─' }
const BAR = (c: Caps) => (c.ascii ? ['#', '.'] : ['█', '▒']) as [string, string]
const DIM = '#9ca3af'
const LABEL: Record<State, string> = { running: 'Em execução', attention: 'Atenção', failed: 'Falhas', pending: 'Pendentes', done: 'Concluídos', inactive: 'Inativos' }

export type Mode = 'tree' | 'grouped' | 'cards' | 'waterfall'
export const DEFAULT_MODE: Mode = 'cards'
export const NEXT_MODE: Record<Mode, Mode> = { tree: 'grouped', grouped: 'cards', cards: 'waterfall', waterfall: 'tree' }
export type CView = { width: number; caps: Caps; mode: Mode; query: string; expanded: Set<string>; maxCardRows: number; maxLines?: number; frame?: number; project?: string; sessionId?: string }

const sp = (n: number): Seg[] => (n > 0 ? [{ t: ' '.repeat(n) }] : [])
const col = (c: Caps, hex?: string) => quantize(hex, c.color)
const seg = (c: Caps, t: string, fg?: string, extra: Partial<Seg> = {}): Seg => ({ t, fg: col(c, fg), ...extra })
const fit = (l: Line, w: number): Line => {
  const out: Line = []; let used = 0
  for (const s of l) { if (used >= w) break; const r = [...s.t]; out.push(used + r.length <= w ? s : { ...s, t: r.slice(0, w - used).join('') }); used += r.length }
  return out
}
const spread = (l: Line, r: Line, w: number): Line => {
  const gap = w - lineWidth(l) - lineWidth(r)
  return gap >= 1 ? [...l, ...sp(gap), ...r] : fit(l, Math.max(0, w - lineWidth(r) - 1)).concat(sp(1), r)
}

// Segmented single bar: done (green), running (blue), failed (red), rest hatched.
function segBar(g: Graph, c: Caps, cells: number): Line {
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent')
  const tot = ns.length || 1
  const cnt = (f: (n: Node) => boolean) => Math.round((ns.filter(f).length / tot) * cells)
  const d = Math.min(cells, cnt(n => n.state === 'done'))
  const r = Math.min(cells - d, cnt(n => n.state === 'running' || n.state === 'attention'))
  const x = Math.min(cells - d - r, cnt(n => n.state === 'failed'))
  const [on, off] = BAR(c)
  return [seg(c, on.repeat(d), STATE_COLOR.done), seg(c, on.repeat(r), STATE_COLOR.running), seg(c, on.repeat(x), STATE_COLOR.failed), seg(c, off.repeat(cells - d - r - x), DIM)]
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0 }

// Unique display names: duplicates get " #n".
function names(g: Graph): Map<string, string> {
  const seen = new Map<string, number>(), tot = new Map<string, number>()
  for (const n of g.nodes.values()) tot.set(n.name, (tot.get(n.name) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const n of g.nodes.values()) {
    const k = (seen.get(n.name) ?? 0) + 1; seen.set(n.name, k)
    out.set(n.id, (tot.get(n.name) ?? 1) > 1 ? `${n.name} #${k}` : n.name)
  }
  return out
}

// Real % or task counts, never a fake 0%.
function metric(n: Node): string {
  const tasks = n.children.filter(k => k.kind === 'task')
  if (tasks.length) return `${tasks.filter(k => k.state === 'done').length}/${tasks.length}`
  if (n.state === 'done') return '100%'
  if (n.children.length) { const p = progressOf(n); return p === undefined ? '—' : `${Math.round(p * 100)}%` }
  return n.state === 'running' ? 'exec' : n.state === 'failed' ? 'falha' : n.state === 'attention' ? 'atenção' : '—'
}

export function statusText(agents: AgentLike[], now: number, ascii = false): string {
  const g = buildGraph(agents, now)
  const active = [...g.nodes.values()].filter(n => n.kind === 'agent' && (n.state === 'running' || n.state === 'attention'))
  const p = overallProgress(g)
  const chip = active.length ? ` · @ ${truncRunes(active[active.length - 1]!.name, 20)}` : ''
  return `${ascii ? '*' : '●'} ${active.length} ativos · ${p === undefined ? '—' : Math.round(p * 100) + '%'}${chip}`
}

const matches = (n: Node, q: string) => !q || `${n.name} ${n.persona} ${n.model}`.toLowerCase().includes(q.toLowerCase())
function visibleSet(g: Graph, q: string, hidden: Set<string>): Set<string> {
  const keep = new Set<string>()
  const walk = (n: Node): boolean => {
    const kids = n.children.map(walk).some(Boolean)
    const ok = n.kind === 'session' || (!hidden.has(n.id) && (matches(n, q) || kids))
    if (ok) keep.add(n.id)
    return ok && n.kind !== 'session'
  }
  walk(g.root)
  return keep
}

const ROUND_BOX = (c: Caps, w: number, left: Line, right: Line, color = '#6b7280'): Line[] => {
  const b = boxChars(c), inner = w - 2
  return [[seg(c, b.tl + b.h.repeat(inner) + b.tr, color)],
    [seg(c, b.v, color), ...fit(spread(left, right, inner), inner), seg(c, b.v, color)],
    [seg(c, b.bl + b.h.repeat(inner) + b.br, color)]]
}

// Header per design (Rodada 4): rounded box "Office · project · #sid" + colored counts, then the Geral bar row.
function header(g: Graph, agents: AgentLike[], now: number, v: CView): Line[] {
  const { caps: c, width: w } = v
  const prog = overallProgress(g)
  const eta = etaOf(g)
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent')
  const n_ = (f: (n: Node) => boolean) => ns.filter(f).length
  const act = n_(n => n.state === 'running' || n.state === 'attention'), ok = n_(n => n.state === 'done'), bad = n_(n => n.state === 'failed')
  const sid = String(v.sessionId ?? '').replace(/[^\w-]/g, '').slice(0, 6)
  const left: Line = [seg(c, 'Office', undefined, { bold: true }), seg(c, ` · ${v.project || '-'}${sid ? ' · #' + sid : ''}`, DIM)]
  const right: Line = [seg(c, `${glyph(c, 'running')} ${act} ativos`, STATE_COLOR.running), seg(c, ` ${glyph(c, 'done')} ${ok}`, STATE_COLOR.done),
    seg(c, ` ${glyph(c, 'failed')} ${bad}`, STATE_COLOR.failed),
    seg(c, ` · ${fmtHMS(agents.length ? elapsedOf(g, now) : 0)} · ${eta === undefined ? 'ETA calculando' : 'ETA ' + fmtHMS(eta)}`, DIM)]
  const geral: Line = [seg(c, 'Geral '), ...segBar(g, c, layoutLevel(w) === 'full' ? 20 : 10), seg(c, ` ${prog === undefined ? '—' : Math.round(prog * 100) + '%'} · `),
    seg(c, 'g', undefined, { act: 'group', bold: true }), seg(c, ' alterna agrupado', DIM)]
  return [...ROUND_BOX(c, w, left, right), fit(geral, w)]
}

function footer(g: Graph, v: CView, hint = ''): Line[] {
  const c = v.caps
  const states: State[] = ['done', 'running', 'attention', 'pending', 'failed']
  const word: Record<State, string> = { done: 'ok', running: 'rodando', attention: 'atenção', pending: 'pendente', failed: 'falha', inactive: 'inativo' }
  const legend: Line = states.flatMap((s, i) => [...sp(i ? 2 : 0), seg(c, `${glyph(c, s)} ${word[s]}`, STATE_COLOR[s])])
  const keys: Line = [
    seg(c, `[g modo: ${({ tree: 'árvore', grouped: 'agrupado', cards: 'cards', waterfall: 'waterfall' } as Record<Mode, string>)[v.mode]}]`, undefined, { act: 'group' }), ...sp(1),
    seg(c, '[/ buscar]', undefined, { act: 'search' }), ...sp(1),
    seg(c, '[v visão]', undefined, { act: 'view' }), ...sp(1),
    seg(c, 'Enter detalhe · Esc voltar', DIM),
  ]
  const depth: Line = [seg(c, `Níveis de profundidade: ${maxDepthOf(g)}/${MAX_DEPTH}`, DIM)]
  const box = ROUND_BOX(c, v.width, [seg(c, hint, DIM)], [seg(c, '/ buscar · g modo', DIM)])
  return [...box, fit(legend, v.width), fit(keys, v.width), fit(depth, v.width)]
}

function treeLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView): Line[] {
  const c = v.caps, lvl = layoutLevel(v.width), out: Line[] = []
  const br = c.ascii ? { mid: '|-', last: '`-', pipe: '| ', none: '  ' } : { mid: '├─', last: '╰─', pipe: '│ ', none: '  ' }
  const row = (n: Node, prefix: string, label?: { name: string; extra?: string }): Line => {
    const name = label?.name ?? nm.get(n.id) ?? n.name
    const right = n.kind === 'task' ? metric(n) : `${label?.extra ?? metric(n)}  ${fmtMMSS(durationOf(n, now))}`
    const left: Line = [seg(c, prefix, DIM), seg(c, glyph(c, n.state) + ' ', STATE_COLOR[n.state], { node: n.kind === 'agent' ? n.id : undefined }),
      seg(c, name, undefined, { bold: n.kind === 'agent', node: n.kind === 'agent' ? n.id : undefined })]
    const meta = lvl === 'full' && n.kind === 'agent' ? [n.persona, n.model, n.effort].filter(Boolean).join('·') : ''
    const room = v.width - right.length - 2
    const l2 = fit(left, Math.max(8, room))
    const mid = meta && lineWidth(l2) + meta.length + 2 < room ? [...sp(1), seg(c, meta, DIM)] : []
    return spread([...l2, ...mid], [seg(c, right, DIM)], v.width)
  }
  const walk = (n: Node, prefix: string) => {
    const kids = n.children.filter(k => keep.has(k.id))
    const pinned = (k: Node) => k.state === 'failed' || k.state === 'attention'
    type Item = { n?: Node; group?: { state: State; ms: Node[]; key: string } }
    const items: Item[] = []
    if (v.mode === 'grouped') {
      const loose = kids.filter(k => k.kind === 'agent' && k.children.length === 0 && !pinned(k))
      const rest = kids.filter(k => !loose.includes(k))
      rest.sort((a, b) => Number(pinned(b)) - Number(pinned(a)))
      for (const k of rest) items.push({ n: k })
      for (const s of ['running', 'pending', 'done', 'inactive'] as State[]) {
        const ms = loose.filter(k => k.state === s)
        if (ms.length > 1) items.push({ group: { state: s, ms, key: `grp:${n.id}:${s}` } })
        else ms.forEach(k => items.push({ n: k }))
      }
    } else kids.forEach(k => items.push({ n: k }))
    items.forEach((it, i) => {
      const last = i === items.length - 1
      const pre = prefix + (last ? br.last : br.mid)
      const nxt = prefix + (last ? br.none : br.pipe)
      if (it.group) {
        const gr = it.group, open = v.expanded.has(gr.key)
        const med = fmtMMSS(median(gr.ms.map(m => durationOf(m, now))))
        out.push(fit([seg(c, pre, DIM), seg(c, glyph(c, gr.state) + ' ', STATE_COLOR[gr.state]),
          seg(c, `${LABEL[gr.state]} ×${gr.ms.length}`, undefined, { bold: true, act: `grp:${gr.key}` }),
          seg(c, `  mediana ${med}  ${open ? '[-]' : '[+]'}`, DIM, { act: `grp:${gr.key}` })], v.width))
        if (open) gr.ms.forEach((m, j) => out.push(row(m, nxt + (j === gr.ms.length - 1 ? br.last : br.mid))))
      } else {
        out.push(row(it.n!, pre))
        walk(it.n!, nxt)
      }
    })
  }
  walk(g.root, '')
  return out
}

// ---------- cards ----------
// Layout (ref. design v8): card 34 cols x 6 rows, gap 2, child indent 5. Leaf siblings fill rows of
// per_row = max(1, floor((cols - x_parent - 5 + 2) / 36)); branch siblings take one row each after the leaves, their
// subtree indented below. A dotted bus under the parent has a drop per card. Worktree flows get a heavy divider.
export const CARD_W = 34, CARD_H = 6, CARD_GAP = 2, CARD_INDENT = 5
export const perRowOf = (cols: number, xParent: number): number => Math.max(1, Math.floor((cols - xParent - CARD_INDENT + CARD_GAP) / (CARD_W + CARD_GAP)))

type Cell = { ch: string; s: Seg }
const toCells = (l: Line): Cell[] => l.flatMap(s => [...s.t].map(ch => ({ ch, s })))
const fromCells = (cs: Cell[]): Line => {
  const out: Line = []
  for (const c of cs) {
    const last = out[out.length - 1]
    if (last && last.fg === c.s.fg && last.bold === c.s.bold && last.node === c.s.node && last.act === c.s.act && last.attach === c.s.attach) last.t += c.ch
    else out.push({ ...c.s, t: c.ch })
  }
  return out
}
// Put `ch` at column `col` if it is blank (or past the end); never overwrites a card.
function putCol(l: Line, col: number, ch: string, fg: string | undefined): Line {
  const cs = toCells(l)
  while (cs.length <= col) cs.push({ ch: ' ', s: { t: ' ' } })
  if (cs[col]!.ch === ' ') cs[col] = { ch, s: { t: ch, fg } }
  return fromCells(cs)
}

const EASE = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
// Staggered growth just after a span starts (ease-out cubic, 80 ms stagger per card index); 1 when motion is reduced.
export const growth = (caps: Caps, n: Node, idx: number, now: number): number =>
  caps.reducedMotion || n.start === undefined ? 1 : EASE((now - n.start - idx * 80) / 700)

const PART = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
function lighten(hex: string | undefined): string | undefined { return hex ? '#' + [1, 3, 5].map(i => Math.min(255, parseInt(hex.slice(i, i + 2), 16) + 70).toString(16).padStart(2, '0')).join('') : hex }

// Bar with sub-cell head. Running + motion allowed: a bright cell sweeps across the filled part (shimmer).
function partialBar(frac: number, cells: number, c: Caps, color: string, running: boolean, frame: number): Line {
  const eighths = Math.round(Math.min(1, Math.max(0, frac)) * cells * 8)
  const full = Math.floor(eighths / 8), rem = eighths % 8
  if (c.ascii) {
    const sh = running && !c.reducedMotion && full > 0 ? frame % full : -1
    const body = '='.repeat(full).split('').map((ch, i) => (i === sh ? '#' : ch)).join('')
    return [seg(c, body, color), seg(c, rem ? '>' : '', color), seg(c, '.'.repeat(Math.max(0, cells - full - (rem ? 1 : 0))), DIM)]
  }
  const sh = running && !c.reducedMotion && full > 0 ? frame % full : -1
  const segs: Seg[] = []
  for (let i = 0; i < full; i++) segs.push(seg(c, '█', i === sh ? lighten(color) : color))
  if (rem) segs.push(seg(c, PART[rem]!, color))
  segs.push(seg(c, '▒'.repeat(Math.max(0, cells - full - (rem ? 1 : 0))), DIM))
  return segs
}

// Span on the session timeline: start offset blank, duration filled with sub-cell ends.
function spanBar(n: Node, t0: number, tot: number, now: number, cells: number, c: Caps, frame: number, k: number): Line {
  const st = n.start ?? t0, en = n.end ?? now
  const e0 = Math.round(((st - t0) / tot) * cells * 8)
  const e1 = Math.max(e0 + 1, Math.round((e0 / 8 + (((en - st) / tot) * cells) * k) * 8))
  const col_ = STATE_COLOR[n.state], run = n.state === 'running'
  const out: Seg[] = []
  const runChars = (len: number) => {
    const full = Math.floor(len / 8), rem = len % 8
    const sh = run && !c.reducedMotion && full > 0 ? frame % full : -1
    if (c.ascii) return [...'='.repeat(full)].map((ch, i) => seg(c, i === sh ? '#' : ch, col_)).concat(rem ? [seg(c, '=', col_)] : [])
    return [...'█'.repeat(full)].map((ch, i) => seg(c, ch, i === sh ? lighten(col_) : col_)).concat(rem ? [seg(c, PART[rem]!, col_)] : [])
  }
  const lead = Math.floor(e0 / 8)
  out.push(seg(c, (c.ascii ? '.' : '░').repeat(lead), DIM))
  const body = runChars(Math.max(1, e1 - lead * 8))
  out.push(...body)
  const used = lead + body.length
  out.push(seg(c, (c.ascii ? '.' : '░').repeat(Math.max(0, cells - used)), DIM))
  return out
}
const timeline = (g: Graph, now: number) => {
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent' && n.start !== undefined)
  const t0 = ns.length ? Math.min(...ns.map(n => n.start!)) : now
  const t1 = Math.max(now, ...ns.map(n => n.end ?? 0))
  return { t0, tot: Math.max(1, t1 - t0) }
}

// Card anatomy (design): name, persona · model, tool/status row, bar + metric + time. Border by state.
const BORDER: Record<State, string> = { running: STATE_COLOR.running, failed: STATE_COLOR.failed, attention: STATE_COLOR.attention, done: '#4b5563', pending: '#4b5563', inactive: '#4b5563' }
function card(n: Node, nm: Map<string, string>, c: Caps, now: number, frame: number, idx: number): Line[] {
  const b = boxChars(c), inner = CARD_W - 2, col_ = STATE_COLOR[n.state], edge = BORDER[n.state]
  const k = growth(c, n, idx, now)
  const id = n.id
  const body = (l: Line): Line => [seg(c, b.v, edge), ...fit([...l, ...sp(inner)], inner), seg(c, b.v, edge)]
  const kids = n.children.filter(x => x.kind === 'agent').length
  const sep = c.ascii ? '<' : '‹', tri = c.ascii ? '>' : '▸'
  const trail = [n.tool, ...[...(n.recent ?? [])].reverse().filter((x, i) => !(i === 0 && x === n.tool))].filter(Boolean).join(` ${sep} `)
  const row3: Line =
    n.state === 'done' ? [seg(c, 'concluído', DIM)]
      : n.state === 'failed' ? [seg(c, `${glyph(c, 'failed')} ${n.error ?? 'falha'}`, STATE_COLOR.failed)]
        : n.state === 'attention' ? [seg(c, `${glyph(c, 'attention')} ${n.error ?? 'sem atividade'}`, STATE_COLOR.attention)]
          : n.state === 'pending' ? [seg(c, 'aguarda vaga', DIM)]
            : [seg(c, `${tri} ${kids ? `delega ${kids} filhos` : trail || 'executando'}`, DIM)]
  const cells = 12, [on, off] = BAR(c)
  const leafRunning = n.state === 'running' && n.children.length === 0
  let bar: Line
  if (leafRunning) {
    // no real percent for a leaf without tasks: indeterminate sweep, never an invented number
    const pos = c.reducedMotion ? 0 : frame % (cells + 3)
    const sweep = Array.from({ length: cells }, (_, i) => (i <= pos && i > pos - 3 ? on : off))
    bar = sweep.map(ch => seg(c, ch, ch === on ? col_ : DIM))
  } else bar = partialBar((n.state === 'done' ? 1 : n.state === 'failed' ? 0.6 : progressOf(n) ?? 0) * k, cells, c, col_, n.state === 'running', frame)
  const time = n.start === undefined ? '--:--' : fmtMMSS(durationOf(n, now))
  return [
    [seg(c, b.tl + b.h.repeat(inner) + b.tr, edge)],
    body([seg(c, glyph(c, n.state) + ' ', col_, { node: id }), seg(c, truncRunes(nm.get(id) ?? n.name, inner - 2), undefined, { bold: true, node: id })]),
    body([seg(c, truncRunes([n.persona, n.model].filter(Boolean).join(' · '), inner), DIM, { node: id })]),
    body(row3),
    body([...bar, seg(c, ` ${metric(n)} `), seg(c, time, DIM)]),
    [seg(c, b.bl + b.h.repeat(inner) + b.br, edge)],
  ]
}

function cardLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView): { lines: Line[]; tops: number[] } {
  const c = v.caps, frame = v.frame ?? 0, tl = timeline(g, now)
  const V = c.ascii ? ':' : '┊', H = c.ascii ? '.' : '┄'
  const flowOf = (n: Node) => (n.git?.worktree ? n.git.branch ?? n.git.worktree : '')
  const agentKids = (n: Node) => n.children.filter(k => k.kind === 'agent' && keep.has(k.id))
  const sizeOf = (n: Node): number => 1 + agentKids(n).reduce((a, k) => a + sizeOf(k), 0)
  const anyWt = [...g.nodes.values()].some(n => n.kind === 'agent' && flowOf(n))
  const divider = (label: string, count: number): Line => {
    const text = c.ascii ? `== worktree: ${label} · ${count} agentes ` : `━━ ⎇ worktree: ${label} · ${count} agentes `
    return [seg(c, text + (c.ascii ? '=' : '━').repeat(Math.max(0, v.width - [...text].length)), flowOf({ git: { worktree: label } } as Node) || label === 'principal' ? (label === 'principal' ? DIM : WORKTREE_COLOR) : DIM)]
  }
  const lines: Line[] = [], tops: number[] = []
  let idx = 0
  const emitCards = (nodes: Node[], x: number): Line[][] => nodes.map(n => card(n, nm, c, now, frame, idx++))
  // lays out children of `parent` at parentX; returns lines (relative), parent bottom border already emitted by caller
  const layoutChildren = (parent: Node, px: number, virtual: boolean, parentFlow: string): Line[] => {
    const kids = agentKids(parent)
    const x = px + CARD_INDENT
    const per = perRowOf(v.width, px)
    const leaf = (k: Node) => agentKids(k).length === 0 && flowOf(k) === parentFlow
    const leaves = kids.filter(leaf), branches = kids.filter(k => !leaf(k))
    type Row = { kind: 'leaves'; ns: Node[] } | { kind: 'branch'; n: Node }
    const rows: Row[] = []
    for (let i = 0; i < leaves.length; i += per) rows.push({ kind: 'leaves', ns: leaves.slice(i, i + per) })
    branches.forEach(n => rows.push({ kind: 'branch', n }))
    const out: Line[] = []
    rows.forEach((row, ri) => {
      const more = ri < rows.length - 1
      const block: Line[] = []
      const ns = row.kind === 'leaves' ? row.ns : [row.n]
      if (row.kind === 'branch' && anyWt && flowOf(row.n) !== parentFlow) {
        const sz = sizeOf(row.n)
        block.push(divider(flowOf(row.n) || 'principal', sz))
      }
      const xs = ns.map((_, i) => x + i * (CARD_W + CARD_GAP))
      if (!virtual) {
        // bus: row below the parent's bottom border (first row) or below the previous row
        const last = xs[xs.length - 1]! + 1
        const bus: Line = [seg(c, ' '.repeat(px + 1), undefined), seg(c, c.ascii ? (more ? ':' : "'") : more ? '├' : '╰', DIM)]
        let text = ''
        for (let col = px + 2; col <= last; col++) text += xs.some(xx => xx + 1 === col) ? (c.ascii ? ':' : '┬') : H
        bus.push(seg(c, text, DIM))
        block.push(bus)
      }
      const cards = emitCards(ns, x)
      for (let r = 0; r < CARD_H; r++) {
        const parts: Line = [...sp(x)]
        cards.forEach((cd, i) => { if (i) parts.push(...sp(CARD_GAP)); parts.push(...cd[r]!) })
        block.push(parts)
      }
      tops.push(lines.length + out.length + (block.length - CARD_H))
      if (row.kind === 'branch') block.push(...layoutChildren(row.n, x, false, flowOf(row.n)))
      // dotted vertical in the parent's column while more rows follow
      out.push(...block.map(l => (!virtual && more ? putCol(l, px + 1, V, DIM) : l)))
    })
    return out
  }
  const top = agentKids(g.root)
  const groups = new Map<string, Node[]>()
  for (const n of top) { const f = flowOf(n); groups.set(f, [...(groups.get(f) ?? []), n]) }
  const virtualRoot = g.root
  for (const [f, ns] of [...groups.entries()].sort((a, b) => Number(!!a[0]) - Number(!!b[0]))) {
    if (anyWt) lines.push(divider(f || 'principal', ns.reduce((a, n) => a + sizeOf(n), 0)))
    // reuse layoutChildren with a synthetic parent holding only this flow's top-level agents
    const syn: Node = { ...virtualRoot, children: ns }
    const before = tops.length
    const body = layoutChildren(syn, -CARD_INDENT, true, f)
    lines.push(...body)
    void before
  }
  return { lines, tops }
}

function waterfallLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView): Line[] {
  const c = v.caps, tl = timeline(g, now), frame = v.frame ?? 0
  const nameW = v.width >= 100 ? 24 : 14, cells = Math.max(10, v.width - nameW - 18)
  const out: Line[] = []
  const secs = Math.round(tl.tot / 1000)
  const axis = `${'0s'}${' '.repeat(Math.max(1, cells - 4 - String(secs).length))}${secs}s`
  out.push([seg(c, ' '.repeat(nameW + 4) + axis, DIM)])
  let idx = 0
  const walk = (n: Node, d: number) => {
    for (const k of n.children.filter(x => x.kind === 'agent' && keep.has(x.id))) {
      const grow = growth(c, k, idx++, now)
      const [ob, cb] = c.ascii ? ['|', '|'] : ['▕', '▏']
      out.push(fit([seg(c, glyph(c, k.state) + ' ', STATE_COLOR[k.state], { node: k.id }),
        seg(c, truncRunes('  '.repeat(d) + (nm.get(k.id) ?? k.name), nameW).padEnd(nameW), undefined, { node: k.id }), seg(c, ' ' + ob, DIM),
        ...spanBar(k, tl.t0, tl.tot, now, cells, c, frame, grow), seg(c, cb + ' ' + fmtMMSS(durationOf(k, now)), DIM)], v.width))
      walk(k, d + 1)
    }
  }
  walk(g.root, 0)
  return out
}

export function renderCompact(agents: AgentLike[], now: number, v: CView): Line[] {
  const w = v.width
  if (layoutLevel(w) === 'line') return [fit([seg(v.caps, statusText(agents, now, v.caps.ascii))], w)]
  const g = buildGraph(agents, now)
  const nm = names(g)
  const keep = visibleSet(g, v.query, hiddenIds(g, now))
  let hint = ''
  const out: Line[] = [...header(g, agents, now, v)]
  if (v.query) out.push([seg(v.caps, `busca: ${v.query}`, DIM)])
  if (agents.length === 0) out.push([seg(v.caps, 'Aguardando agentes… use o Claude normalmente', DIM)])
  else {
    const bad = [...g.nodes.values()].filter(n => n.kind === 'agent' && keep.has(n.id) && (n.state === 'failed' || n.state === 'attention'))
    if (v.mode === 'grouped' && bad.length) {
      out.push([seg(v.caps, `Atenção (${bad.length})`, STATE_COLOR.attention, { bold: true })])
      for (const n of bad) out.push(fit([seg(v.caps, '  ' + glyph(v.caps, n.state) + ' ', STATE_COLOR[n.state], { node: n.id }),
        seg(v.caps, nm.get(n.id) ?? n.name, undefined, { bold: true, node: n.id }), seg(v.caps, n.error ? '  ' + n.error : '', DIM)], w))
    }
    if (v.mode === 'cards') {
      const { lines, tops } = cardLines(g, nm, keep, now, v)
      const cap = Math.max(CARD_H + 1, v.maxLines ?? v.maxCardRows * (CARD_H + 2))
      if (lines.length > cap) {
        const cut = tops.filter(t => t + CARD_H <= cap)
        const keepN = Math.max(1, cut.length), at = cut.length ? cut[cut.length - 1]! + CARD_H : cap
        out.push(...lines.slice(0, at))
        hint = `${v.caps.ascii ? 'v' : '↓'} +${tops.length - keepN} cards`
      } else out.push(...lines)
    } else if (v.mode === 'waterfall') out.push(...waterfallLines(g, nm, keep, now, v))
    else out.push(...treeLines(g, nm, keep, now, v))
  }
  out.push(...footer(g, v, hint))
  return out.map(l => fit(l, w))
}

// ---------- detail ----------
export function detailCompact(agents: AgentLike[], id: string, now: number, caps: Caps): Line[] | undefined {
  const a = agents.find(x => x.id === id)
  if (!a) return undefined
  const g = buildGraph(agents, now)
  const n = g.nodes.get(id)
  if (!n) return undefined
  const nm = names(g)
  const row = (k: string, val: string): Line => [seg(caps, k + ': ', DIM), seg(caps, val)]
  const link = (x: Node): Seg => seg(caps, `${glyph(caps, x.state)} ${nm.get(x.id) ?? x.name}`, STATE_COLOR[x.state], { node: x.kind === 'agent' ? x.id : undefined })
  const sibs = (g.nodes.get(n.parentId)?.children ?? []).filter(k => k.kind === 'agent')
  const idx = sibs.findIndex(k => k.id === id)
  const parent = g.nodes.get(n.parentId)
  const kids = n.children
  // a TodoWrite chain: each task waits on the previous one
  const blockedBy = kids.flatMap(k => k.dependsOn.map(d => g.nodes.get(d)).filter((x): x is Node => !!x && x.state !== 'done'))
  const out: Line[] = [
    [seg(caps, glyph(caps, n.state) + ' ', STATE_COLOR[n.state]), seg(caps, nm.get(id) ?? n.name, undefined, { bold: true })],
    [seg(caps, [n.persona, n.model, n.effort].filter(Boolean).join(' · '), DIM)],
    row('Estado', n.state), row('Progresso', metric(n)), row('Duração', fmtMMSS(durationOf(n, now))),
    row('Descrição', a.description),
  ]
  if (n.error) out.push(row('Erro', n.error))
  if (n.tool) out.push(row('Agora', n.tool))
  if (a.recent?.length) out.push(row('Log', [...a.recent].reverse().join(' < ')))
  out.push([], [seg(caps, 'Dependências', undefined, { bold: true })])
  out.push([seg(caps, 'Pai: ', DIM), parent && parent.kind === 'agent' ? link(parent) : seg(caps, 'sessão')])
  out.push([seg(caps, 'Filhos: ', DIM), ...(kids.length ? kids.slice(0, 6).flatMap((k, i) => [...sp(i ? 1 : 0), link(k)]) : [seg(caps, '—')])])
  out.push([seg(caps, 'Bloqueado por: ', DIM), ...(blockedBy.length ? blockedBy.slice(0, 4).flatMap((k, i) => [...sp(i ? 1 : 0), link(k)]) : [seg(caps, '—')])])
  out.push([seg(caps, 'Bloqueia: ', DIM), seg(caps, '—')])
  if (sibs.length > 1) out.push([seg(caps, `Irmãos (${idx + 1}/${sibs.length}): `, DIM),
    ...(idx > 0 ? [seg(caps, '[ anterior ', undefined, { node: sibs[idx - 1]!.id })] : []),
    ...(idx < sibs.length - 1 ? [seg(caps, '] próximo', undefined, { node: sibs[idx + 1]!.id })] : []),
    ...sibs.filter(k => k.id !== id).slice(0, 4).flatMap(k => [...sp(1), link(k)])])
  if (a.files?.length) { out.push([], [seg(caps, 'Anexos', undefined, { bold: true })], ...a.files.map(f => [seg(caps, '  ' + f, '#60a5fa', { attach: f })] as Line)) }
  if (a.prompt) out.push([], [seg(caps, 'Prompt', undefined, { bold: true })], [seg(caps, a.prompt)])
  return out
}

const IMG = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
// Inline preview of an attachment: colored diff, plain text/log, or a fallback for images.
export function previewLines(text: string, path: string, max: number): Line[] {
  if (IMG.test(path)) return [[{ t: 'imagem: pré-visualização inline indisponível neste mod; abra o arquivo externamente.', fg: DIM }]]
  const lines = text.split('\n')
  const diff = /\.(diff|patch)$/i.test(path) || lines.some(l => l.startsWith('@@'))
  const colorOf = (l: string) => !diff ? undefined : l.startsWith('+') && !l.startsWith('+++') ? '#22c55e' : l.startsWith('-') && !l.startsWith('---') ? '#ef4444' : l.startsWith('@@') ? '#06b6d4' : undefined
  const out: Line[] = lines.slice(0, max).map(l => [{ t: l, fg: colorOf(l) }])
  if (lines.length > max) out.push([{ t: `… +${lines.length - max} linhas`, fg: DIM }])
  return out
}

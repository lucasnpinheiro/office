// Office compact view: one-line tree, grouped/ungrouped modes, rounded cards, detail with dependencies,
// attachment preview and terminal capability detection. Pure (no engine APIs): the caller passes `now`.
// Terminal and app share this state model; only the drawing of the Lines differs.
import { buildGraph, progressOf, overallProgress, etaOf, durationOf, elapsedOf, hiddenIds, maxDepthOf, fmtMMSS, fmtHMS,
  truncRunes, lineWidth, strWidth, takeWidth, padWidth, charWidth, isOpenNode, STATE_COLOR, WORKTREE_COLOR, MAX_DEPTH, isQuotaError } from './monitor'
import type { Node, State, Seg, Line, Graph } from './monitor'
import type { AgentLike } from './office'
import { nodeView, stateColor, keyOf, labelOf, bindable, noColorSet, truthy } from './vocabulary'
import { CAPABILITIES } from './capabilities'
import type { Capabilities } from './capabilities'
import { worktreePartition, groupDivider, restDivider } from './view-worktrees'
import type { AheadInfo } from './git'
import { buildRunModel, RUN_STATE } from './run-model'
import type { RunModel } from './run-model'
import { costLines, fmtTokens, fmtUsd } from './view-cost'
import { toolLines } from './view-tools'
import { workflowLines } from './view-workflow'
import { detailView } from './view-detail'
import { termLevel, effectiveCols, appColumns, rowStyle, fitAgora } from './layout'

export { isQuotaError }

// ---------- capabilities ----------
export type Caps = { ascii: boolean; numbered: boolean; color: 'truecolor' | '256' | '16' | 'mono'; reducedMotion: boolean }

export function detectCaps(env: Record<string, string | undefined>, o: { isTTY?: boolean; ascii?: boolean } = {}): Caps {
  const term = (env.TERM ?? '').toLowerCase()
  const loc = env.LC_ALL || env.LC_CTYPE || env.LANG || ''
  const legacy = env.OS === 'Windows_NT' && !env.WT_SESSION && !env.TERM_PROGRAM && !env.ConEmuANSI && !env.ANSICON
  const ascii = !!o.ascii || truthy(env.OFFICE_ASCII) || term === 'linux' || term === 'dumb' || (loc !== '' && !/utf-?8/i.test(loc)) || legacy
  const tty = o.isTTY !== false
  const color: Caps['color'] = noColorSet(env.NO_COLOR) || !tty || term === 'dumb' ? 'mono'
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

const RANK: Record<State, number> = { failed: 0, attention: 1, running: 2, pending: 3, inactive: 4, done: 5 }
export const sortNodes = (ns: Node[], sort: CView['sort'] = 'time'): Node[] =>
  sort === 'state' ? [...ns].sort((a, b) => RANK[a.state] - RANK[b.state])
    : sort === 'name' ? [...ns].sort((a, b) => a.name.localeCompare(b.name)) : ns

// 100+ full, 60 a 99 compact (abbr), abaixo de 60 só lista (line); largura desconhecida cai em 80 (layout.ts, AC-042/AC-044)
export const layoutLevel = (w: number): 'full' | 'abbr' | 'line' => ({ full: 'full', compact: 'abbr', list: 'line' } as const)[termLevel(w)]

// ---------- glyphs ----------
// Glifo e rótulo vêm da tabela única (vocabulary.STATE_TABLE); estado desconhecido vira `?` em muted (AC-016).
const vocabOf = (c: Caps) => ({ ascii: c.ascii, color: c.color !== 'mono' })
const glyph = (c: Caps, s: string) => nodeView(s, vocabOf(c)).glyph
export const stateGlyph = glyph
const stateLabel = (c: Caps, s: string) => nodeView(s, vocabOf(c)).label
type Box = { tl: string; tr: string; bl: string; br: string; v: string; h: string }
export const boxChars = (c: Caps): Box =>
  c.numbered ? { tl: '+', tr: '+', bl: '+', br: '+', v: '|', h: '-' }
    : c.ascii ? { tl: '.', tr: '.', bl: "'", br: "'", v: '|', h: '-' }
      : { tl: '╭', tr: '╮', bl: '╰', br: '╯', v: '│', h: '─' }
const BAR = (c: Caps) => (c.ascii ? ['#', '.'] : ['█', '▒']) as [string, string]
const DIM = '#9ca3af'

export type Mode = 'tree' | 'grouped' | 'cards' | 'waterfall' | 'cost' | 'tools' | 'workflow'
export const MODES: Mode[] = ['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow']
export const DEFAULT_MODE: Mode = 'cards'
// g cycle. `workflow` is only a stop while a workflow run exists (applyAction skips it otherwise: an always-empty screen is not shown).
export const NEXT_MODE: Record<Mode, Mode> = { tree: 'grouped', grouped: 'cards', cards: 'waterfall', waterfall: 'cost', cost: 'tools', tools: 'workflow', workflow: 'tree' }
export type CView = {
  width: number; caps: Caps; mode: Mode; query: string; expanded: Set<string>; maxCardRows: number; maxLines?: number
  filter?: 'all' | 'failed'; sort?: 'time' | 'state' | 'name'; frame?: number; project?: string; sessionId?: string; capabilities?: Capabilities
  ahead?: Record<string, AheadInfo> // by worktree key: real base + commits ahead; absent = unknown (AC-023)
  model?: RunModel // built once by the caller (register.tsx) with the session tokens; built here from the agents when absent
  captureIo?: boolean // OFFICE_CAPTURE_IO=1: the Tools view may show masked input/output
  sessionUsd?: number // `$.session.usage().cost.usd`, only when the engine gave it
  containerPx?: number // app container width (px), only when the engine reports it (ADR 0002: containerWidth not-verified); absent = terminal rules
}
// Árvore: irmãos com o mesmo estado acima de 8 viram `Rodando ×N`; `g` com este item em expanded abre todos (AC-019).
export const TREE_ALL = 'tree:all'
export const TREE_COLLAPSE_OVER = 8

const sp = (n: number): Seg[] => (n > 0 ? [{ t: ' '.repeat(n) }] : [])
const col = (c: Caps, hex?: string) => quantize(hex, c.color)
const seg = (c: Caps, t: string, fg?: string, extra: Partial<Seg> = {}): Seg => ({ t, fg: col(c, fg), ...extra })
const fit = (l: Line, w: number): Line => {
  const out: Line = []; let used = 0
  for (const s of l) {
    if (used >= w) break
    const sw = strWidth(s.t)
    if (used + sw <= w) { out.push(s); used += sw; continue }
    out.push({ ...s, t: takeWidth(s.t, w - used) }); break
  }
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
  const active = [...g.nodes.values()].filter(n => n.kind === 'agent' && isOpenNode(n))
  const p = overallProgress(g)
  const chip = active.length ? ` · @ ${truncRunes(active[active.length - 1]!.name, 20)}` : ''
  const t = `${nodeView('running', { ascii, color: true }).glyph} ${active.length} ativos · ${p === undefined ? '—' : Math.round(p * 100) + '%'}${chip}`
  return ascii ? asciiText(t) : t
}

// ---------- ASCII fallback ----------
// OFFICE_ASCII / non-UTF-8 locales get plain ASCII everywhere: punctuation mapped, accents stripped, anything else
// replaced by '?' cell for cell (a wide glyph by '??'), so the layout measured before the mapping still holds.
const ASCII_MAP: Record<string, string> = {
  '·': '-', '—': '-', '–': '-', '…': '.', '“': '"', '”': '"', '‘': "'", '’': "'", '‹': '<', '›': '>', '▸': '>', '←': '<',
  '→': '>', '↓': 'v', '↑': '^', '×': 'x', '⎇': 'Y', '━': '=', '─': '-', '│': '|', '┊': ':', '┄': '.', '├': '|', '┬': '+',
  '╰': "'", '╭': '.', '╮': '.', '╯': "'", '█': '#', '▒': '.', '░': '.', '▰': '#', '▱': '.', '●': '*', '○': 'o', '✓': 'v',
  '✗': 'x', '▲': '!', '◌': '-', 'ª': 'a', 'º': 'o',
}
export function asciiText(t: string): string {
  let out = ''
  for (const ch of t) {
    const cp = ch.codePointAt(0)!
    if (cp < 128) { out += ch; continue }
    const m = ASCII_MAP[ch]
    if (m !== undefined) { out += m; continue }
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (base.length === 1 && base.charCodeAt(0) < 128) { out += base; continue }
    const w = charWidth(cp)
    out += w === 2 ? '??' : w === 0 ? '' : '?'
  }
  return out
}
export const asciiLine = (l: Line): Line => l.map(s => ({ ...s, t: asciiText(s.t) }))

const matches = (n: Node, q: string) => !q || `${n.name} ${n.persona} ${n.model}`.toLowerCase().includes(q.toLowerCase())
function visibleSet(g: Graph, q: string, hidden: Set<string>, filter: 'all' | 'failed' = 'all'): Set<string> {
  const keep = new Set<string>()
  const walk = (n: Node): boolean => {
    const kids = n.children.map(walk).some(Boolean)
    const ok = n.kind === 'session' || (!hidden.has(n.id) && (matches(n, q) && (filter === 'all' || n.state === 'failed' || n.state === 'attention') || kids))
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
  const act = n_(isOpenNode), ok = n_(n => n.state === 'done'), bad = n_(n => n.state === 'failed')
  // tokens come from the RunModel (per agent + main session, `partial` when something is unknown); the session USD only when the engine gave it
  const tot = (v.model ?? buildRunModel(agents, now, v.capabilities ?? CAPABILITIES)).totals
  const tokTxt = tot.tokens === undefined ? '—' : fmtTokens(tot.tokens) + (tot.partial ? ' parcial' : '')
  const usdTxt = v.sessionUsd === undefined ? '' : ` · ${fmtUsd(v.sessionUsd)}`
  const sid = String(v.sessionId ?? '').replace(/[^\w-]/g, '').slice(0, 6)
  const left: Line = [seg(c, 'Office', undefined, { bold: true }), seg(c, ` · ${v.project || '-'}${sid ? ' · #' + sid : ''}`, DIM)]
  // below the full layout the right side drops the words and the ETA, so the "Office" title keeps its room
  const full = layoutLevel(w) === 'full'
  const right: Line = [seg(c, `${glyph(c, 'running')} ${act}${full ? ' ativos' : ''}`, STATE_COLOR.running), seg(c, ` ${glyph(c, 'done')} ${ok}`, STATE_COLOR.done),
    seg(c, ` ${glyph(c, 'failed')} ${bad}`, STATE_COLOR.failed),
    seg(c, full ? ` · ${fmtHMS(agents.length ? elapsedOf(g, now) : 0)} · tokens ${tokTxt}${usdTxt} · ${eta === undefined ? 'ETA calculando' : 'ETA ' + fmtHMS(eta)}` : ` · ${fmtMMSS(agents.length ? elapsedOf(g, now) : 0)}${w >= 60 ? ' · ' + (tot.tokens === undefined ? '—' : fmtTokens(tot.tokens)) : ''}`, DIM)]
  const geral: Line = [seg(c, 'Geral '), ...segBar(g, c, layoutLevel(w) === 'full' ? 20 : 10), seg(c, ` ${prog === undefined ? '—' : Math.round(prog * 100) + '%'} · `),
    seg(c, keyOf('group') ?? 'g', undefined, { act: 'group', bold: true }), seg(c, ' alterna modo', DIM)]
  // sem agente não há progresso a mostrar: a linha Geral (com barra) só existe quando há agentes (AC-020)
  return [...ROUND_BOX(c, w, left, right), ...(agents.length ? [fit(geral, w)] : [])]
}

function filterBar(g: Graph, v: CView): Line {
  const c = v.caps
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent')
  const bad = ns.filter(n => n.state === 'failed' || n.state === 'attention').length
  const btn = (t: string, act: string, on: boolean): Seg[] => [seg(c, ` ${t} `, undefined, { act, btn: true, variant: on ? 'primary' : 'secondary', bold: on }), ...sp(1)]
  return fit([...btn('Agrupado', 'mode:grouped', v.mode === 'grouped'), ...btn(`Todos os cards ${ns.length}`, 'mode:cards', v.mode !== 'grouped' && v.filter !== 'failed'),
    ...btn(`Falhas ${bad}`, 'failed', v.filter === 'failed'), ...(v.query ? [seg(c, `busca: ${v.query}`, DIM)] : [])], v.width)
}

// Footer per design (Rodada 4): scroll-hint box, legend, bus legend. The hotkey row is drawn by the pane
// from the view state (actions.ts hotkeysFor), so keys stay unique and go quiet while searching.
function footer(g: Graph, v: CView, hint = ''): Line[] {
  const c = v.caps
  const states: State[] = ['done', 'running', 'attention', 'pending', 'failed']
  const legend: Line = states.flatMap((s, i) => [...sp(i ? 2 : 0), seg(c, `${glyph(c, s)} ${stateLabel(c, s)}`, stateColor(s))])
  const out: Line[] = []
  if (hint) out.push(...ROUND_BOX(c, v.width, [seg(c, hint, DIM)], [seg(c, `${keyOf('search')} ${labelOf('search')} · ${keyOf('sort')} ${labelOf('sort')}`, DIM)]))
  out.push([seg(c, (c.ascii ? '-' : '─').repeat(v.width), '#374151')], fit(legend, v.width))
  if (v.mode === 'cards') out.push(fit([seg(c, c.ascii ? ": |-:-: ' barramento pai-irmãos · == worktree ==" : '┊ ├┬┬ ╰ barramento pai→irmãos · ━━ worktree: nome ━━ divisor', DIM)], v.width))
  if (v.mode === 'tree') out.push(fit([seg(c, `Níveis de profundidade: ${maxDepthOf(g)}/${MAX_DEPTH}`, DIM)], v.width))
  return out
}

// Topo da árvore: ◆ (decisão) e ✗ (falha) sempre primeiro. A tecla da ação só aparece se a capability for `yes` (AC-018).
function pinnedLines(g: Graph, nm: Map<string, string>, keep: Set<string>, v: CView): Line[] {
  const c = v.caps
  // só a falha tem ação hoje (retry); a decisão (needs-you, ◆) entra com T-011 e o estado correspondente
  const ret = bindable(v.capabilities ?? CAPABILITIES, 'terminal').find(e => e.act === 'retry')
  return [...g.nodes.values()]
    .filter(n => n.kind === 'agent' && keep.has(n.id) && (n.state === 'attention' || n.state === 'failed'))
    .sort((a, b) => Number(b.state === 'attention') - Number(a.state === 'attention'))
    .map(n => {
      const e = n.state === 'failed' ? ret : undefined
      const left: Line = [seg(c, glyph(c, n.state) + ' ', stateColor(n.state), { node: n.id }),
        seg(c, nm.get(n.id) ?? n.name, undefined, { bold: true, node: n.id }), seg(c, n.error ? '  ' + n.error : '', DIM)]
      return e ? spread(left, [seg(c, `${e.key} ${e.label}`, DIM)], v.width) : fit(left, v.width)
    })
}

function treeLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView, start: Node = g.root): Line[] {
  const c = v.caps, lvl = layoutLevel(v.width), out: Line[] = []
  const br = c.ascii ? { mid: '|-', last: '`-', pipe: '| ', none: '  ' } : { mid: '├─', last: '└─', pipe: '│ ', none: '  ' }
  const row = (n: Node, prefix: string, label?: { name: string; extra?: string }): Line => {
    const name = label?.name ?? nm.get(n.id) ?? n.name
    const right = n.kind === 'task' ? metric(n) : `${label?.extra ?? metric(n)}  ${fmtMMSS(durationOf(n, now))}`
    const left: Line = [seg(c, prefix, DIM), seg(c, glyph(c, n.state) + ' ', stateColor(n.state), { node: n.kind === 'agent' ? n.id : undefined }),
      seg(c, name, undefined, { bold: n.kind === 'agent', node: n.kind === 'agent' ? n.id : undefined })]
    const meta = lvl === 'full' && n.kind === 'agent' ? [n.persona, n.model, n.effort].filter(Boolean).join('·') : ''
    const room = v.width - strWidth(right) - 2
    const l2 = fit(left, Math.max(8, room))
    const mid = meta && lineWidth(l2) + strWidth(meta) + 2 < room ? [...sp(1), seg(c, meta, DIM)] : []
    // `agora` (ferramenta em curso): o que encolhe primeiro; nome, métrica e tempo ficam (AC-044)
    const agora = n.kind === 'agent' && n.state === 'running' && n.tool ? fitAgora(n.tool, room - lineWidth(l2) - lineWidth(mid) - 3) : ''
    return spread([...l2, ...mid, ...(agora ? [seg(c, '  ' + agora, DIM)] : [])], [seg(c, right, DIM)], v.width)
  }
  const walk = (n: Node, prefix: string) => {
    const kids = sortNodes(n.children.filter(k => keep.has(k.id)), v.sort)
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
    } else if (v.mode === 'tree' && !v.expanded.has(TREE_ALL)) {
      // irmãos do mesmo estado acima do limite viram um grupo colapsado, na posição do primeiro (AC-019)
      const counts = new Map<State, number>()
      for (const k of kids) if (k.kind === 'agent' && !pinned(k)) counts.set(k.state, (counts.get(k.state) ?? 0) + 1)
      const done = new Set<State>()
      for (const k of kids) {
        const collapse = k.kind === 'agent' && !pinned(k) && (counts.get(k.state) ?? 0) > TREE_COLLAPSE_OVER
        if (!collapse) items.push({ n: k })
        else if (!done.has(k.state)) {
          done.add(k.state)
          items.push({ group: { state: k.state, ms: kids.filter(m => m.kind === 'agent' && !pinned(m) && m.state === k.state), key: `tree:${n.id}:${k.state}` } })
        }
      }
    } else kids.forEach(k => items.push({ n: k }))
    items.forEach((it, i) => {
      const last = i === items.length - 1
      const pre = prefix + (last ? br.last : br.mid)
      const nxt = prefix + (last ? br.none : br.pipe)
      if (it.group) {
        const gr = it.group, open = v.expanded.has(gr.key)
        const med = fmtMMSS(median(gr.ms.map(m => durationOf(m, now))))
        const tail = gr.key.startsWith('tree:') ? `  ${keyOf('group') ?? 'g'}: abrir todos` : `  mediana ${med}  ${open ? '[-]' : '[+]'}`
        out.push(fit([seg(c, pre, DIM), seg(c, glyph(c, gr.state) + ' ', stateColor(gr.state)),
          seg(c, `${stateLabel(c, gr.state)} ×${gr.ms.length}`, undefined, { bold: true, act: `grp:${gr.key}` }),
          seg(c, tail, DIM, { act: `grp:${gr.key}` })], v.width))
        if (open) gr.ms.forEach((m, j) => out.push(row(m, nxt + (j === gr.ms.length - 1 ? br.last : br.mid))))
      } else {
        out.push(row(it.n!, pre))
        walk(it.n!, nxt)
      }
    })
  }
  walk(start, '')
  return out
}

// Grouped mode with worktrees (T-007): each worktree is a divider with ITS agents nested under it, every agent once.
// A group's agents whose parent lives in another group (or none) become that group's top level.
function groupedLines(g: Graph, agents: AgentLike[], nm: Map<string, string>, keep: Set<string>, now: number, v: CView): Line[] {
  const part = worktreePartition(agents.filter(a => keep.has(a.id)))
  if (!part.groups.length) return treeLines(g, nm, keep, now, v)
  const sub = (list: AgentLike[], tag: string): Line[] => {
    const ids = new Set(list.map(a => a.id))
    const mine = new Set<string>()
    for (const n of g.nodes.values()) if (keep.has(n.id) && (ids.has(n.id) || (n.kind === 'task' && ids.has(n.parentId)))) mine.add(n.id)
    const top = [...g.nodes.values()].filter(n => ids.has(n.id) && !ids.has(n.parentId))
    return treeLines(g, nm, mine, now, v, { ...g.root, id: `wt:${tag}`, children: top }) // the id keys the `Rodando ×N` groups: one set per worktree
  }
  const out: Line[] = []
  for (const grp of part.groups) out.push(...groupDivider(grp, v.ahead?.[grp.key]), ...sub(grp.agents, grp.key))
  if (part.rest.length) out.push(...restDivider(part.rest.length), ...sub(part.rest, 'rest'))
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
  const col_ = stateColor(n.state), run = n.state === 'running'
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
  const b = boxChars(c), inner = CARD_W - 2, col_ = stateColor(n.state), edge = BORDER[n.state]
  const k = growth(c, n, idx, now)
  const id = n.id
  const body = (l: Line): Line => [seg(c, b.v, edge), ...fit([...l, ...sp(inner)], inner), seg(c, b.v, edge)]
  const kids = n.children.filter(x => x.kind === 'agent').length
  const sep = c.ascii ? '<' : '‹', tri = c.ascii ? '>' : '▸'
  const trail = [n.tool, ...[...(n.recent ?? [])].reverse().filter((x, i) => !(i === 0 && x === n.tool))].filter(Boolean).join(` ${sep} `)
  const tasks = n.children.filter(x => x.kind === 'task')
  const tdone = tasks.filter(x => x.state === 'done').length
  const row3: Line =
    n.state === 'pending' ? [seg(c, 'aguarda 1ª ação', DIM)] :
    n.state === 'done' ? [seg(c, 'concluído', DIM)]
      : n.state === 'failed' ? [seg(c, `${glyph(c, 'failed')} ${n.error ?? 'falha'}`, STATE_COLOR.failed)]
        : n.state === 'attention' ? [seg(c, `${glyph(c, 'attention')} ${n.error ?? 'sem atividade'}`, STATE_COLOR.attention)]
            : [seg(c, `${tri} ${kids ? `delega ${kids} filhos` : [tasks.length ? `${tdone}/${tasks.length}` : '', trail].filter(Boolean).join(' · ') || 'executando'}`, DIM)]
  const cells = 12, [on, off] = BAR(c)
  const leafRunning = n.state === 'running' && n.children.length === 0
  const pctText = tasks.length ? `${Math.round((tdone / tasks.length) * 100)}%` : metric(n)
  let bar: Line
  if (leafRunning) {
    // no real percent for a leaf without tasks: indeterminate sweep, never an invented number
    const pos = c.reducedMotion ? 0 : frame % (cells + 3)
    const sweep = Array.from({ length: cells }, (_, i) => (i <= pos && i > pos - 3 ? on : off))
    bar = sweep.map(ch => seg(c, ch, ch === on ? col_ : DIM))
  } else bar = partialBar((n.state === 'done' ? 1 : n.state === 'failed' ? 0.6 : progressOf(n) ?? 0) * k, cells, c, col_, n.state === 'running', frame)
  const time = n.start === undefined || n.state === 'pending' ? '--:--' : fmtMMSS(durationOf(n, now))
  return [
    [seg(c, b.tl + b.h.repeat(inner) + b.tr, edge)],
    body([seg(c, glyph(c, n.state) + ' ', col_, { node: id }), seg(c, truncRunes(nm.get(id) ?? n.name, inner - 2), undefined, { bold: true, node: id })]),
    body([seg(c, truncRunes([n.persona, n.model].filter(Boolean).join(' · '), inner), DIM, { node: id })]),
    body(row3),
    body([...bar, seg(c, ` ${pctText} `), seg(c, time, DIM)]),
    [seg(c, b.bl + b.h.repeat(inner) + b.br, edge)],
  ]
}

// tops: absolute line of each card row's top border + how many cards that row holds (for the hidden-cards hint)
function cardLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView): { lines: Line[]; tops: { at: number; n: number }[] } {
  const c = v.caps, frame = v.frame ?? 0, tl = timeline(g, now)
  const V = c.ascii ? ':' : '┊', H = c.ascii ? '.' : '┄'
  const flowOf = (n: Node) => (n.git?.worktree ? n.git.branch ?? n.git.worktree : '')
  const agentKids = (n: Node) => sortNodes(n.children.filter(k => k.kind === 'agent' && keep.has(k.id)), v.sort)
  const anyWt = [...g.nodes.values()].some(n => n.kind === 'agent' && flowOf(n))
  const all = (n: Node): Node[] => [n, ...agentKids(n).flatMap(all)]
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const divider = (label: string, roots: Node[]): Line => {
    const nodes = roots.flatMap(all)
    const kids = roots.some(r => agentKids(r).length) ? roots.flatMap(agentKids) : roots
    const line = kids.filter(k => agentKids(k).length === 0).length, grand = kids.filter(k => agentKids(k).length > 0).length
    const st = (s: State) => nodes.filter(n => n.state === s).length
    const parts = [plural(nodes.length, 'agente', 'agentes'),
      line || grand ? `${plural(line, 'filho', 'filhos')} em linha${grand ? `, ${grand} com neto` : ''}` : '',
      [st('failed') ? plural(st('failed'), 'falha', 'falhas') : '', st('done') ? plural(st('done'), 'concluído', 'concluídos') : '', st('pending') ? `${st('pending')} na fila` : ''].filter(Boolean).join(', ')].filter(Boolean)
    // "N agentes" keeps the plural form the design uses for the count
    parts[0] = `${nodes.length} agentes`
    const text = `${c.ascii ? '== ' : '━━ ⎇ '}worktree: ${label} · ${parts.join(' · ')} `
    return [seg(c, text + (c.ascii ? '=' : '━').repeat(Math.max(0, v.width - strWidth(text))), label === 'principal' ? DIM : WORKTREE_COLOR)]
  }
  const lines: Line[] = [], tops: { at: number; n: number }[] = []
  let idx = 0
  const emitCards = (nodes: Node[], x: number): Line[][] => nodes.map(n => card(n, nm, c, now, frame, idx++))
  // lays out children of `parent` at parentX; returns lines (relative), parent bottom border already emitted by caller.
  // `base` = absolute line where the returned lines will land, so nested rows record their real top.
  const layoutChildren = (parent: Node, px: number, virtual: boolean, parentFlow: string, base: number): Line[] => {
    const kids = agentKids(parent)
    const x = px + CARD_INDENT
    const per = Math.min(perRowOf(v.width, px), v.containerPx === undefined ? Infinity : appColumns(v.containerPx))
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
        block.push(divider(flowOf(row.n) || 'principal', [row.n]))
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
      tops.push({ at: base + out.length + (block.length - CARD_H), n: ns.length })
      if (row.kind === 'branch') block.push(...layoutChildren(row.n, x, false, flowOf(row.n), base + out.length + block.length))
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
    if (anyWt) lines.push(divider(f || 'principal', ns))
    // reuse layoutChildren with a synthetic parent holding only this flow's top-level agents
    const syn: Node = { ...virtualRoot, children: ns }
    const before = tops.length
    const body = layoutChildren(syn, -CARD_INDENT, true, f, lines.length)
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
      out.push(fit([seg(c, glyph(c, k.state) + ' ', stateColor(k.state), { node: k.id }),
        seg(c, padWidth(truncRunes('  '.repeat(d) + (nm.get(k.id) ?? k.name), nameW), nameW), undefined, { node: k.id }), seg(c, ' ' + ob, DIM),
        ...spanBar(k, tl.t0, tl.tot, now, cells, c, frame, grow), seg(c, cb + ' ' + fmtMMSS(durationOf(k, now)), DIM)], v.width))
      walk(k, d + 1)
    }
  }
  walk(g.root, 0)
  return out
}

// True when the tree (mode tree, g not yet opened) would show at least one `Rodando ×N` group: same rule as treeLines.
export function treeHasCollapsed(agents: AgentLike[], now: number, v: Pick<CView, 'query' | 'filter'>): boolean {
  const g = buildGraph(agents, now)
  const keep = visibleSet(g, v.query, hiddenIds(g, now), v.filter)
  const pinned = (k: Node) => k.state === 'failed' || k.state === 'attention'
  return [g.root, ...g.nodes.values()].some(n => {
    const counts = new Map<State, number>()
    for (const k of n.children) if (keep.has(k.id) && k.kind === 'agent' && !pinned(k)) counts.set(k.state, (counts.get(k.state) ?? 0) + 1)
    return [...counts.values()].some(x => x > TREE_COLLAPSE_OVER)
  })
}

export function renderCompact(agents: AgentLike[], now: number, v0: CView): Line[] {
  const w = effectiveCols(v0.width) // 0, negativa ou NaN: 80 colunas, uma coluna (AC-044)
  // app com container < 520 px: cards viram linhas de estado, nome e tempo (AC-043)
  const rows = v0.containerPx !== undefined && v0.mode === 'cards' && rowStyle(v0.containerPx) === 'row'
  const v: CView = { ...v0, width: w, mode: rows ? 'tree' : v0.mode }
  const g = buildGraph(agents, now)
  if (layoutLevel(w) === 'line') {
    // abaixo de 60 colunas só a lista: falha e decisão primeiro, depois as linhas da árvore
    const nm0 = names(g), keep0 = visibleSet(g, v.query, hiddenIds(g, now), v.filter)
    if (agents.length === 0) return [fit([seg(v.caps, 'Aguardando agentes…', DIM)], w)]
    const list = [...pinnedLines(g, nm0, keep0, v), ...treeLines(g, nm0, keep0, now, { ...v, mode: 'tree' })]
    return list.map(l => (v.caps.ascii ? asciiLine(fit(l, w)) : fit(l, w)))
  }
  const nm = names(g)
  const keep = visibleSet(g, v.query, hiddenIds(g, now), v.filter)
  const model = v.model ?? buildRunModel(agents, now, v.capabilities ?? CAPABILITIES)
  let hint = ''
  const out: Line[] = [...header(g, agents, now, v), ...(v.mode === 'grouped' ? [filterBar(g, v)] : [])]
  if (agents.length === 0) out.push([seg(v.caps, 'Aguardando agentes… use o Claude normalmente', DIM)])
  else {
    if (v.mode === 'tree') out.push(...pinnedLines(g, nm, keep, v))
    const bad = [...g.nodes.values()].filter(n => n.kind === 'agent' && keep.has(n.id) && (n.state === 'failed' || n.state === 'attention'))
    if (v.mode === 'grouped' && bad.length) {
      out.push([seg(v.caps, `Atenção (${bad.length})`, STATE_COLOR.attention, { bold: true })])
      for (const n of bad) out.push(fit([seg(v.caps, '  ' + glyph(v.caps, n.state) + ' ', stateColor(n.state), { node: n.id }),
        seg(v.caps, nm.get(n.id) ?? n.name, undefined, { bold: true, node: n.id }), seg(v.caps, n.error ? '  ' + n.error : '', DIM)], w))
    }
    if (v.mode === 'cards') {
      const { lines, tops } = cardLines(g, nm, keep, now, v)
      const cap = Math.max(CARD_H + 1, v.maxLines ?? v.maxCardRows * (CARD_H + 2))
      if (lines.length > cap) {
        const cut = tops.filter(t => t.at + CARD_H <= cap)
        const at = cut.length ? cut[cut.length - 1]!.at + CARD_H : cap
        const sum = (ts: { n: number }[]) => ts.reduce((k, t) => k + t.n, 0)
        const shown = cut.length ? sum(cut) : (tops[0]?.n ?? 0)
        out.push(...lines.slice(0, at))
        hint = `${v.caps.ascii ? '+' : '↓ +'}${sum(tops) - shown} cards ocultos (painel sem altura para mostrar todos)`
      } else out.push(...lines)
    } else if (v.mode === 'waterfall') out.push(...waterfallLines(g, nm, keep, now, v))
    else if (v.mode === 'cost') out.push(...costLines(model, now, { width: w, caps: v.caps, sessionUsd: v.sessionUsd }))
    else if (v.mode === 'tools') out.push(...toolLines(model, now, { width: w, caps: v.caps }, v.captureIo === true))
    else if (v.mode === 'workflow') {
      const wf = agents.filter(a => keep.has(a.id)).map(a => ({ id: a.id, name: nm.get(a.id) ?? a.description, state: nodeView(RUN_STATE[g.nodes.get(a.id)?.state ?? 'running'], vocabOf(v.caps)).label, workflow: a.workflow }))
      out.push(...workflowLines(wf).map((t): Line => [seg(v.caps, t, undefined, { bold: !t.startsWith('  ') })]))
    } else if (v.mode === 'grouped') out.push(...groupedLines(g, agents, nm, keep, now, v))
    else out.push(...treeLines(g, nm, keep, now, v))
  }
  out.push(...footer(g, v, hint))
  return out.map(l => (v.caps.ascii ? asciiLine(fit(l, w)) : fit(l, w)))
}

// ---------- detail ----------
// The detail screen is view-detail.ts (T-009); this keeps the Caps-aware wrapper (ASCII fallback) for callers that draw Lines.
export function detailCompact(agents: AgentLike[], id: string, now: number, caps: Caps, captureIo = false): Line[] | undefined {
  const d = detailView(agents, id, now, { captureIo })
  if (d.back) return undefined
  return caps.ascii ? d.lines.map(asciiLine) : d.lines
}

const IMG = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
// Inline preview of an attachment: colored diff, plain text/log, or a fallback for images.
export function previewLines(text: string, path: string, max: number): Line[] {
  if (IMG.test(path)) return [[{ t: 'imagem: pré-visualização inline indisponível neste modo; abra o arquivo externamente.', fg: DIM }]]
  const lines = text.split('\n')
  const diff = /\.(diff|patch)$/i.test(path) || lines.some(l => l.startsWith('@@'))
  const colorOf = (l: string) => !diff ? undefined : l.startsWith('+') && !l.startsWith('+++') ? '#22c55e' : l.startsWith('-') && !l.startsWith('---') ? '#ef4444' : l.startsWith('@@') ? '#06b6d4' : undefined
  const out: Line[] = lines.slice(0, max).map(l => [{ t: l, fg: colorOf(l) }])
  if (lines.length > max) out.push([{ t: `… +${lines.length - max} linhas`, fg: DIM }])
  return out
}

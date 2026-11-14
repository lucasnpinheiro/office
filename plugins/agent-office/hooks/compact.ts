// Office compact view: one-line tree, grouped/ungrouped modes, rounded cards, detail with dependencies,
// attachment preview and terminal capability detection. Pure (no engine APIs): the caller passes `now`.
// Terminal and app share this state model; only the drawing of the Lines differs.
import { buildGraph, progressOf, overallProgress, etaOf, durationOf, elapsedOf, hiddenIds, maxDepthOf, fmtMMSS, fmtHMS,
  truncRunes, lineWidth, strWidth, takeWidth, padWidth, charWidth, isOpenNode, STATE_COLOR, WORKTREE_COLOR, MAX_DEPTH, isQuotaError } from './monitor'
import type { Node, State, Seg, Line, Graph } from './monitor'
import type { AgentLike } from './office'
import { spinnerGlyph } from './motion'
import { nodeView, stateColor, keyOf, labelOf, bindable, noColorSet, truthy } from './vocabulary'
import { CAPABILITIES } from './capabilities'
import type { Capabilities } from './capabilities'
import { worktreePartition, groupDivider, restDivider, agentsLine } from './view-worktrees'
import type { AheadInfo } from './git'
import { buildRunModel, RUN_STATE } from './run-model'
import { chips } from './persona'
import type { RunModel, RunNode } from './run-model'
import { costLines, fmtTokens, fmtUsd } from './view-cost'
import { toolLines } from './view-tools'
import { workflowView } from './view-workflow'
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
// AC-045/046: o spinner do estado running gira com o quadro; fixo em ASCII, movimento reduzido ou sem quadro.
const glyph = (c: Caps, s: string, frame?: number) =>
  s === 'running' && frame !== undefined && !c.ascii && !c.reducedMotion ? spinnerGlyph(frame, false) : nodeView(s, vocabOf(c)).glyph
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
  width: number; caps: Caps; mode: Mode; query: string; expanded: Set<string>; maxCardRows: number; maxLines?: number; scroll?: number; branch?: string
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

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0 }

// Unique display names: duplicates get " #n".
export function names(g: Graph): Map<string, string> {
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
export function visibleSet(g: Graph, q: string, hidden: Set<string>, filter: 'all' | 'failed' = 'all'): Set<string> {
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
// centred chrome of the cards view (user decision: everything centred)
const centre = (l: Line, w: number): Line => { const lw = l.reduce((a, q) => a + strWidth(q.t), 0); return lw >= w ? l : [...sp(Math.floor((w - lw) / 2)), ...l] }

// Header per design (Proto5 top): "Office · project · ⎇ branch" with the cost on the right, a line of time and counts,
// then one bar segment per agent in its state colour, the full width of the pane.
function header(g: Graph, agents: AgentLike[], now: number, v: CView): Line[] {
  const { caps: c, width: w } = v
  const eta = etaOf(g)
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent')
  const n_ = (f: (n: Node) => boolean) => ns.filter(f).length
  const act = n_(isOpenNode), ok = n_(n => n.state === 'done'), bad = n_(n => n.state === 'failed')
  // tokens come from the RunModel (per agent + main session, `partial` when something is unknown); the session USD only when the engine gave it
  const tot = (v.model ?? buildRunModel(agents, now, v.capabilities ?? CAPABILITIES)).totals
  const tokTxt = tot.tokens === undefined ? '—' : fmtTokens(tot.tokens) + (tot.partial ? ' parcial' : '')
  const sid = String(v.sessionId ?? '').replace(/[^\w-]/g, '').slice(0, 6)
  const full = layoutLevel(w) === 'full'
  const left: Line = [seg(c, 'Office', undefined, { bold: true }),
    seg(c, ` · ${v.project || '-'}${v.branch ? ` · ${c.ascii ? 'br' : '⎇'} ${v.branch}` : ''}${sid ? ' · #' + sid : ''}`, DIM)]
  const right: Line = [seg(c, v.sessionUsd !== undefined ? fmtUsd(v.sessionUsd) : full ? `tokens ${tokTxt}` : tot.tokens === undefined ? '—' : fmtTokens(tot.tokens), undefined, { bold: true })]
  const dot = seg(c, ' · ', DIM)
  const counts: Line = [seg(c, full ? fmtHMS(agents.length ? elapsedOf(g, now) : 0) : fmtMMSS(agents.length ? elapsedOf(g, now) : 0), DIM), dot,
    seg(c, `${act} rodando`, STATE_COLOR.running), dot, seg(c, `${ok} ${ok === 1 ? 'concluído' : 'concluídos'}`, STATE_COLOR.done), dot,
    seg(c, `${bad} ${bad === 1 ? 'falha' : 'falhas'}`, bad ? STATE_COLOR.failed : DIM),
    ...(full ? [seg(c, `${v.sessionUsd === undefined ? '' : ` · tokens ${tokTxt}`} · ${eta === undefined ? 'ETA calculando' : 'ETA ' + fmtHMS(eta)}`, DIM)] : [])]
  // one segment per agent (state colour); more agents than fit share the row in equal slices of the same order
  const H = c.ascii ? '=' : '━'
  const slots = Math.max(1, Math.min(ns.length, Math.floor((w + 1) / 2)))
  const per = Math.floor((w - (slots - 1)) / slots), extra = w - (slots - 1) - per * slots
  const worst = (xs: Node[]): string => stateColor((xs.find(n => n.state === 'failed') ?? xs.find(n => n.state === 'attention') ?? xs.find(n => n.state === 'running') ?? xs.find(n => n.state === 'pending') ?? xs[0]!).state)
  const bar: Line = ns.length ? Array.from({ length: slots }, (_, i) => {
    const grp = ns.slice(Math.floor((i * ns.length) / slots), Math.floor(((i + 1) * ns.length) / slots))
    return [...(i ? sp(1) : []), seg(c, H.repeat(per + (i < extra ? 1 : 0)), worst(grp))]
  }).flat() : []
  // sem agente não há progresso a mostrar: a barra de segmentos só existe quando há agentes (AC-020)
  return [spread(left, right, w), fit(counts, w), ...(ns.length ? [bar] : [])]
}

// View tabs of the design (Mapa, Árvore, Worktrees, Custo, Ferramentas; Workflow only while a run exists): a click picks the mode.
function tabsLine(agents: AgentLike[], v: CView): Line {
  const c = v.caps
  const tabs: [Mode, string][] = [['cards', 'Mapa'], ['tree', 'Árvore'], ['grouped', 'Worktrees'], ...(agents.some(a => a.workflow) ? [['workflow', 'Workflow'] as [Mode, string]] : []), ['cost', 'Custo'], ['tools', 'Ferramentas']]
  const one = ([m, label]: [Mode, string]): Seg[] => [seg(c, ` ${label} `, undefined, { act: `mode:${m}`, btn: true, variant: v.mode === m ? 'primary' : 'secondary', bold: v.mode === m }), ...sp(1)]
  // too narrow for every tab: the strip scrolls, dropping tabs from the left until the active one is visible (design: tabs scroll horizontally)
  const wOf = (t: [Mode, string]) => strWidth(t[1]) + 3
  const act = Math.max(0, tabs.findIndex(t => t[0] === v.mode))
  let from = 0
  while (from < act && tabs.slice(from, act + 1).reduce((a, t) => a + wOf(t), from ? 2 : 0) > v.width) from++
  return fit([...(from ? [seg(c, c.ascii ? '< ' : '‹ ', DIM)] : []), ...tabs.slice(from).flatMap(one)], v.width)
}

function filterBar(g: Graph, v: CView): Line {
  const c = v.caps
  const ns = [...g.nodes.values()].filter(n => n.kind === 'agent')
  const bad = ns.filter(n => n.state === 'failed' || n.state === 'attention').length
  const btn = (t: string, act: string, on: boolean): Seg[] => [seg(c, ` ${t} `, undefined, { act, btn: true, variant: on ? 'primary' : 'secondary', bold: on }), ...sp(1)]
  return fit([...btn('Agrupado', 'mode:grouped', v.mode === 'grouped'), ...btn(`Todos os cards ${ns.length}`, 'mode:cards', v.mode !== 'grouped' && v.filter !== 'failed'),
    ...btn(`Falhas ${bad}`, 'failed', v.filter === 'failed'), ...(v.query ? [seg(c, `busca: ${v.query}`, DIM)] : [])], v.width)
}

// Footer per design (Rodada 4): legend, bus legend. The hotkey row is drawn by the pane
// from the view state (actions.ts hotkeysFor), so keys stay unique and go quiet while searching.
function footer(g: Graph, v: CView): Line[] {
  const c = v.caps
  const states: State[] = ['done', 'running', 'attention', 'pending', 'failed']
  const legend: Line = states.flatMap((s, i) => [...sp(i ? 2 : 0), seg(c, `${glyph(c, s)} ${stateLabel(c, s)}`, stateColor(s))])
  const out: Line[] = []
  out.push([seg(c, (c.ascii ? '-' : '─').repeat(v.width), '#374151')], v.mode === 'cards' ? centre(fit(legend, v.width), v.width) : fit(legend, v.width))
  if (v.mode === 'cards') out.push(centre(fit([seg(c, c.ascii ? ': . + barramento pai-filhos · wt worktree · br branch' : '┊ ┄ ┬ ┴ barramento pai→filhos · ⧉ worktree · ⎇ branch · papel à direita (orquestrador, agente, subagente)', DIM)], v.width), v.width))
  if (v.mode === 'tree') out.push(fit([seg(c, `Níveis de profundidade: ${maxDepthOf(g)}/${MAX_DEPTH}`, DIM)], v.width))
  return out
}

// Topo da árvore: ◆ (decisão) e ✗ (falha) sempre primeiro. A tecla da ação só aparece se a capability for `yes` (AC-018).
// Banners of the design under the header: one rounded box per agent that needs the user (◆) or failed (✗), its message and
// [Ver] to open it. At most two boxes; the rest is one line, so the tree keeps its room.
function pinnedLines(g: Graph, nm: Map<string, string>, keep: Set<string>, v: CView): Line[] {
  const c = v.caps
  // só a falha tem ação hoje (retry); a decisão (needs-you, ◆) entra com T-011 e o estado correspondente
  const ret = bindable(v.capabilities ?? CAPABILITIES, 'terminal').find(e => e.act === 'retry')
  const bad = [...g.nodes.values()]
    .filter(n => n.kind === 'agent' && keep.has(n.id) && (n.state === 'attention' || n.state === 'failed'))
    .sort((a, b) => Number(b.state === 'attention') - Number(a.state === 'attention'))
  const out: Line[] = []
  for (const n of bad.slice(0, 2)) {
    const col_ = stateColor(n.state), name = nm.get(n.id) ?? n.name
    const left: Line = [seg(c, `${glyph(c, n.state)} ${n.state === 'failed' ? `${name} falhou` : `Precisa de você: ${name}`}`, col_, { bold: true, node: n.id }), seg(c, n.error ? '  ' + n.error : '', undefined)]
    const e = n.state === 'failed' ? ret : undefined
    out.push(...ROUND_BOX(c, v.width, left, [...(e ? [seg(c, `${e.key} ${e.label}  `, DIM)] : []), seg(c, '[Ver]', col_, { node: n.id })], col_))
  }
  if (bad.length > 2) out.push(fit([seg(c, `${glyph(c, 'failed')} +${bad.length - 2} ${bad.length - 2 === 1 ? 'outro alerta' : 'outros alertas'} · ${keyOf('failed') ?? 'f'} ${labelOf('failed') ?? 'só falhas'}`, STATE_COLOR.failed)], v.width))
  return out
}

function treeLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView, start: Node = g.root): Line[] {
  const c = v.caps, lvl = layoutLevel(v.width), out: Line[] = []
  const br = c.ascii ? { mid: '|-', last: '`-', pipe: '| ', none: '  ' } : { mid: '├─', last: '└─', pipe: '│ ', none: '  ' }
  const row = (n: Node, prefix: string, label?: { name: string; extra?: string }): Line => {
    const name = label?.name ?? nm.get(n.id) ?? n.name
    const right = n.kind === 'task' ? metric(n) : `${label?.extra ?? metric(n)}  ${fmtMMSS(durationOf(n, now))}`
    const left: Line = [seg(c, prefix, DIM), seg(c, glyph(c, n.state, v.frame) + ' ', stateColor(n.state), { node: n.kind === 'agent' ? n.id : undefined }),
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
  for (const grp of part.groups) out.push(...groupDivider(grp, v.ahead?.[grp.key], { width: v.width, ascii: v.caps.ascii }), agentsLine(grp.agents, v.caps.ascii))
  if (part.rest.length) out.push(...restDivider(part.rest.length), ...sub(part.rest, 'rest'))
  return out
}

// ---------- cards ----------
// Layout (ref. design v8): card 34 cols x 6 rows, gap 2, child indent 5. Leaf siblings fill rows of
// per_row = max(1, floor((cols - x_parent - 5 + 2) / 36)); branch siblings take one row each after the leaves, their
// subtree indented below. A dotted bus under the parent has a drop per card. Worktree flows get a heavy divider.
export const CARD_W = 34, CARD_H = 7, CARD_GAP = 2, CARD_INDENT = 5
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
function putCol(l: Line, col: number, ch: string, fg: string | undefined, c: Caps): Line {
  const cs = toCells(l)
  while (cs.length <= col) cs.push({ ch: ' ', s: { t: ' ' } })
  if (cs[col]!.ch === ' ') cs[col] = { ch, s: { t: ch, fg: quantize(fg, c.color) } }
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

// Card anatomy (design): name, icon+persona, icon+model · icon+effort, tool/status row, bar + metric + time. Border by state.
const BORDER: Record<State, string> = { running: STATE_COLOR.running, failed: STATE_COLOR.failed, attention: STATE_COLOR.attention, done: '#4b5563', pending: '#4b5563', inactive: '#4b5563' }
// how far the cards view can scroll right now (module memory set by the last render; the reducer clamps with it)
export const scrollInfo = { max: 0 }
export type CardTag = { role?: string; wt?: string; up?: boolean; down?: boolean }
const PILL: Record<string, string> = { running: 'Rodando', done: 'Concluído', failed: 'Falhou', attention: 'Aguarda você', pending: 'Na fila', inactive: 'Inativo' }
// Step segments of the design card: one run of cells per tool step (width by duration, colour by result), the live one last.
function stepBar(run: RunNode | undefined, n: Node, cells: number, c: Caps, frame: number): Line | undefined {
  const st = run?.steps ?? []
  if (!st.length) return undefined
  const MAXS = 8
  const size = Math.ceil(st.length / MAXS)
  const groups: { w: number; ok: boolean }[] = []
  for (let i = 0; i < st.length; i += size) { const g = st.slice(i, i + size); groups.push({ w: g.reduce((a, x) => a + Math.max(500, x.durationMs ?? 1000), 0), ok: g.every(x => x.ok !== false) }) }
  const live = n.state === 'running'
  const segs = [...groups.map(g => ({ w: g.w, fg: g.ok ? STATE_COLOR.done : STATE_COLOR.failed })), ...(live ? [{ w: 1000, fg: !c.reducedMotion && frame % 2 ? lighten(STATE_COLOR.running)! : STATE_COLOR.running }] : [])]
  const room = cells - (segs.length - 1), tot = segs.reduce((a, x) => a + x.w, 0)
  const ws = segs.map(x => Math.max(1, Math.floor((x.w / tot) * room)))
  let spare = room - ws.reduce((a, x) => a + x, 0)
  for (let i = 0; spare > 0; i = (i + 1) % ws.length, spare--) ws[i]!++
  for (let i = 0; spare < 0 && i < ws.length * cells; i++) if (ws[i % ws.length]! > 1) { ws[i % ws.length]!--; spare++ }
  const H = c.ascii ? '=' : '━'
  return segs.flatMap((x, i) => [...(i ? sp(1) : []), seg(c, H.repeat(ws[i]!), x.fg)])
}
// Design card (Proto5 / Chips5, the same anatomy in the terminal): title + state pill, chips, worktree + role,
// step segments, status + cost and time. Always these 5 rows: the pane scrolls instead of shrinking a card.
function card(n: Node, nm: Map<string, string>, c: Caps, now: number, frame: number, idx: number, tag: CardTag = {}, run?: RunNode): Line[] {
  const b = boxChars(c), inner = CARD_W - 2, col_ = stateColor(n.state), edge = BORDER[n.state]
  const k = growth(c, n, idx, now)
  const id = n.id
  const ch = chips(n.persona, n.model, n.effort)
  const full = nm.get(id) ?? n.name
  const body = (l: Line): Line => [seg(c, b.v, edge), ...fit([...l, ...sp(inner)], inner), seg(c, b.v, edge)]
  // left text, right text, the gap between them never below one cell (the left side gives way)
  const split = (left: Seg[], right: Seg[]): Line => {
    const rw = right.reduce((a, q) => a + strWidth(q.t), 0)
    const l = fit(left, Math.max(0, inner - rw - (rw ? 1 : 0))), lw = l.reduce((a, q) => a + strWidth(q.t), 0)
    return body([...l, ...sp(inner - lw - rw), ...right])
  }
  const kids = n.children.filter(x => x.kind === 'agent').length
  const sep = c.ascii ? '<' : '‹', tri = c.ascii ? '>' : '▸'
  const trail = [n.tool, ...[...(n.recent ?? [])].reverse().filter((x, i) => !(i === 0 && x === n.tool))].filter(Boolean).join(` ${sep} `)
  const tasks = n.children.filter(x => x.kind === 'task')
  const tdone = tasks.filter(x => x.state === 'done').length
  const status: Seg =
    n.state === 'pending' ? seg(c, 'aguarda 1ª ação', DIM) :
    n.state === 'done' ? seg(c, 'concluído', DIM)
      : n.state === 'failed' ? seg(c, `${glyph(c, 'failed')} ${n.error ?? 'falha'}`, STATE_COLOR.failed)
        : n.state === 'attention' ? seg(c, `${glyph(c, 'attention')} ${n.error ?? 'sem atividade'}`, STATE_COLOR.attention)
            : seg(c, `${tri} ${kids ? `delega ${kids} ${kids === 1 ? 'filho' : 'filhos'}` : [tasks.length ? `${tdone}/${tasks.length}` : '', trail].filter(Boolean).join(' · ') || 'executando'}`, DIM)
  const [on, off] = BAR(c)
  const leafRunning = n.state === 'running' && n.children.length === 0
  const pctText = tasks.length ? `${Math.round((tdone / tasks.length) * 100)}%` : metric(n)
  let bar: Line | undefined = stepBar(run, n, inner, c, frame)
  if (!bar && leafRunning) {
    // no step and no real percent yet: indeterminate sweep, never an invented number
    const pos = c.reducedMotion ? 0 : frame % (inner + 3)
    bar = Array.from({ length: inner }, (_, i) => (i <= pos && i > pos - 3 ? on : off)).map(x => seg(c, x, x === on ? col_ : DIM))
  } else if (!bar) bar = partialBar((n.state === 'done' ? 1 : n.state === 'failed' ? 0.6 : progressOf(n) ?? 0) * k, inner, c, col_, n.state === 'running', frame)
  const time = n.start === undefined || n.state === 'pending' ? '--:--' : fmtMMSS(durationOf(n, now))
  const usd = run?.usage.costUsd
  const meta = `${usd === undefined ? pctText : fmtUsd(usd)} · ${time}`
  // borders carry only the tree: the connector enters at the top centre and leaves at the bottom centre
  const mid = CARD_W / 2 - 1 // inner index of the centre column
  const edgeLine = (l: string, r: string, joint: string | undefined): Line =>
    joint ? [seg(c, l + b.h.repeat(mid), edge), seg(c, joint, edge), seg(c, b.h.repeat(inner - mid - 1) + r, edge)] : [seg(c, l + b.h.repeat(inner) + r, edge)]
  const pill = c.ascii ? asciiText(PILL[n.state] ?? '') : PILL[n.state] ?? ''
  const chipTxt = (() => {
    const parts = (c.ascii ? [n.persona, n.model, n.effort] : [ch.persona, ch.model, ch.effort]).filter((x): x is string => !!x)
    const dotted = parts.join(' · ')
    return strWidth(dotted) <= inner ? dotted : parts.join(' ') // a long persona drops the dots before anything is cut
  })()
  const wtTxt = tag.wt ? `${c.ascii ? 'wt' : '⧉'} ${tag.wt}` : n.git?.branch ? `${c.ascii ? 'br' : '⎇'} ${n.git.branch}` : ''
  return [
    edgeLine(b.tl, b.tr, tag.up ? (c.ascii ? '+' : '┴') : undefined),
    // the title wins the row: the pill is drawn only when the whole title fits beside it (glyph and border already carry the state)
    split([seg(c, glyph(c, n.state, frame) + ' ', col_, { node: id }), seg(c, full, undefined, { bold: true, node: id })], strWidth(full) + 3 + strWidth(pill) <= inner ? [seg(c, pill, col_, { bold: true })] : []),
    body([seg(c, chipTxt, DIM, { node: id })]),
    split(wtTxt ? [seg(c, wtTxt, WORKTREE_COLOR)] : [], tag.role ? [seg(c, tag.role, DIM)] : []),
    body(bar),
    split([status], [seg(c, meta, DIM)]),
    edgeLine(b.bl, b.br, tag.down ? (c.ascii ? '+' : '┬') : undefined),
  ]
}

// Centred tree (user decision 2026-11-13, "TELA 8 centralizada"): each parent card sits centred over its children, the
// whole block is centred in the pane. Siblings that do not fit wrap into rows hung off a dotted trunk on the left of the
// block. Nothing is cut and no card shrinks: a pane too short scrolls (renderCompact windows these lines).
function cardLines(g: Graph, nm: Map<string, string>, keep: Set<string>, now: number, v: CView, runs?: Map<string, RunNode>): Line[] {
  const CH = CARD_H
  const c = v.caps, frame = v.frame ?? 0
  const V = c.ascii ? ':' : '┊', H = c.ascii ? '.' : '┄'
  const J = c.ascii ? { d: '+', u: '+', x: '+', tl: '+', tr: '+', l: '+', bl: '+' } : { d: '┬', u: '┴', x: '┼', tl: '╭', tr: '╮', l: '├', bl: '╰' }
  const flowOf = (n: Node) => (n.git?.worktree ? n.git.branch ?? n.git.worktree : '')
  const agentKids = (n: Node) => sortNodes(n.children.filter(k => k.kind === 'agent' && keep.has(k.id)), v.sort)
  const maxPer = v.containerPx === undefined ? Infinity : appColumns(v.containerPx)
  const TM = 2 // trunk column + one blank
  type M = { w: number; h: number; rows: Node[][] }
  const memo = new Map<Node, M>()
  const measure = (n: Node, avail: number): M => {
    const hit = memo.get(n); if (hit) return hit
    const kids = agentKids(n), inner = Math.max(CARD_W, avail - TM), rows: Node[][] = []
    let cur: Node[] = [], used = 0
    for (const k of kids) {
      const w = measure(k, inner).w
      if (cur.length && (used + CARD_GAP + w > inner || cur.length >= maxPer)) { rows.push(cur); cur = []; used = 0 }
      used += (cur.length ? CARD_GAP : 0) + w; cur.push(k)
    }
    if (cur.length) rows.push(cur)
    const rowW = rows.map(r => r.reduce((a, k, i) => a + memo.get(k)!.w + (i ? CARD_GAP : 0), 0))
    const tm = rows.length > 1 ? TM : 0
    const m = { w: Math.max(CARD_W, tm + Math.max(0, ...rowW)), h: CH + rows.reduce((a, r) => a + 1 + Math.max(...r.map(k => memo.get(k)!.h)), 0), rows }
    memo.set(n, m); return m
  }
  const grid: { x: number; w: number; l: Line }[][] = []
  const put = (x: number, y: number, l: Line) => { (grid[y] ??= []).push({ x, w: l.reduce((a, q) => a + strWidth(q.t), 0), l }) }
  let idx = 0
  const draw = (n: Node, x0: number, y0: number, depth: number, up: boolean) => {
    const m = memo.get(n)!
    const tm = m.rows.length > 1 ? TM : 0
    const bx = x0 + tm + Math.floor((m.w - tm - CARD_W) / 2), pcx = bx + CARD_W / 2 // centred over the rows, not the trunk
    const role = n.kind === 'session' ? 'orquestrador' : depth <= 1 ? 'agente' : 'subagente'
    card(n, nm, c, now, frame, idx++, { role, wt: flowOf(n), up, down: m.rows.length > 0 }, runs?.get(n.id)).forEach((l, r) => put(bx, y0 + r, l))
    if (!m.rows.length) return
    let y = y0 + CH
    const busYs: number[] = []
    m.rows.forEach((row, ri) => {
      const rw = row.reduce((a, k, i) => a + memo.get(k)!.w + (i ? CARD_GAP : 0), 0)
      let sx = x0 + tm + Math.floor((m.w - tm - rw) / 2)
      const slots = row.map(k => { const q = sx; sx += memo.get(k)!.w + CARD_GAP; return q })
      const cxs = row.map((k, i) => slots[i]! + Math.floor((memo.get(k)!.w - CARD_W) / 2) + CARD_W / 2)
      const lo = Math.min(cxs[0]!, ri === 0 ? pcx : Infinity, tm ? x0 : Infinity), hi = Math.max(cxs[cxs.length - 1]!, ri === 0 ? pcx : -Infinity)
      const live = !c.reducedMotion && row.some(k => k.state === 'running')
      const pulse = live ? frame % (hi - lo + 1) : -1
      const bus: Line = []
      for (let x = lo; x <= hi; x++) {
        const ci = cxs.indexOf(x), isP = ri === 0 && x === pcx, isT = tm > 0 && x === x0
        const ch = lo === hi ? V
          : isT ? (ri === 0 ? J.tl : ri === m.rows.length - 1 ? J.bl : J.l)
            : ci >= 0 && isP ? J.x
              : isP ? J.u
                : ci >= 0 ? (x === lo ? J.tl : x === hi ? J.tr : J.d)
                  : H
        const lit = ch === H && pulse >= 0 && (x - lo === pulse || x - lo === (pulse + 1) % (hi - lo + 1))
        const fg = ci >= 0 ? stateColor(row[ci]!.state) : lit ? lighten(STATE_COLOR.running) : DIM
        const last = bus[bus.length - 1]
        const sg = seg(c, ch, fg)
        if (last && last.fg === sg.fg) last.t += ch; else bus.push(sg)
      }
      put(lo, y, bus); busYs.push(y)
      row.forEach((k, i) => draw(k, slots[i]!, y + 1, depth + 1, true))
      y += 1 + Math.max(...row.map(k => memo.get(k)!.h))
    })
    if (tm) for (let yy = busYs[0]! + 1; yy < busYs[busYs.length - 1]!; yy++) if (!busYs.includes(yy)) put(x0, yy, [seg(c, V, DIM)])
  }
  const lines: Line[] = []
  {
    const rm = measure(g.root, v.width)
    draw(g.root, Math.max(0, Math.floor((v.width - rm.w) / 2)), 0, 0, false)
    for (let y = 0; y < grid.length; y++) {
      const out: Line = []
      let cur = 0
      for (const p of (grid[y] ?? []).sort((a, b) => a.x - b.x)) { out.push(...sp(p.x - cur), ...p.l); cur = p.x + p.w }
      lines.push(out)
    }
  }
  return lines
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
      out.push(fit([seg(c, glyph(c, k.state, frame) + ' ', stateColor(k.state), { node: k.id }),
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
  // order of the design: header, alert banners, view tabs, then the view itself
  const out: Line[] = [...header(g, agents, now, v), ...(agents.length && (v.mode === 'tree' || v.mode === 'cards') ? pinnedLines(g, nm, keep, v) : []), tabsLine(agents, v), ...(v.mode === 'grouped' ? [filterBar(g, v)] : [])]
  if (agents.length === 0) {
    // empty session: the orchestrator card alone, centred, with the waiting line under it (never a bare line of text)
    if (v.mode === 'cards') { scrollInfo.max = 0; out.push(...cardLines(g, nm, keep, now, v), []) }
    const wait: Line = [seg(v.caps, 'Aguardando agentes… use o Claude normalmente', DIM)]
    out.push(v.mode === 'cards' ? centre(wait, w) : wait)
  } else {
    const bad = [...g.nodes.values()].filter(n => n.kind === 'agent' && keep.has(n.id) && (n.state === 'failed' || n.state === 'attention'))
    if (v.mode === 'grouped' && bad.length) {
      out.push([seg(v.caps, `Atenção (${bad.length})`, STATE_COLOR.attention, { bold: true })])
      for (const n of bad) out.push(fit([seg(v.caps, '  ' + glyph(v.caps, n.state) + ' ', stateColor(n.state), { node: n.id }),
        seg(v.caps, nm.get(n.id) ?? n.name, undefined, { bold: true, node: n.id }), seg(v.caps, n.error ? '  ' + n.error : '', DIM)], w))
    }
    if (v.mode === 'cards') {
      // every card keeps its full anatomy and none is dropped: a pane too short shows a window of the tree that scrolls
      // one level (card + bus) per step, with a line above and below saying where the rest is
      let allCards = cardLines(g, nm, keep, now, v, new Map(model.nodes.map(r => [r.id, r])))
      const cap = v.maxLines === undefined ? Infinity : Math.max(CARD_H + 3, v.maxLines)
      if (allCards.length > cap) {
        // one column goes to the scrollbar: cards are laid out again one column narrower
        allCards = cardLines(g, nm, keep, now, { ...v, width: w - 1 }, new Map(model.nodes.map(r => [r.id, r])))
        const room = cap - 2, step = CARD_H + 1
        const max = Math.ceil((allCards.length - room) / step) * step
        const off = Math.min(Math.max(0, v.scroll ?? 0), max)
        scrollInfo.max = max
        const kd = keyOf('scrollDown') ?? 'j', ku = keyOf('scrollUp') ?? 'k'
        const note = (t: string): Line => centre([seg(v.caps, t, DIM)], w)
        out.push(note(off > 0 ? `${v.caps.ascii ? '^' : '↑'} mais cards acima · ${ku} sobe` : `${ku} sobe · ${kd} desce`))
        const from = Math.max(0, off - 1) // off - 1: the window opens on the bus above the row
        const win = allCards.slice(from, from + room)
        // scrollbar: track + thumb on the last column, thumb size and place proportional to the window
        const thumbH = Math.max(1, Math.min(room, Math.round(room * room / allCards.length)))
        const top = Math.round((room - thumbH) * (max ? Math.min(from, allCards.length - room) / Math.max(1, allCards.length - room) : 0))
        const [tk, th] = v.caps.ascii ? ['|', '#'] : ['░', '█']
        for (let i = 0; i < room; i++) {
          const l = fit(win[i] ?? [], w - 1)
          const used = l.reduce((a, q) => a + strWidth(q.t), 0)
          out.push([...l, ...sp(w - 1 - used), seg(v.caps, i >= top && i < top + thumbH ? th : tk, DIM)])
        }
        out.push(note(off < max ? `${v.caps.ascii ? 'v' : '↓'} mais cards abaixo · ${kd} desce` : `fim da árvore · ${ku} sobe`))
      } else { scrollInfo.max = 0; out.push(...allCards) }
    } else if (v.mode === 'waterfall') out.push(...waterfallLines(g, nm, keep, now, v))
    else if (v.mode === 'cost') out.push(...costLines(model, now, { width: w, caps: v.caps, sessionUsd: v.sessionUsd }))
    else if (v.mode === 'tools') out.push(...toolLines(model, now, { width: w, caps: v.caps }, v.captureIo === true))
    else if (v.mode === 'workflow') {
      const wf = agents.filter(a => keep.has(a.id)).map(a => ({ id: a.id, name: nm.get(a.id) ?? a.description, state: RUN_STATE[g.nodes.get(a.id)?.state ?? 'running'], workflow: a.workflow }))
      out.push(...workflowView(wf, vocabOf(v.caps)))
    } else if (v.mode === 'grouped') out.push(...groupedLines(g, agents, nm, keep, now, v))
    else out.push(...treeLines(g, nm, keep, now, v))
  }
  out.push(...footer(g, v))
  return out.map(l => (v.caps.ascii ? asciiLine(fit(l, w)) : fit(l, w)))
}

// ---------- detail ----------
// The detail screen is view-detail.ts (T-009); this keeps the Caps-aware wrapper (ASCII fallback) for callers that draw Lines.
export function detailCompact(agents: AgentLike[], id: string, now: number, caps: Caps, captureIo = false): Line[] | undefined {
  const d = detailView(agents, id, now, { captureIo, ascii: caps.ascii })
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

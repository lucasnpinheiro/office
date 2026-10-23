// Office Agent Monitor: pure graph + mind-map layout. Single office package: the
// Claude Code mod is the only implementation (the former Go TUI was folded in and removed).
// No engine APIs, no clock: the caller passes `now` and the animation `frame`.
import { parseDescription, modelLabel, EFFORT_DISPLAY } from './persona'
import type { AgentLike } from './office'
import { gitLabel } from './git'
import type { GitInfo } from './git'
import { HIDE_AFTER_MS } from './office'

export const MAX_DEPTH = 10
// Quota / rate-limit failures are not agent bugs: they surface as attention items, not failures.
// "429" only as an HTTP status (start of text, after error/status/http), "credit" only as a balance: a stray line
// number or a form field named "credit card" is not a quota failure.
export const isQuotaError = (t?: string): boolean =>
  !!t && /quota|rate.?limit|usage limit|too many requests|overloaded|(?:^|\b(?:error|status|http|code)\W{0,3})429\b|\bhttp\/\d(?:\.\d)?\s+429\b|credit balance|out of credits|insufficient credit/i.test(t)
export const ATTENTION_AFTER_MS = 10 * 60 * 1000

export type State = 'pending' | 'running' | 'done' | 'attention' | 'inactive' | 'failed'
export type Kind = 'session' | 'agent' | 'task'

export type Node = {
  id: string
  parentId: string
  name: string
  persona: string
  model: string
  effort?: string
  git?: GitInfo
  shot?: { host?: string; has?: boolean }
  tool?: string // only while the card runs
  recent?: string[]
  kind: Kind
  state: State
  depth: number
  start?: number
  end?: number
  children: Node[]
  dependsOn: string[]
  error?: string
}

export type Graph = { root: Node; nodes: Map<string, Node> }

const EFFORT_KEY: Record<string, string> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' }
const firstWords = (s?: string): string => (s ?? '').trim().split('\n')[0]!.slice(0, 60)

export type ToolNote = { tool?: string; recent?: string[] }
const isFinal = (s: State) => s === 'done' || s === 'failed' || s === 'inactive'
// Still in progress: running, or attention without an end (stale). An ended quota error is attention but over.
export const isOpenNode = (n: { state: State; end?: number }): boolean => n.state === 'running' || (n.state === 'attention' && n.end === undefined)
// Any descendant (agent or task) still running: a done ancestor of it is 'awaiting children'.
const hasRunningDescendant = (n: Node): boolean => n.children.some(c => c.state === 'running' || hasRunningDescendant(c))

const todoState = (s: string): State => (s === 'in_progress' ? 'running' : s === 'completed' ? 'done' : 'pending')

// Walk up while the parent is already at MAX_DEPTH so a child stays within the limit.
function clampParent(g: Graph, p: Node): Node {
  let cur = p
  while (cur.depth >= MAX_DEPTH && cur.parentId) {
    const up = g.nodes.get(cur.parentId)
    if (!up) break
    cur = up
  }
  return cur
}

// agents (spawn order) -> session root -> agents -> TodoWrite tasks. Nothing is invented:
// state comes from status/endedAt/seenAt, tasks from the agent's own todos.
export function buildGraph(agents: AgentLike[], now: number, sessionGit?: GitInfo, sessionTool?: ToolNote): Graph {
  const root: Node = {
    id: 'session', parentId: '', name: 'Claude Code', persona: 'Orquestrador', model: '', kind: 'session',
    state: 'running', depth: 0, children: [], dependsOn: [], git: sessionGit, tool: sessionTool?.tool, recent: sessionTool?.recent,
  }
  const g: Graph = { root, nodes: new Map([[root.id, root]]) }
  const byAgentId = new Map<string, Node>()
  for (const a of agents) {
    const p = parseDescription(a.description)
    const caller = (a.parentAgentId && byAgentId.get(a.parentAgentId)) || root
    const parent = clampParent(g, caller)
    const stale = a.status === 'working' && now - (a.seenAt ?? a.startedAt) > ATTENTION_AFTER_MS
    const model = p.model ?? a.model
    const effort = p.effort ?? (a.effort ? EFFORT_KEY[a.effort.toLowerCase()] : undefined)
    // no label in the description: fall back to the first prompt line, then the persona
    const label = p.label || firstWords(a.prompt) || p.persona.name
    const n: Node = {
      id: a.id, parentId: parent.id, name: label,
      persona: p.persona.name, model: model ? modelLabel(model) : '', effort: effort ? EFFORT_DISPLAY[effort]?.label : undefined, kind: 'agent', git: a.git,
      state: a.status === 'error' ? (isQuotaError(a.error) ? 'attention' : 'failed') : a.status === 'done' ? 'done' : stale ? 'attention' : a.active === false ? 'pending' : 'running',
      depth: parent.depth + 1, start: a.startedAt, end: a.endedAt, children: [], dependsOn: [],
    }
    if (a.status === 'error') n.error = a.error || 'falha'
    if (n.state === 'running' || n.state === 'attention') { n.tool = a.tool; n.recent = a.recent; n.shot = a.shot }
    parent.children.push(n)
    g.nodes.set(n.id, n)
    if (a.agentId) byAgentId.set(a.agentId, n)
    let prev = ''
    ;(a.todos ?? []).forEach((t, i) => {
      const tp = clampParent(g, n)
      const id = `${n.id}#${i}`
      const task: Node = {
        id, parentId: tp.id, name: t.content, persona: n.persona, model: n.model, effort: n.effort, kind: 'task',
        state: todoState(t.status), depth: tp.depth + 1, children: [], dependsOn: prev ? [prev] : [],
      }
      tp.children.push(task)
      g.nodes.set(id, task)
      prev = id
    })
  }
  const starts = [...g.nodes.values()].filter(n => n.kind !== 'session' && n.start !== undefined).map(n => n.start!)
  if (starts.length) root.start = Math.min(...starts)
  return g
}

function leafCounts(n: Node): [number, number] {
  let done = 0, total = 0
  for (const c of n.children) {
    if (c.children.length === 0 && c.kind !== 'session') {
      total++
      if (c.state === 'done') done++
    }
    const [d, t] = leafCounts(c)
    done += d
    total += t
    // an unfinished agent whose own subtree is all done is still one unit of work left
    if (c.kind === 'agent' && c.children.length > 0 && !isFinal(c.state) && d === t) total++
  }
  return [done, total]
}

// Done ratio; undefined when there is no evidence (no leaves).
export function progressOf(n: Node): number | undefined {
  if (n.kind === 'task') return n.state === 'done' ? 1 : 0
  if (n.kind === 'agent' && n.children.length === 0) return n.state === 'done' ? 1 : 0
  const [d, t] = leafCounts(n)
  return t === 0 ? undefined : d / t
}

export const overallProgress = (g: Graph): number | undefined => progressOf(g.root)

export function durationOf(n: Node, now: number): number {
  if (n.start === undefined) return 0
  const d = (n.end ?? now) - n.start
  return d > 0 ? d : 0
}

// Earliest start to now, or to the last end once every agent/task is final.
export function elapsedOf(g: Graph, now: number): number {
  const ns = [...g.nodes.values()].filter(n => n.kind !== 'session')
  const first = Math.min(...ns.filter(n => n.start !== undefined).map(n => n.start!))
  if (!Number.isFinite(first)) return 0
  const allFinal = ns.length > 0 && ns.every(n => isFinal(n.state) || (n.state === 'attention' && n.end !== undefined))
  const last = Math.max(0, ...ns.map(n => n.end ?? 0))
  const end = allFinal && last > 0 ? last : now
  return Math.max(0, end - first)
}

// Mean duration of finished agents/tasks x count of pending+running ones. undefined: <2 samples.
export function etaOf(g: Graph): number | undefined {
  let sum = 0, samples = 0, remaining = 0
  for (const n of g.nodes.values()) {
    if (n.kind === 'session') continue
    if ((n.state === 'done' || n.state === 'failed') && n.start !== undefined && n.end !== undefined && n.end > n.start) {
      sum += n.end - n.start
      samples++
    } else if (n.state === 'pending' || n.state === 'running') remaining++
  }
  return samples < 2 || remaining === 0 ? undefined : (sum / samples) * remaining
}

// Finished agents leave the map HIDE_AFTER_MS after they end (tasks go with them), unless a child agent is still visible.
export function hiddenIds(g: Graph, now: number): Set<string> {
  const hidden = new Set<string>()
  const visit = (n: Node): boolean => { // true = stays visible
    const kids = n.children.filter(k => k.kind === 'agent').map(visit)
    if (n.kind !== 'agent') return true
    const final = n.state === 'done' || n.state === 'failed'
    const expired = final && n.end !== undefined && now - n.end > HIDE_AFTER_MS
    const vis = !expired || kids.some(Boolean)
    if (!vis) hidden.add(n.id)
    return vis
  }
  visit(g.root)
  return hidden
}

export const maxDepthOf = (g: Graph): number => Math.max(0, ...[...g.nodes.values()].map(n => n.depth))

// ---------- text helpers ----------
export type Seg = { t: string; fg?: string; bold?: boolean; dim?: boolean; node?: string; toggle?: string; attach?: string; act?: string; hotkey?: string; btn?: true; variant?: 'primary' | 'secondary' } // node: click opens that agent's detail; toggle: click expands/collapses its branch
export type Line = Seg[]

export const STATE_COLOR: Record<State, string> = {
  done: '#22c55e', running: '#3b82f6', attention: '#eab308', pending: '#e5e7eb', inactive: '#6b7280', failed: '#ef4444',
}
const DIM = '#9ca3af'
const CONNECTOR = '#4b5563'
const HEADER = '#6b7280'
const PULSE = '#60a5fa'
export const WORKTREE_COLOR = '#a855f7' // linked git worktree: purple, apart from every state color
export const PULSE_FRAMES = 12 // one full blue<->green breath

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
// Linear blend of two #rrggbb colors; t in [0,1].
export function mixHex(a: string, b: string, t: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => hex2(c(a, i) + (c(b, i) - c(a, i)) * t)).join('')
}
// Smooth breath (cosine) instead of on/off: 0 at frame 0, 1 at half period.
export const breath = (frame: number): number => (1 - Math.cos((2 * Math.PI * frame) / PULSE_FRAMES)) / 2

// ---------- display width (terminal cells) ----------
// Code points are not cells: CJK and emoji take two, combining marks, ZWJ and variation selectors none. A label
// measured by code points overflowed card borders by one cell per wide glyph.
const WIDE: [number, number][] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe],
  [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a], [0x1f200, 0x1f251], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f7e0, 0x1f7eb],
  [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff], [0x20000, 0x3fffd],
]
export function charWidth(cp: number): number {
  if (cp === 0x200d || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0000 && cp <= 0xe01ef)) return 0
  if (cp < 0x1100) return cp < 0x20 ? 0 : 1
  for (const [a, b] of WIDE) { if (cp < a) return 1; if (cp <= b) return 2 }
  return 1
}
// Grapheme clusters (Intl.Segmenter where the runtime has it, code points otherwise): an emoji sequence joined by
// ZWJ, a flag pair or a base + VS16 (U+FE0F, emoji presentation) is one glyph two cells wide.
const SEG: { segment: (s: string) => Iterable<{ segment: string }> } | undefined =
  typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' }) : undefined
const graphemes = (s: string): string[] => (SEG ? [...SEG.segment(s)].map(x => x.segment) : [...s])
function clusterWidth(g: string): number {
  const cps = [...g].map(c => c.codePointAt(0)!)
  if (cps.length > 1 && (cps.includes(0x200d) || cps.includes(0xfe0f) || cps.every(c => c >= 0x1f1e6 && c <= 0x1f1ff))) return 2
  return cps.reduce((n, c) => n + charWidth(c), 0)
}
export const strWidth = (s: string): number => graphemes(s).reduce((n, g) => n + clusterWidth(g), 0)
// Longest prefix of `s` that fits in `w` cells (a wide glyph that would straddle the edge is left out).
export function takeWidth(s: string, w: number): string {
  let out = '', used = 0
  for (const g of graphemes(s)) { const cw = clusterWidth(g); if (used + cw > w) break; out += g; used += cw }
  return out
}
export const padWidth = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - strWidth(s)))
const len = strWidth
export const lineWidth = (l: Line) => l.reduce((n, s) => n + len(s.t), 0)
export const lineText = (l: Line) => l.map(s => s.t).join('')
const sp = (n: number): Line => (n > 0 ? [{ t: ' '.repeat(n) }] : [])

export function truncRunes(s: string, max: number): string {
  if (max <= 0) return ''
  if (strWidth(s) <= max) return s
  return max === 1 ? '…' : takeWidth(s, max - 1) + '…'
}

export function truncLine(l: Line, w: number): Line {
  const out: Line = []
  let used = 0
  for (const s of l) {
    if (used >= w) break
    const sw = strWidth(s.t)
    const piece = used + sw <= w ? s : { ...s, t: takeWidth(s.t, w - used) }
    out.push(piece)
    used += used + sw <= w ? sw : strWidth(piece.t)
    if (piece !== s) break
  }
  return out
}
const padLine = (l: Line, w: number): Line => {
  const t = truncLine(l, w)
  return [...t, ...sp(w - lineWidth(t))]
}

function spread(left: Line, right: Line, w: number): Line {
  const gap = w - lineWidth(left) - lineWidth(right)
  if (gap >= 1) return [...left, ...sp(gap), ...right]
  const room = w - lineWidth(right) - 1
  if (room < 0) return truncLine(right, w)
  return [...truncLine(left, room), ...sp(1), ...right]
}

export function fmtHMS(ms: number): string {
  const s = Math.floor(ms / 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}
export function fmtMMSS(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function progressBar(frac: number, cells = 10): string {
  const f = Math.min(cells, Math.max(0, Math.round(frac * cells)))
  return '▰'.repeat(f) + '▱'.repeat(cells - f)
}

export function stateIcon(s: State): string {
  return s === 'failed' ? '✗ ' : s === 'done' ? '✓ ' : s === 'running' ? '● ' : s === 'attention' ? '! ' : s === 'inactive' ? '◌ ' : '○ '
}

const pctText = (f: number | undefined) => (f === undefined ? '—' : `${Math.round(f * 100)}%`)
const padEnd = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - len(s)))

// ---------- mind map ----------
export type View = {
  width: number
  frame: number
  collapsed: Set<string>
  project: string
  sessionId?: string
  git?: GitInfo // branch/worktree of the session's own cwd
  sessionTool?: ToolNote
  thumbs?: boolean // opt-in browser thumbnails; false = no change at all
}

function nodeBox(c: Ctx, n: Node): { lines: Line[]; cr: number } {
  const { g, now, v, inner } = c
  const boxW = inner + 2
  const frac = progressOf(n)
  const pct = pctText(frac)
  const dur = fmtMMSS(n.kind === 'session' ? elapsedOf(g, now) : durationOf(n, now))
  // done but a descendant still runs: keep the green done state, pulse the border blue/green with dashed edges
  const waiting = n.state === 'done' && hasRunningDescendant(n)
  const color = waiting ? mixHex(STATE_COLOR.done, STATE_COLOR.running, breath(v.frame)) : STATE_COLOR[n.state]
  const wt = n.kind === 'agent' && !!n.git?.worktree
  const edge = waiting ? '┄' : '─'
  const deps: Line[] = n.dependsOn.length
    ? [padLine([{ t: '┄▶ depende de ' + truncRunes(n.dependsOn.map(id => g.nodes.get(id)?.name ?? id).join(', '), boxW - 14), fg: DIM }], boxW)]
    : []

  if (n.kind === 'task') {
    const l1 = padLine([{ t: stateIcon(n.state), fg: color }, { t: truncRunes(n.name, boxW - 2), fg: color }], boxW)
    const who = [n.persona, n.model, n.effort].filter(Boolean).join(' · ')
    const l2 = padLine([{ t: truncRunes(`${pct}  ${dur}${who ? '  ' + who : ''}`, boxW), fg: DIM }], boxW)
    return { lines: [l1, l2, ...deps], cr: 0 }
  }
  const hidden = v.collapsed.has(n.id) && n.children.length > 0 ? ` +${n.children.length}` : ''
  const icon = stateIcon(n.state)
  const canToggle = n.children.length > 0
  const tog = canToggle ? 2 : 0
  const name = truncRunes(n.name, inner - len(icon) - len(hidden) - tog)
  const click = n.kind === 'agent' ? n.id : undefined
  const line1: Line = [
    { t: icon, fg: color, node: click }, { t: name, bold: true, node: click, fg: n.kind === 'agent' && n.git?.worktree ? WORKTREE_COLOR : undefined }, { t: hidden, fg: DIM, node: click },
    ...(canToggle ? [{ t: ' ' + (v.collapsed.has(n.id) ? '▸' : '▾'), fg: DIM, toggle: n.id } as Seg] : []),
  ]
  const persona = [n.persona, n.model, n.effort].filter(Boolean).join(' · ')
  const line2: Line = [{ t: truncRunes(persona, inner), fg: DIM, node: click }]
  const cells = Math.max(4, Math.min(10, inner - 14))
  const line3: Line = [{ t: progressBar(frac ?? 0, cells), fg: color }, { t: ` ${padEnd(pct, 4)} ${dur}` }]
  const side: Seg = { t: waiting ? '┆' : '│', fg: color }
  const gl = gitLabel(n.git, v.git?.repo)
  const shotLine: Line[] = v.thumbs && n.shot?.host ? [[{ t: truncRunes('▣ ' + n.shot.host, inner), fg: DIM }]] : []
  const line4: Line[] = (gl ?? []).map(t => [{ t: truncRunes(t, inner), fg: wt && t.startsWith('⧉') ? WORKTREE_COLOR : DIM, bold: wt && t.startsWith('⧉') }])
  // current tool + trail (newest first), only while running; one line, truncated
  const trail = n.tool && (n.state === 'running' || n.state === 'attention')
    ? [n.tool, ...[...(n.recent ?? [])].reverse().filter((x, i) => !(i === 0 && x === n.tool))].join(' ‹ ') : ''
  const toolLine: Line[] = trail ? [[{ t: truncRunes('▸ ' + trail, inner), fg: PULSE }]] : []
  const card: Line[] = [
    wt
      ? [{ t: '╭', fg: color }, { t: '⧉ worktree', fg: WORKTREE_COLOR, bold: true }, { t: edge.repeat(Math.max(0, inner - 10)) + '╮', fg: color }]
      : [{ t: '╭' + edge.repeat(inner) + '╮', fg: color }],
    ...[line1, line2, ...line4, ...shotLine, ...toolLine, line3].map(l => [side, ...padLine(l, inner), side]),
    [{ t: '╰' + edge.repeat(inner) + '╯', fg: color }],
  ]
  return { lines: [...card, ...deps], cr: 2 }
}

const GAP = 2

type Block = { lines: Line[]; cx: number; w: number }
type Ctx = { g: Graph; now: number; v: View; inner: number; hidden: Set<string>; avail: number }

const visibleKids = (c: Ctx, n: Node): Node[] =>
  c.v.collapsed.has(n.id) ? [] : n.children.filter(k => !c.hidden.has(k.id))

type Cell = { ch: string; fg: string }
const RUN = STATE_COLOR.running
const glyph = (u: boolean, d: boolean, l: boolean, r: boolean): string => {
  if (u && d) return l && r ? '┼' : r ? '├' : l ? '┤' : '│'
  if (u) return l && r ? '┴' : r ? '╰' : l ? '╯' : '│'
  if (d) return l && r ? '┬' : r ? '╭' : l ? '╮' : '│'
  return l || r ? '─' : ' '
}
const cellsLine = (cells: Cell[]): Line => {
  const out: Line = []
  for (const c of cells) {
    const last = out[out.length - 1]
    if (last && last.fg === c.fg) last.t += c.ch
    else out.push({ t: c.ch, fg: c.fg })
  }
  return out
}

// Trunk + bus + drops between a parent column and its children's columns (one row of siblings).
function connector(parentX: number, kids: { x: number; state: State }[], width: number, frame: number): Line[] {
  const xs = [parentX, ...kids.map(k => k.x)]
  const lo = Math.min(...xs), hi = Math.max(...xs)
  const blank = (): Cell[] => Array.from({ length: width }, () => ({ ch: ' ', fg: CONNECTOR }))
  const trunk = blank(), bus = blank()
  const heavy = kids.some(k => k.state === 'running')
  trunk[parentX] = { ch: heavy ? '┃' : '│', fg: heavy ? RUN : CONNECTOR }
  for (let x = lo; x <= hi; x++) {
    const isKid = kids.some(k => k.x === x)
    const ch = glyph(x === parentX, isKid, x > lo, x < hi)
    bus[x] = { ch, fg: CONNECTOR }
  }
  for (const k of kids) {
    const run = k.state === 'running'
    bus[k.x] = { ...bus[k.x]!, fg: run ? RUN : STATE_COLOR[k.state] }
    if (run) {
      for (let x = Math.min(parentX, k.x); x <= Math.max(parentX, k.x); x++) {
        const cur = bus[x]!
        bus[x] = { ch: cur.ch === '─' ? '━' : cur.ch, fg: RUN }
      }
    }
  }
  // moving glyph along the path to each running child
  for (const k of kids) {
    if (k.state !== 'running') continue
    const step = k.x >= parentX ? 1 : -1
    const path: [Cell[], number][] = [[trunk, parentX]]
    for (let x = parentX; ; x += step) { path.push([bus, x]); if (x === k.x) break }
    const [row, x] = path[((frame % path.length) + path.length) % path.length]!
    row[x] = { ch: '•', fg: PULSE }
  }
  return [cellsLine(trunk), cellsLine(bus)]
}

function layoutNode(c: Ctx, n: Node): Block {
  const boxW = c.inner + 2
  const own = nodeBox(c, n)
  const ownCx = Math.floor(boxW / 2)
  const kids = visibleKids(c, n)
  if (kids.length === 0) return { lines: own.lines, cx: ownCx, w: boxW }

  const blocks = kids.map(k => ({ b: layoutNode(c, k), n: k }))
  // rows of siblings that fit the pane
  const rows: (typeof blocks)[] = []
  let cur: typeof blocks = [], curW = 0
  for (const x of blocks) {
    const add = (cur.length ? GAP : 0) + x.b.w
    if (cur.length && curW + add > c.avail) { rows.push(cur); cur = []; curW = 0 }
    curW += (cur.length ? GAP : 0) + x.b.w
    cur.push(x)
  }
  if (cur.length) rows.push(cur)

  const place = rows.map(row => {
    let off = 0
    return row.map(x => { const at = off; off += x.b.w + GAP; return { ...x, at, cx: at + x.b.cx } })
  })
  const first = place[0]!
  let pcx = Math.floor((first[0]!.cx + first[first.length - 1]!.cx) / 2)
  const shift = Math.max(0, ownCx - pcx)
  pcx += shift
  const rowW = place.map(r => shift + r[r.length - 1]!.at + r[r.length - 1]!.b.w)
  const W = Math.max(boxW + (pcx - ownCx), ...rowW)
  const left = pcx - ownCx
  const fit = (l: Line) => padLine(l, W)

  const lines: Line[] = own.lines.map(l => fit([...sp(left), ...l]))
  place.forEach(row => {
    lines.push(...connector(pcx, row.map(x => ({ x: shift + x.cx, state: x.n.state })), W, c.v.frame).map(fit))
    const h = Math.max(...row.map(x => x.b.lines.length))
    for (let r = 0; r < h; r++) {
      const parts: Line = [...sp(shift)]
      row.forEach((x, i) => {
        if (i) parts.push(...sp(GAP))
        parts.push(...padLine(x.b.lines[r] ?? [], x.b.w))
      })
      lines.push(fit(parts))
    }
  })
  return { lines, cx: pcx, w: W }
}

function levelCounts(c: Ctx, n: Node, d: number, acc: number[]): number[] {
  acc[d] = (acc[d] ?? 0) + 1
  for (const k of visibleKids(c, n)) levelCounts(c, k, d + 1, acc)
  return acc
}

export const EMPTY_MESSAGE = 'Aguardando agentes… use o Claude normalmente'

const LEGEND_ITEMS: [string, State][] = [
  ['● Concluído', 'done'], ['┄ Concluído · aguarda filhos', 'done'], ['● Executando', 'running'], ['● Atenção', 'attention'],
  ['● Pendente', 'pending'], ['● Inativo', 'inactive'], ['✗ Falha', 'failed'],
]
const WT_LEGEND = '⧉ Worktree'
export function legendLine(): Line {
  return [...LEGEND_ITEMS.flatMap(([t, s], i) => [...(i ? sp(2) : []), { t, fg: STATE_COLOR[s] } as Seg]), ...sp(2), { t: WT_LEGEND, fg: WORKTREE_COLOR } as Seg]
}

// Legend + depth on one line when they fit; otherwise the legend wraps by item and depth gets its own line.
export function footerLines(w: number, depth: Line): Line[] {
  const one = legendLine()
  if (lineWidth(one) + 2 + lineWidth(depth) <= w) return [spread(one, depth, w)]
  const out: Line[] = []
  let cur: Line = []
  for (const [t, s] of LEGEND_ITEMS) {
    const item: Seg = { t, fg: STATE_COLOR[s] }
    if (cur.length && lineWidth(cur) + 2 + len(t) > w) { out.push(cur); cur = [] }
    cur = [...cur, ...(cur.length ? sp(2) : []), item]
  }
  const wtSeg: Seg = { t: WT_LEGEND, fg: WORKTREE_COLOR }
  if (cur.length && lineWidth(cur) + 2 + len(WT_LEGEND) > w) { out.push(cur); cur = [] }
  cur = [...cur, ...(cur.length ? sp(2) : []), wtSeg]
  if (cur.length) out.push(cur)
  return [...out, depth]
}

// Detail view of one agent: what the Office knows (persona, state, prompt, todos, activity, files).
// Claude Code exposes no transcript API to mods, so this is the monitor's own record of the agent.
export function detailLines(agents: AgentLike[], id: string, now: number): Line[] | undefined {
  const a = agents.find(x => x.id === id)
  if (!a) return undefined
  const g = buildGraph(agents, now)
  const n = g.nodes.get(id)
  if (!n) return undefined
  const row = (label: string, value: string): Line => [{ t: label + ': ', fg: DIM }, { t: value }]
  const out: Line[] = [
    [{ t: stateIcon(n.state), fg: STATE_COLOR[n.state] }, { t: n.name, bold: true }],
    [{ t: [n.persona, n.model, n.effort].filter(Boolean).join(' · '), fg: DIM }],
    row('Estado', n.state), row('Duracao', fmtMMSS(durationOf(n, now))), row('Descricao', a.description),
  ]
  if (n.git) for (const t of gitLabel(n.git) ?? []) out.push([{ t, fg: DIM }])
  if (n.tool) out.push(row('Agora', n.tool))
  if (a.recent?.length) out.push(row('Recentes', [...a.recent].reverse().join(' < ')))
  if (a.prompt) { out.push([], [{ t: 'Prompt', bold: true }], ...a.prompt.split('\n').map(t => [{ t }] as Line)) }
  if (a.todos?.length) { out.push([], [{ t: 'Tarefas', bold: true }], ...a.todos.map(t => [{ t: todoMark(t.status) + t.content }] as Line)) }
  if (a.files?.length) { out.push([], [{ t: 'Arquivos', bold: true }], ...a.files.map(t => [{ t }] as Line)) }
  return out
}
const todoMark = (s: string) => (s === 'completed' ? '✓ ' : s === 'in_progress' ? '● ' : '○ ')

export const THUMB_COLS = 12
export const THUMB_ROWS = 5
export type Thumb = { id: string; name: string; host: string; columns: number; rows: number; alt: string }
export type Frame = { header: Line[]; body: Line[]; footer: Line[]; lines: Line[]; thumbs: Thumb[]; collapsible: { id: string; name: string; hidden: number }[] }

export function renderMonitor(agents: AgentLike[], now: number, v: View): Frame {
  const w = Math.max(20, v.width)
  const g = buildGraph(agents, now, v.git, v.sessionTool)
  const inner = w - 2

  const prog = overallProgress(g)
  const eta = etaOf(g)
  const progSegs: Line = prog === undefined
    ? [{ t: 'Progresso Geral —' }]
    : [{ t: `Progresso Geral ${pctText(prog)} ` }, { t: progressBar(prog), fg: STATE_COLOR.running }]
  const elapsed = agents.length ? fmtHMS(elapsedOf(g, now)) : '—'
  const stats: Line = [{ t: `Decorrido ${elapsed}   ${eta === undefined ? 'ETA indisponível' : 'Estimativa ' + fmtHMS(eta)}` }]
  const sid = (v.sessionId ?? '').slice(0, 6) || '—'
  const sub: Line = [{ t: `Claude Code · Projeto: ${v.project || '—'} · Sessão: #${sid}`, fg: DIM }]
  const side: Seg = { t: '│', fg: HEADER }
  const header: Line[] = [
    [{ t: '╭' + '─'.repeat(inner) + '╮', fg: HEADER }],
    [side, ...spread([{ t: 'Office Agent Monitor', bold: true }], progSegs, inner), side],
    [side, ...spread(sub, stats, inner), side],
    [{ t: '╰' + '─'.repeat(inner) + '╯', fg: HEADER }],
  ]
  const depth: Line = [{ t: `Níveis de profundidade: ${maxDepthOf(g)}/${MAX_DEPTH}`, fg: DIM }]
  const footer: Line[] = footerLines(w, depth)

  let body: Line[]
  if (agents.length === 0) {
    body = [[], [{ t: truncRunes(EMPTY_MESSAGE, w), fg: DIM }]]
  } else {
    const hidden = hiddenIds(g, now)
    const probe: Ctx = { g, now, v, inner: 12, hidden, avail: w }
    const widest = Math.max(...levelCounts(probe, g.root, 0, []).map(x => x ?? 0))
    const perRow = Math.max(1, Math.min(widest, Math.floor(w / 16)))
    const boxW = Math.floor((w - GAP * (perRow - 1)) / perRow)
    const c: Ctx = { ...probe, inner: Math.max(12, Math.min(24, boxW - 2)) }
    // center the whole tree in the pane; every line shares the same left pad, so connectors stay aligned
    const tree = layoutNode(c, g.root).lines
    const treeW = Math.max(0, ...tree.map(lineWidth))
    const pad = Math.max(0, Math.floor((w - treeW) / 2))
    body = tree.map(l => [...sp(pad), ...l])
    if (c.hidden.size && g.root.children.every(k => c.hidden.has(k.id))) body = [...body, [{ t: truncRunes('Tudo concluído — agentes ocultos após 30s', w), fg: DIM }]]
  }
  const gone = agents.length ? hiddenIds(g, now) : new Set<string>()
  const collapsible = [...g.nodes.values()]
    .filter(n => n.kind !== 'task' && n.children.length > 0 && !gone.has(n.id))
    .map(n => ({ id: n.id, name: n.kind === 'session' ? 'Claude Code' : n.name, hidden: v.collapsed.has(n.id) ? n.children.length : 0 }))
  const lines = [...header, ...body, ...footer].map(l => truncLine(l, w))
  // thumbnail strip: running agents that hold a picture, newest last, as many as fit the width
  const fit = Math.max(1, Math.floor((w + 2) / (THUMB_COLS + 2)))
  const thumbs: Thumb[] = !v.thumbs ? [] : agents
    .filter(a => a.shot?.has && g.nodes.get(a.id) && ['running', 'attention'].includes(g.nodes.get(a.id)!.state) && !gone.has(a.id))
    .slice(-fit)
    .map(a => ({ id: a.id, name: g.nodes.get(a.id)!.name, host: a.shot!.host ?? '', columns: THUMB_COLS, rows: THUMB_ROWS, alt: `[tela: ${a.shot!.host ?? 'browser'}]` }))
  return { header, body: body.map(l => truncLine(l, w)), footer, lines, thumbs, collapsible }
}

// Size the pane's content wants: rows = rendered lines, columns = widest line (natural layout at up to 100 cols).
export function contentSize(agents: AgentLike[], now: number, v: View): { rows: number; columns: number } {
  const f = renderMonitor(agents, now, { ...v, width: Math.min(100, Math.max(40, v.width)) })
  const widest = Math.max(0, ...f.lines.map(lineWidth))
  const extra = f.thumbs.length ? 1 + THUMB_ROWS : 0 // caption line + picture rows of the strip
  return { rows: f.lines.length + extra, columns: Math.min(120, Math.max(40, widest)) }
}

// Inline pane (above the prompt) takes `rows`; cap it so the chat is never pushed away.
export const MAX_INLINE_ROWS = 30
export function inlineSize(agents: AgentLike[], now: number, v: View): { rows: number; columns: number } {
  const s = contentSize(agents, now, v)
  return { rows: Math.min(MAX_INLINE_ROWS, Math.max(1, s.rows)), columns: s.columns }
}

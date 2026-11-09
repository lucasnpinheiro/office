// Office Agent Monitor: mind-map layout and text helpers. Single office package: the
// Claude Code mod is the only implementation (the former Go TUI was folded in and removed).
// No engine APIs, no clock: the caller passes `now` and the animation `frame`.
import { gitLabel } from './git'
import type { GitInfo } from './git'
import type { AgentRecord as AgentLike } from './office'
import { HIDE_AFTER_MS } from './office'
import { buildGraph, hiddenIds, hasRunningDescendant, MAX_DEPTH, isQuotaError, ATTENTION_AFTER_MS, isOpenNode, progressOf, overallProgress, durationOf, elapsedOf, etaOf, maxDepthOf } from './run-model'
import type { Node, Graph, State, Kind, ToolNote } from './run-model'
import { STATE_COLORS, nodeView, stateColor } from './vocabulary'
import type { Vocab } from './vocabulary'

// Provisório (T-002): as telas ainda importam daqui; T-013 remove o que ficar sem chamador.
export { buildGraph, hiddenIds, MAX_DEPTH, isQuotaError, ATTENTION_AFTER_MS, isOpenNode, progressOf, overallProgress, durationOf, elapsedOf, etaOf, maxDepthOf }
export type { Node, Graph, State, Kind, ToolNote }

// ---------- text helpers ----------
export type Seg = { t: string; fg?: string; bold?: boolean; dim?: boolean; node?: string; toggle?: string; attach?: string; act?: string; hotkey?: string; btn?: true; variant?: 'primary' | 'secondary' } // node: click opens that agent's detail; toggle: click expands/collapses its branch
export type Line = Seg[]

export const STATE_COLOR: Record<State, string> = STATE_COLORS // derivado de vocabulary.STATE_TABLE
const DIM = '#A9ADB5'
export const WORKTREE_COLOR = '#BD9BFF' // linked git worktree: purple, apart from every state color
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

// Glifo da tabela única (vocabulary.STATE_TABLE) mais um espaço; coluna ASCII quando `vocab.ascii`.
const DEFAULT_VOCAB: Vocab = { ascii: false, color: true }
export function stateIcon(s: State, vocab: Vocab = DEFAULT_VOCAB): string {
  return nodeView(s, vocab).glyph + ' '
}


// ---------- árvore (Rodada 5): sem caixas, uma linha por agente ----------
export type View = {
  width: number
  frame: number
  collapsed: Set<string>
  project: string
  sessionId?: string
  git?: GitInfo // branch/worktree of the session's own cwd
  sessionTool?: ToolNote
  vocab?: Vocab // glifos ASCII e cor (OFFICE_ASCII, NO_COLOR); ausente = Unicode com cor
  thumbs?: boolean // opt-in browser thumbnails; false = no change at all
}

export const EMPTY_MESSAGE = 'Aguardando agentes… use o Claude normalmente'
const WIDE_MIN = 100 // abaixo disso: forma compacta de 60 colunas
const MINI_CELLS = 4
const KEYS_WIDE = 'j k mover · ⏎ abrir · v visão · f falhas · s buscar · d decidir · r repetir · x parar · q fechar'
const KEYS_NARROW = 'j k · ⏎ · v · f · d · r · x · q'

type TreeCtx = { g: Graph; now: number; v: View; gone: Set<string>; wide: boolean; ascii: boolean }

/** Agentes (não tarefas) visíveis na árvore, sem os já ocultos e sem os recolhidos. */
function visibleKids(c: TreeCtx, n: Node): Node[] {
  return c.v.collapsed.has(n.id) ? [] : n.children.filter(k => k.kind === 'agent' && !c.gone.has(k.id))
}

/** Barra mini de progresso do agente: ▬ preenchido, ╌ vazio; "—" sem dado. */
function miniBar(frac: number | undefined, color: string | undefined, ascii: boolean): Seg {
  if (frac === undefined) return { t: '—', fg: DIM }
  const f = Math.min(MINI_CELLS, Math.max(0, Math.round(frac * MINI_CELLS)))
  return { t: (ascii ? '=' : '▬').repeat(f) + (ascii ? '-' : '╌').repeat(MINI_CELLS - f), fg: color }
}

/** Uma linha de agente: conector, ícone do estado, nome, persona · modelo, worktree, barra, ferramenta, custo e tempo. */
function agentRow(c: TreeCtx, n: Node, conn: string, folded: number): Line {
  const view = nodeView(n.state, c.v.vocab ?? DEFAULT_VOCAB)
  const color = view.color
  const wt = (gitLabel(n.git, c.v.git?.repo) ?? []).find(t => t.startsWith('⧉'))
  const dur = fmtMMSS(durationOf(n, c.now))
  const fold: Line = folded ? [{ t: ` +${folded}`, fg: DIM }] : []
  const head: Line = [
    { t: conn, fg: DIM },
    { t: view.glyph + ' ', fg: color, node: n.id },
    { t: n.name, bold: true, node: n.id, fg: wt ? WORKTREE_COLOR : undefined },
    ...fold,
    ...(n.children.some(k => k.kind === 'agent') ? [{ t: c.v.collapsed.has(n.id) ? ' ▸' : ' ▾', fg: DIM, toggle: n.id } as Seg] : []),
  ]
  if (!c.wide) return [...head, { t: '  ' + dur, fg: DIM }]
  const persona = [n.persona, n.model].filter(Boolean).join(' · ')
  const tool = n.tool && n.state === 'running' ? [{ t: `  ▸ ${n.tool}`, fg: color }] : []
  return [
    ...head,
    ...(persona ? [{ t: ` · ${persona}`, fg: DIM }] : []),
    ...(wt ? [{ t: ` ${wt}`, fg: WORKTREE_COLOR }] : []),
    { t: '  ', fg: DIM }, miniBar(progressOf(n), color, c.ascii),
    ...tool,
    { t: '  ~$ —', fg: DIM },
    { t: '  ' + dur, fg: DIM },
  ]
}

/** Desenha a árvore recursiva com ├─ │ └─ (ou +- | em ASCII); a raiz da sessão não aparece. */
function treeRows(c: TreeCtx, nodes: Node[], base: string, top: boolean, out: Line[]): void {
  nodes.forEach((n, i) => {
    const last = i === nodes.length - 1
    const conn = top ? '' : base + (c.ascii ? '+- ' : last ? '└─ ' : '├─ ')
    const folded = c.v.collapsed.has(n.id) ? n.children.filter(k => k.kind === 'agent').length : 0
    out.push(agentRow(c, n, conn, folded))
    const childBase = top ? '' : base + (last ? '   ' : c.ascii ? '|  ' : '│  ')
    treeRows(c, visibleKids(c, n), childBase, false, out)
  })
}

/** Cabeçalho sem moldura: título, projeto, branch, tempo, contagens e custo (sempre "~$ —", sem dado). */
function headerLine(c: TreeCtx, agents: Node[]): Line {
  const running = agents.filter(n => n.state === 'running').length
  const done = agents.filter(n => n.state === 'done').length
  const elapsed = agents.length ? fmtMMSS(elapsedOf(c.g, c.now)) : '—'
  const branch = c.v.git?.branch ? [{ t: ` · ⎇ ${c.v.git.branch}`, fg: DIM }] : []
  const project = c.v.project ? ` · ${c.v.project}` : ''
  const sep: Seg = { t: ' · ', fg: DIM }
  if (!c.wide) return [{ t: `Office · ${elapsed} · ${running} rodando · ${done}/${agents.length} · ~$ —`, bold: false }]
  return [
    { t: 'Office', bold: true }, { t: project, fg: DIM }, ...branch, sep,
    { t: `${elapsed} · ${running} rodando · ${done} concluídos · ~$ —`, fg: DIM },
  ]
}

/** Linha de barras segmentadas (━━━━ por agente, na cor do estado) e "X/Y agentes". */
function barLine(c: TreeCtx, agents: Node[]): Line {
  const segs: Line = agents.map(n => ({ t: (c.ascii ? '====' : '━━━━') + ' ', fg: nodeView(n.state, c.v.vocab ?? DEFAULT_VOCAB).color }))
  const done = agents.filter(n => n.state === 'done').length
  return [...segs, { t: `${done}/${agents.length} agentes`, fg: DIM }]
}

/** Alertas no topo: falhas (✗) e agentes parados (▲), com o nome do agente. */
function alertLines(c: TreeCtx, agents: Node[]): Line[] {
  const vocab = c.v.vocab ?? DEFAULT_VOCAB
  return agents.flatMap(n => {
    if (n.state === 'failed') { const v = nodeView('failed', vocab); return [[{ t: `${v.glyph} ${n.name} falhou: ${n.error ?? '—'}`, fg: v.color }]] }
    if (n.state === 'attention') { const v = nodeView('attention', vocab); return [[{ t: `${v.glyph} ${n.name} parado sem sinal`, fg: v.color }]] }
    return []
  })
}

/** Um quadro do monitor: cabeçalho, alertas, árvore e rodapé de teclas, na largura pedida. */
export type Frame = { header: Line[]; body: Line[]; footer: Line[]; lines: Line[]; thumbs: Thumb[]; collapsible: { id: string; name: string; hidden: number }[] }

/** Monta o quadro completo do monitor (árvore sem caixas, forma de 60 colunas abaixo de 100). */
export function renderMonitor(agents: AgentLike[], now: number, v: View): Frame {
  const w = Math.max(20, v.width)
  const g = buildGraph(agents, now, v.git, v.sessionTool)
  const gone = agents.length ? hiddenIds(g, now) : new Set<string>()
  const c: TreeCtx = { g, now, v, gone, wide: w >= WIDE_MIN, ascii: !!v.vocab?.ascii }
  const all = [...g.nodes.values()].filter(n => n.kind === 'agent' && !gone.has(n.id))
  const visibleAgents = all
  const head: Line[] = [headerLine(c, visibleAgents)]
  if (c.wide && visibleAgents.length) head.push(barLine(c, visibleAgents))
  const alerts = alertLines(c, visibleAgents)
  let body: Line[]
  if (agents.length === 0) {
    body = [[{ t: truncRunes(EMPTY_MESSAGE, w), fg: DIM }]]
  } else {
    body = []
    treeRows(c, visibleKids(c, g.root), '', true, body)
    if (c.gone.size && g.root.children.every(k => c.gone.has(k.id))) body.push([{ t: truncRunes('Tudo concluído — agentes ocultos após 30s', w), fg: DIM }])
  }
  const footer: Line[] = [[{ t: c.wide ? KEYS_WIDE : KEYS_NARROW, fg: DIM }]]
  const header = [...head, ...alerts]
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
  const frame: Frame = { header: header.map(l => truncLine(l, w)), body: body.map(l => truncLine(l, w)), footer, lines, thumbs, collapsible }
  return v.vocab?.color === false ? noColor(frame) : frame
}

export const THUMB_COLS = 12
export const THUMB_ROWS = 5
/** Miniatura de tela de um agente de navegador, desenhada ao lado da linha. */
export type Thumb = { id: string; name: string; host: string; columns: number; rows: number; alt: string }

// NO_COLOR: nenhuma cor em nenhum trecho (estados, bordas, legenda, dicas).
const stripLine = (l: Line): Line => l.map(s => (s.fg === undefined ? s : { ...s, fg: undefined }))
function noColor(f: Frame): Frame {
  return { ...f, header: f.header.map(stripLine), body: f.body.map(stripLine), footer: f.footer.map(stripLine), lines: f.lines.map(stripLine) }
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

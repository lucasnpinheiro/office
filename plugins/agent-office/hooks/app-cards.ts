// Graphical cards for the app surfaces (desktop, vscode, mobile): same Graph as the terminal cards, different drawing.
// Pure: the caller (register.tsx) turns each AppCard into Box/Text. The terminal keeps the text cards of compact.ts.
import { buildGraph, progressOf, durationOf, fmtMMSS } from './monitor'
import type { Node, State } from './monitor'
import type { AgentRecord } from './office'
import { buildRunModel, RUN_STATE } from './run-model'
import type { RunModel, RunNode, RunState } from './run-model'
import { CAPABILITIES } from './capabilities'
import { chips } from './persona'
import { nodeView } from './vocabulary'
import { names, visibleSet } from './compact'
import { gitLabel } from './git'
import type { GitInfo } from './git'

export const isAppSurface = (surface?: string): boolean => surface === 'desktop' || surface === 'vscode' || surface === 'mobile'

// Theme keys, so light and dark follow the app's own theme (design Chips5: state on border and glyph, never color alone).
export type Tone = 'suggestion' | 'error' | 'warning' | 'success' | 'subtle'
export const TONE: Record<State, Tone> = { running: 'suggestion', failed: 'error', attention: 'warning', done: 'success', pending: 'subtle', inactive: 'subtle' }

export type AppCard = {
  id: string; title: string; state: State; runState: RunState; stalled: boolean; tone: Tone; glyph: string; chips: string[]
  pct?: number // 0..1; absent while a leaf runs without a real percent (never an invented number)
  pctText: string; time: string; status?: string
  git?: string[] // gitLabel lines: '⎇ branch' then '⧉ worktree' in a linked worktree
  hasKids?: boolean
  role?: 'orquestrador' | 'agente' | 'subagente' // by depth: main session, top-level agent, anything deeper
  steps?: { weight: number; tone: Tone }[] // one segment per tool step (flex by duration); absent = single pct bar
}

// Same RunNode the Terminal reads (compact.ts card): state, persona/model/effort and tool steps come from the RunModel.
const stepsOf = (n: Node, r: RunNode | undefined): AppCard['steps'] => {
  const st = r?.steps ?? []
  if (!st.length) return undefined
  const segs = st.map(x => ({ weight: Math.max(500, x.durationMs ?? 1000), tone: (x.ok === false ? 'error' : 'success') as Tone }))
  return n.state === 'running' ? [...segs, { weight: 1000, tone: 'suggestion' as Tone }] : segs
}
const cardOf = (n: Node, nm: Map<string, string>, now: number, r?: RunNode): AppCard => {
  const ch = chips(r?.persona ?? n.persona, r?.model ?? n.model, r?.effort ?? n.effort)
  const runState = r?.state ?? RUN_STATE[n.state]
  const tasks = n.children.filter(k => k.kind === 'task')
  const leafRunning = n.state === 'running' && n.children.length === 0
  const pct = n.state === 'done' ? 1 : leafRunning ? undefined : tasks.length ? tasks.filter(k => k.state === 'done').length / tasks.length
    : n.state === 'failed' ? 0.6 : progressOf(n) ?? 0
  return {
    id: n.id, title: nm.get(n.id) ?? n.name, state: n.state, runState, stalled: runState === 'stalled', tone: TONE[n.state],
    glyph: n.state === 'running' ? '●' : nodeView(n.state, { ascii: false, color: true }).glyph,
    chips: [ch.persona, ch.model, ch.effort].filter((x): x is string => !!x),
    pct, pctText: pct === undefined ? 'exec' : `${Math.round(pct * 100)}%`,
    time: n.start === undefined || n.state === 'pending' ? '--:--' : fmtMMSS(durationOf(n, now)),
    status: n.state === 'failed' || n.state === 'attention' ? n.error : n.tool,
    git: gitLabel(n.git), hasKids: n.children.some(k => k.kind === 'agent'), steps: stepsOf(n, r),
  }
}

const runsOf = (agents: readonly AgentRecord[], now: number, m?: RunModel) => new Map((m ?? buildRunModel(agents, now, CAPABILITIES)).nodes.map(r => [r.id, r]))

export function appCards(agents: AgentRecord[], now: number, o: { query?: string; filter?: 'all' | 'failed'; model?: RunModel }): AppCard[] {
  const g = buildGraph(agents, now)
  const nm = names(g), keep = visibleSet(g, o.query ?? '', new Set<string>(), o.filter), by = runsOf(agents, now, o.model) // no expiry: every finished card stays (B2)
  return [...g.nodes.values()].filter((n: Node) => n.kind === 'agent' && keep.has(n.id)).map(n => cardOf(n, nm, now, by.get(n.id)))
}

// Org chart for the app surfaces: the session card on top, each agent under its parent. Same Graph as the terminal map.
export type AppMapNode = { card: AppCard; children: AppMapNode[]; layout: 'row' | 'column' } // row under the root, column deeper
export function appMap(agents: AgentRecord[], now: number, o: { query?: string; filter?: 'all' | 'failed'; git?: GitInfo; model?: RunModel }): AppMapNode {
  const g = buildGraph(agents, now, o.git)
  const nm = names(g), keep = visibleSet(g, o.query ?? '', new Set<string>(), o.filter), by = runsOf(agents, now, o.model)
  const walk =(n: Node, depth = 0): AppMapNode => ({
    card: n.kind === 'session' ? { ...cardOf(n, nm, now), title: 'Orquestrador', status: undefined, role: 'orquestrador' }
      : { ...cardOf(n, nm, now, by.get(n.id)), role: depth <= 1 ? 'agente' : 'subagente' },
    children: n.children.filter(k => k.kind === 'agent' && keep.has(k.id)).map(k => walk(k, depth + 1)),
    layout: depth === 0 ? 'row' : 'column',
  })
  return walk(g.root) // design 2026-11-14: the Orquestrador box is always the root, even over a single agent
}

// Card grid: rows of as many 34-wide cards (gap 2) as the pane holds; an explicit row per chunk, so the layout never depends on flex wrap.
export const APP_CARD_W = 34, APP_GAP = 2
export const appPerRow = (cols: number): number => Math.max(1, Math.floor((cols - 2 + APP_GAP) / (APP_CARD_W + APP_GAP)))
export function appGrid<T>(items: readonly T[], cols: number): T[][] {
  const n = appPerRow(cols), rows: T[][] = []
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n))
  return rows
}

// Map siblings: one solid bus when they fit a single row, else rows under a dashed trunk, each with its own dashed bus.
export function mapRows<T>(kids: readonly T[], cols: number): { bus: 'solid' | 'dashed'; rows: T[][] } {
  const rows = appGrid(kids, cols)
  return { bus: rows.length > 1 ? 'dashed' : 'solid', rows }
}

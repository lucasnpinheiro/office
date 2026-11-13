// Graphical cards for the app surfaces (desktop, vscode, mobile): same Graph as the terminal cards, different drawing.
// Pure: the caller (register.tsx) turns each AppCard into Box/Text. The terminal keeps the text cards of compact.ts.
import { buildGraph, progressOf, durationOf, fmtMMSS, hiddenIds } from './monitor'
import type { Node, State } from './monitor'
import type { AgentLike } from './office'
import { chips } from './persona'
import { nodeView } from './vocabulary'
import { names, visibleSet } from './compact'
import { gitLabel } from './git'
import type { GitInfo } from './git'

export const isAppSurface = (surface?: string): boolean => surface === 'desktop' || surface === 'vscode' || surface === 'mobile'

// Theme keys, so light and dark follow the app's own theme (design Chips5: state on border and glyph, never color alone).
export type Tone = 'suggestion' | 'error' | 'warning' | 'success' | 'subtle'
const TONE: Record<State, Tone> = { running: 'suggestion', failed: 'error', attention: 'warning', done: 'success', pending: 'subtle', inactive: 'subtle' }

export type AppCard = {
  id: string; title: string; state: State; tone: Tone; glyph: string; chips: string[]
  pct?: number // 0..1; absent while a leaf runs without a real percent (never an invented number)
  pctText: string; time: string; status?: string
  git?: string[] // gitLabel lines: '⎇ branch' then '⧉ worktree' in a linked worktree
  hasKids?: boolean
}

const cardOf = (n: Node, nm: Map<string, string>, now: number): AppCard => {
  const ch = chips(n.persona, n.model, n.effort)
  const tasks = n.children.filter(k => k.kind === 'task')
  const leafRunning = n.state === 'running' && n.children.length === 0
  const pct = n.state === 'done' ? 1 : leafRunning ? undefined : tasks.length ? tasks.filter(k => k.state === 'done').length / tasks.length
    : n.state === 'failed' ? 0.6 : progressOf(n) ?? 0
  return {
    id: n.id, title: nm.get(n.id) ?? n.name, state: n.state, tone: TONE[n.state],
    glyph: n.state === 'running' ? '●' : nodeView(n.state, { ascii: false, color: true }).glyph,
    chips: [ch.persona, ch.model, ch.effort].filter((x): x is string => !!x),
    pct, pctText: pct === undefined ? 'exec' : `${Math.round(pct * 100)}%`,
    time: n.start === undefined || n.state === 'pending' ? '--:--' : fmtMMSS(durationOf(n, now)),
    status: n.state === 'failed' || n.state === 'attention' ? n.error : n.tool,
    git: gitLabel(n.git), hasKids: n.children.some(k => k.kind === 'agent'),
  }
}

export function appCards(agents: AgentLike[], now: number, o: { query?: string; filter?: 'all' | 'failed' }): AppCard[] {
  const g = buildGraph(agents, now)
  const nm = names(g), keep = visibleSet(g, o.query ?? '', hiddenIds(g, now), o.filter)
  return [...g.nodes.values()].filter((n: Node) => n.kind === 'agent' && keep.has(n.id)).map(n => cardOf(n, nm, now))
}

// Org chart for the app surfaces: the session card on top, each agent under its parent. Same Graph as the terminal map.
export type AppMapNode = { card: AppCard; children: AppMapNode[] }
export function appMap(agents: AgentLike[], now: number, o: { query?: string; filter?: 'all' | 'failed'; git?: GitInfo }): AppMapNode {
  const g = buildGraph(agents, now, o.git)
  const nm = names(g), keep = visibleSet(g, o.query ?? '', hiddenIds(g, now), o.filter)
  const walk = (n: Node): AppMapNode => ({
    card: n.kind === 'session' ? { ...cardOf(n, nm, now), title: 'Claude Code / Orquestrador', chips: ['Orquestrador'], status: undefined } : cardOf(n, nm, now),
    children: n.children.filter(k => k.kind === 'agent' && keep.has(k.id)).map(walk),
  })
  return walk(g.root)
}

// Run model: pure graph, progress and the RunModel the renderers read. No engine APIs, no clock, no I/O:
// the caller passes `now`. Extracted from monitor.ts (T-002); monitor.ts re-exports it until the views migrate.
import { parseDescription, modelLabel, EFFORT_DISPLAY } from './persona'
import type { AgentRecord } from './office'
import type { GitInfo } from './git'
import { HIDE_AFTER_MS } from './office'
import type { Capabilities } from './capabilities'

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
export const hasRunningDescendant = (n: Node): boolean => n.children.some(c => c.state === 'running' || hasRunningDescendant(c))

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
export function buildGraph(agents: readonly AgentRecord[], now: number, sessionGit?: GitInfo, sessionTool?: ToolNote): Graph {
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
  const starts = [...g.nodes.values()].filter(n => n.kind !== 'session' && n.start !== undefined && Number.isFinite(n.start)).map(n => n.start!)
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

// ---------- RunModel (contrato em spec/04-contracts.md) ----------
export type RunState = 'queued' | 'running' | 'needs-you' | 'stalled' | 'paused' | 'failed' | 'done' | 'stopped'
export type { Surface, CapabilityKey, Verdict, Capabilities } from './capabilities'

export type ToolStep = { id: string; tool: string; label: string; startedAt: number; durationMs?: number; ok?: boolean; io?: { input: string; output?: string } }
export type Usage = { tokens?: number; costUsd?: number }
export type PendingDecision = { toolUseId: string; agentId?: string; tool: string; label: string; reason?: string; phase: 'pending' | 'sending' | 'rejected'; message?: string }

export type RunNode = {
  id: string; parentId?: string; name: string; persona?: string; model?: string; effort?: string
  state: RunState
  worktree?: { path: string; branch?: string; ahead?: number; files?: number }
  startedAt?: number; endedAt?: number
  steps: ToolStep[]; droppedSteps: number
  usage: Usage
  promptMasked?: string; error?: string
  total?: { done: number; of: number }
  pending?: PendingDecision
}
export type WorkflowRun = { name: string; round?: number; phases: { name: string; done: number; total: number; agentIds: string[] }[] }
export type RunModel = {
  nodes: RunNode[]; roots: string[]
  attention: string[]
  workflow?: WorkflowRun
  totals: { running: number; done: number; of: number; tokens?: number; costUsd?: number; partial: boolean }
  etaMs?: number
  caps: Capabilities
}

export const RUN_STATE: Record<State, RunState> = { pending: 'queued', running: 'running', attention: 'stalled', failed: 'failed', done: 'done', inactive: 'stopped' }
const validTime = (t?: number): number | undefined => (typeof t === 'number' && Number.isFinite(t) ? t : undefined)

// Session tokens = per-agent counts + the main session's own turn.step tokens. Undefined when nothing is known.
// Partial (never presented as complete) when some agent is unknown or the main-session figure is not captured.
const sumTokens = (nodes: RunNode[], sessionTokens?: number): { tokens?: number; partial: boolean } => {
  const known = nodes.map(n => n.usage.tokens).filter((t): t is number => t !== undefined)
  if (!known.length && sessionTokens === undefined) return { tokens: undefined, partial: false }
  return { tokens: known.reduce((n, t) => n + t, 0) + (sessionTokens ?? 0), partial: known.length < nodes.length || sessionTokens === undefined }
}

// Pure: same input, same model. A parent missing from the list (e.g. dropped by the 60-entry cap) makes its child a root.
export function buildRunModel(agents: readonly AgentRecord[], now: number, caps: Capabilities, sessionTokens?: number): RunModel {
  const g = buildGraph(agents, now)
  const byId = new Map(agents.map(a => [a.id, a] as const))
  const nodes: RunNode[] = []
  for (const n of g.nodes.values()) {
    if (n.kind !== 'agent') continue
    const tasks = n.children.filter(c => c.kind === 'task')
    const rec = byId.get(n.id)
    nodes.push({
      id: n.id, parentId: n.parentId && n.parentId !== g.root.id ? n.parentId : undefined, name: n.name,
      persona: n.persona || undefined, model: n.model || undefined, effort: n.effort,
      state: RUN_STATE[n.state],
      worktree: n.git?.worktree ? { path: n.git.worktree, branch: n.git.branch } : undefined,
      startedAt: validTime(n.start), endedAt: validTime(n.end),
      steps: rec?.steps ?? [], droppedSteps: rec?.droppedSteps ?? 0, usage: rec?.usage ?? {}, promptMasked: rec?.prompt, error: n.error, // rec.prompt is stored already masked (mask.ts)
      total: tasks.length ? { done: tasks.filter(c => c.state === 'done').length, of: tasks.length } : undefined,
    })
  }
  return {
    nodes,
    roots: nodes.filter(n => n.parentId === undefined).map(n => n.id),
    attention: [...nodes.filter(n => n.state === 'needs-you'), ...nodes.filter(n => n.state === 'stalled'), ...nodes.filter(n => n.state === 'failed')].map(n => n.id),
    totals: {
      running: nodes.filter(n => n.state === 'running').length, done: nodes.filter(n => n.state === 'done').length, of: nodes.length,
      ...sumTokens(nodes, sessionTokens),
    },
    caps,
  }
}

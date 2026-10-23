// Pure helpers of the monitor: command parsing and redraw timing. No engine APIs here, so it is unit-testable.
export type Status = 'working' | 'done' | 'error'
export type AgentLike = {
  id: string
  agentId?: string
  parentAgentId?: string
  description: string
  status: Status
  startedAt: number
  endedAt?: number
  active?: boolean // false until the agent makes its first tool call (pending); undefined = unknown, treated as running
  error?: string // failure message (quota errors become attention items)
  seenAt?: number // last activity (tool call / spawn); drives the "attention" state
  prompt?: string
  model?: string // from the Agent call when the description prefix has none
  effort?: string
  local?: number // local tool calls (Read/Edit/Grep...)
  mcp?: Record<string, number> // MCP calls by server
  web?: Record<string, number> // external calls by tool/command
  files?: string[] // files edited/written
  cwd?: string // directory the agent runs in (spawn cwd, worktree path)
  tool?: string // tool in use now (label only, never arguments)
  recent?: string[] // last 3 distinct actions
  shot?: { host?: string; has?: boolean } // browser screenshot facts; the picture bytes live only in memory, never here
  isolated?: boolean // spawned with isolation: worktree; cwd unknown until a result/file path reveals it
  git?: { branch?: string; worktree?: string; repo?: string } // resolved from cwd, never stored
  todos?: { id?: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[]
}

export type Sub = 'start' | 'stop' | 'toggle' | 'help' | 'collapse' | 'expand' | 'status' | 'reset'

// /office start|star|open -> start ; stop|close|fechar -> stop ; bare -> toggle
export function parseSub(args: string): Sub {
  const w = (args || '').trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (w === '') return 'toggle'
  if (['start', 'star', 'open', 'abrir', 'iniciar'].includes(w)) return 'start'
  if (['stop', 'close', 'fechar', 'parar'].includes(w)) return 'stop'
  if (['collapse', 'recolher', 'colapsar'].includes(w)) return 'collapse'
  if (['expand', 'expandir'].includes(w)) return 'expand'
  if (['status', 'estado'].includes(w)) return 'status'
  if (['reset', 'resetar'].includes(w)) return 'reset'
  return 'help'
}

// ---------- timing ----------
export const FRAME_MS = 150 // connector pulse + border breath, ~6 fps, only while something runs
export const TICK_MS = 1000 // clocks (elapsed) while something is open but not running

export const isRunning = (agents: AgentLike[]): boolean => agents.some(a => a.status === 'working')

// Pulse frame: moves only while an agent runs; otherwise it is frozen at 0.
export function frameFor(agents: AgentLike[], now: number): number {
  return isRunning(agents) ? Math.floor(now / FRAME_MS) : 0
}

export const HIDE_AFTER_MS = 30_000 // finished agents leave the map this long after they end

// Finished agent still on screen, waiting for its hide deadline: keep the clock ticking.
export const hasPendingHide = (agents: AgentLike[], now: number): boolean =>
  agents.some(a => a.status !== 'working' && a.endedAt !== undefined && now - a.endedAt <= HIDE_AFTER_MS)

// Generation counter for the redraw timer: schedule() awaits state before it arms a timer, so two overlapping
// calls could both arm one and the first was never cancelled (timers multiplied while agents ran). Only the
// newest generation may arm the timer.
export function ticker(): { next: () => number; current: (g: number) => boolean } {
  let gen = 0
  return { next: () => ++gen, current: g => g === gen }
}

// Next redraw delay; undefined = nothing is open, no timer needed.
export const COMPACT_FRAME_MS = 250 // compact view: 4 fps, within the 2-5 fps budget
export function nextDelay(agents: AgentLike[], now: number = Date.now(), opts?: { reducedMotion?: boolean; compact?: boolean }): number | undefined {
  if (isRunning(agents)) return opts?.reducedMotion ? TICK_MS : opts?.compact ? COMPACT_FRAME_MS : FRAME_MS
  return hasPendingHide(agents, now) ? TICK_MS : undefined
}

// Columns of the pane body: the pane's own (`bodyColumns`), not the whole surface's viewport.
export function paneWidth(props?: { bodyColumns?: number }, viewport?: { columns?: number }): number {
  return props?.bodyColumns || viewport?.columns || 80
}

// Signature of what a redraw would show: data + animation frame + second (the clocks). Equal = skip the redraw.
export function drawSig(agents: AgentLike[], now: number): string {
  return `${frameFor(agents, now)}|${Math.floor(now / 1000)}|${JSON.stringify(agents)}`
}

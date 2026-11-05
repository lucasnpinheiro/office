// Per-agent capture in memory (T-003): one ToolStep per finished tool call, and tokens from turn.step.
// Pure: no engine APIs, no disk, no network. Costs stay undefined (ADR 0002: no price table).
import type { AgentRecord } from './office'
import type { ToolStep, Usage } from './run-model'
import { toolLabel } from './stats'

export const MAX_STEPS = 200

// Inserts a finished step by startedAt (parallel calls end out of order; steps stay in START order, ties keep arrival
// order). A repeated id gets a "#n" suffix so ids stay unique. Past MAX_STEPS the oldest goes and droppedSteps counts it.
export function pushStep(a: AgentRecord, step: ToolStep): AgentRecord {
  const prev = a.steps ?? []
  const taken = new Set(prev.map(s => s.id))
  let id = step.id
  for (let n = 2; taken.has(id); n++) id = `${step.id}#${n}`
  const item = id === step.id ? step : { ...step, id }
  let at = prev.length
  while (at > 0 && prev[at - 1]!.startedAt > item.startedAt) at--
  const next = [...prev.slice(0, at), item, ...prev.slice(at)]
  const over = next.length - MAX_STEPS
  return { ...a, steps: over > 0 ? next.slice(over) : next, droppedSteps: (a.droppedSteps ?? 0) + Math.max(0, over) }
}

// Step of one tool call: `durationMs` is measured by the caller around next(e). Label is secret-free (stats.toolLabel).
export function toolStep(id: string, tool: string, input: Record<string, unknown>, startedAt: number, durationMs: number, res: unknown): ToolStep {
  const isError = (res as { isError?: boolean } | undefined)?.isError === true
  return { id, tool, label: toolLabel(tool, input), startedAt, durationMs, ok: !isError }
}

// Tokens of one turn.step result (`usage` is null when the response carried none). Input + output + cache counts.
export function usageOf(res: unknown): Usage | undefined {
  const u = (res as { usage?: Record<string, unknown> | null } | undefined)?.usage
  if (!u || typeof u !== 'object') return undefined
  const parts = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'].map(k => u[k])
  if (!parts.every(v => typeof v === 'number' && Number.isFinite(v))) return undefined
  return { tokens: (parts as number[]).reduce((n, v) => n + v, 0) }
}

// Sums a step's tokens into the agent; undefined stays undefined (unknown is never zero).
export function addUsage(a: AgentRecord, add: Usage | undefined): AgentRecord {
  if (!add || add.tokens === undefined) return a
  return { ...a, usage: { ...(a.usage ?? {}), tokens: (a.usage?.tokens ?? 0) + add.tokens } }
}

// Main-session tokens (turn.step without agentId): running sum; undefined stays unknown, never zero.
export function addSessionTokens(cur: number | undefined, add: Usage | undefined): number | undefined {
  if (!add || add.tokens === undefined) return cur
  return (cur ?? 0) + add.tokens
}

// Runs the capture; on any internal error the agent comes back unchanged and nothing is recorded.
export function recordSafely(a: AgentRecord, make: () => ToolStep): AgentRecord {
  try {
    return pushStep(a, make())
  } catch {
    return a
  }
}

// Per-agent capture in memory (T-003): one ToolStep per finished tool call, and tokens from turn.step.
// Pure: no engine APIs, no disk, no network. Costs stay undefined (ADR 0002: no price table).
import type { AgentRecord } from './office'
import type { ToolStep, Usage } from './run-model'
import { toolLabel } from './stats'
import { maskText, maskCapped, MASK_FAILED } from './mask'

// Fields of the tool.call event that are envelope, not tool arguments (the engine passes arguments flat on the event).
const ENVELOPE = new Set(['tool', 'tool_use_id', 'agentId', 'parentAgentId', 'session_id', 'transcript_path', 'permission_mode', 'hook_event_name', 'type', 'isolation'])
export function toolArgs(e: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(e).filter(([k]) => !ENVELOPE.has(k)))
}

// Error text for the state: masked first, cut to 200 after (a secret on the boundary never leaks a part).
export function errorText(res: unknown): string {
  let t: unknown
  if (res instanceof Error) t = res.message
  else {
    const r = res as { text?: string; content?: unknown } | undefined
    t = r?.text ?? (() => { try { return JSON.stringify(r?.content ?? '') } catch { return MASK_FAILED } })()
  }
  const m = maskText(String(t))
  return m === MASK_FAILED ? m : m.slice(0, 200)
}

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
// With `captureIo` (OFFICE_CAPTURE_IO=1) the step also carries masked input/output, each cut to IO_MAX; without it
// there is no `io` key at all. Serialization or masking failure stores MASK_FAILED, never the original.
export function toolStep(id: string, tool: string, input: Record<string, unknown>, startedAt: number, durationMs: number, res: unknown, captureIo = false): ToolStep {
  const isError = (res as { isError?: boolean } | undefined)?.isError === true
  const step: ToolStep = { id, tool, label: maskText(toolLabel(tool, input)), startedAt, durationMs, ok: !isError }
  if (captureIo) {
    const text = (v: unknown): string | undefined => {
      if (typeof v === 'string') return v
      try { return JSON.stringify(v) } catch { return MASK_FAILED }
    }
    const i = text(input) ?? ''
    const rr = res as { result?: unknown } | undefined
    const o = text(rr && typeof rr === 'object' && 'result' in rr && rr.result !== undefined ? rr.result : res)
    step.io = { input: i === MASK_FAILED ? i : maskCapped(i), ...(o === undefined ? {} : { output: o === MASK_FAILED ? o : maskCapped(o) }) }
  }
  return step
}

// Tokens of one turn.step result (`usage` is null when the response carried none).
// Total = NEW tokens: input + output + cache_creation. cache_read_input_tokens is deliberately left out: the same
// cached context is re-read on every step, so summing it inflates the total far beyond what /cost bills as new work.
export function usageOf(res: unknown): Usage | undefined {
  const u = (res as { usage?: Record<string, unknown> | null } | undefined)?.usage
  if (!u || typeof u !== 'object') return undefined
  const parts = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens'].map(k => u[k])
  if (!parts.every(v => typeof v === 'number' && Number.isFinite(v))) return undefined
  if (typeof u.cache_read_input_tokens !== 'number' || !Number.isFinite(u.cache_read_input_tokens)) return undefined // malformed usage stays unknown
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

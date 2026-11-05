// T-008 (Visão Workflow). Pure text rendering: one string per line. Only data the engine gives is shown;
// name, round and phases come from the workflow event (ADR 0002). Nothing is invented: no phase name, no total.

export type WfAgent = { id: string; name: string }
export type WfPhase = { name: string; done: number; total: number; agentIds: string[] }
export type WfRun = { name: string; round?: number; phases: WfPhase[] }

const NONE = 'Nenhum workflow nesta sessão'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

// Recognized only when name and every phase are complete; anything else falls back to the plain agent list (AC-026).
function parseRun(raw: unknown): WfRun | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  if (!isStr(r.name) || !Array.isArray(r.phases) || r.phases.length === 0) return undefined
  const phases: WfPhase[] = []
  for (const p of r.phases) {
    if (typeof p !== 'object' || p === null) return undefined
    const ph = p as Record<string, unknown>
    if (!isStr(ph.name) || !isNum(ph.done) || !isNum(ph.total) || !Array.isArray(ph.agentIds)) return undefined
    phases.push({ name: ph.name, done: ph.done, total: ph.total, agentIds: ph.agentIds.filter(isStr) })
  }
  const round = isNum(r.round) ? r.round : undefined
  return { name: r.name, round, phases }
}

export function workflowLines(raw: unknown, agents: readonly WfAgent[]): string[] {
  if (raw === undefined || raw === null) return [NONE]
  const names = new Map(agents.map(a => [a.id, a.name]))
  const run = parseRun(raw)
  if (!run) return ['Agentes (sem fases):', ...agents.map(a => `  ${a.name}`)]
  const out = [run.name + (run.round !== undefined ? ` · Rodada ${run.round}` : '')]
  for (const ph of run.phases) out.push(`${ph.name} ${ph.done}/${ph.total}`)
  const current = run.phases.find(ph => ph.done < ph.total) ?? run.phases[run.phases.length - 1]
  out.push('Fase atual:')
  for (const id of current.agentIds) out.push(`  ${names.get(id) ?? id}`)
  return out
}

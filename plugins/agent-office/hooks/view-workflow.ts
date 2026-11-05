// T-008 (Visão Workflow). Pure text rendering: one string per line.
// O engine entrega só `workflow.runId` e `agentIndex` no agent.spawn (probe 2026-11-05, ADR 0002, `workflowEvent`):
// nenhum nome de fase, rodada ou total da execução. A visão agrupa os agentes por runId e declara as fases
// indisponíveis; nada é inventado e o total de agentes nunca é prometido (só "vistos").

export type WfAgent = { id: string; name: string; state: string; workflow?: { runId: string; agentIndex: number } }
export type WfRun = { runId: string; agents: WfAgent[] }

export const NO_WORKFLOW = 'Nenhum workflow nesta sessão'
export const PHASES_UNAVAILABLE = 'Fases: indisponíveis (o engine só informa o id da execução e a ordem dos agentes)'

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const idx = (a: WfAgent): number => (typeof a.workflow?.agentIndex === 'number' && Number.isFinite(a.workflow.agentIndex) ? a.workflow.agentIndex : Number.MAX_SAFE_INTEGER)

// Execuções na ordem em que apareceram; agente sem runId válido não entra em nenhuma.
export function workflowRuns(agents: readonly WfAgent[]): WfRun[] {
  const by = new Map<string, WfAgent[]>()
  for (const a of agents) {
    const id = a.workflow?.runId
    if (!isStr(id)) continue
    by.set(id, [...(by.get(id) ?? []), a])
  }
  return [...by].map(([runId, list]) => ({ runId, agents: [...list].sort((x, y) => idx(x) - idx(y)) }))
}

export const hasWorkflow = (agents: readonly { workflow?: { runId: string; agentIndex: number } }[]): boolean => agents.some(a => isStr(a.workflow?.runId))

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function workflowLines(agents: readonly WfAgent[]): string[] {
  const runs = workflowRuns(agents)
  if (!runs.length) return [NO_WORKFLOW]
  const out: string[] = []
  for (const r of runs) {
    const done = r.agents.filter(a => a.state === 'Concluído').length
    out.push(`Workflow ${r.runId} · ${plural(r.agents.length, 'agente visto', 'agentes vistos')} · ${plural(done, 'concluído', 'concluídos')}`)
    out.push(`  ${PHASES_UNAVAILABLE}`)
    for (const a of r.agents) out.push(`  ${Number.isFinite(a.workflow?.agentIndex) ? '#' + a.workflow!.agentIndex : '#?'} ${a.name} · ${a.state}`)
  }
  return out
}

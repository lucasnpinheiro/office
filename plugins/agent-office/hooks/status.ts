// /office status: plain-text summary of the monitor graph (replaces the removed Go `office status`).
// Pure: the caller passes `now` and the open flag.
import { buildGraph, maxDepthOf, overallProgress } from './monitor'
import type { AgentLike } from './office'

export function statusLines(agents: AgentLike[], now: number, open: boolean): string[] {
  const g = buildGraph(agents, now)
  let total = 0, running = 0, done = 0, failed = 0
  for (const n of g.nodes.values()) {
    if (n.kind !== 'agent') continue
    total++
    if (n.state === 'done') done++
    else if (n.state === 'failed') failed++
    else if (n.state === 'running' || n.state === 'attention') running++
  }
  const p = overallProgress(g)
  return [
    `aberto: ${open ? 'sim' : 'não'}`,
    `sessões: 1 · agentes: ${total} · profundidade máx: ${maxDepthOf(g)}`,
    `em execução: ${running} · concluídos: ${done} · falhas: ${failed}`,
    p === undefined ? 'progresso: sem tarefas conhecidas' : `progresso: ${Math.round(p * 100)}%`,
  ]
}

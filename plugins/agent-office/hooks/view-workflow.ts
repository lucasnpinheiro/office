// Visão Workflow (Rodada 5, Term5 "Workflow"). Sem caixas: nome · X/Y agentes; fases ligadas com o estado da cor
// da tabela; contagem por fase alinhada sob cada fase; fase atual com os seus agentes.
// O engine dá só `workflow.runId` e `agentIndex` no agent.spawn (probe 2026-11-05, ADR 0002): sem rodada e sem fase
// inventadas. Fase só aparece se o agente trouxer `workflow.phase`; senão a linha diz que as fases estão indisponíveis.
import type { Line } from './monitor'
import { strWidth, padWidth } from './monitor'
import { stateView, TOKENS } from './vocabulary'
import type { Vocab } from './vocabulary'

export type WfAgent = { id: string; name: string; state: string; workflow?: { runId: string; agentIndex: number; phase?: string } }
export type WfRun = { runId: string; agents: WfAgent[] }
type Phase = { name: string; agents: WfAgent[]; state: string }

export const NO_WORKFLOW = 'Nenhum workflow nesta sessão'
export const PHASES_UNAVAILABLE = 'Fases: indisponíveis (o engine só informa o id da execução e a ordem dos agentes)'

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const idx = (a: WfAgent): number => (typeof a.workflow?.agentIndex === 'number' && Number.isFinite(a.workflow.agentIndex) ? a.workflow.agentIndex : Number.MAX_SAFE_INTEGER)

/** Execuções na ordem em que apareceram, agentes por agentIndex; agente sem runId válido não entra em nenhuma. */
export function workflowRuns(agents: readonly WfAgent[]): WfRun[] {
  const by = new Map<string, WfAgent[]>()
  for (const a of agents) {
    const id = a.workflow?.runId
    if (!isStr(id)) continue
    by.set(id, [...(by.get(id) ?? []), a])
  }
  return [...by].map(([runId, list]) => ({ runId, agents: [...list].sort((x, y) => idx(x) - idx(y)) }))
}

/** Há ao menos um agente com runId válido na lista. */
export const hasWorkflow = (agents: readonly { workflow?: { runId: string; agentIndex: number } }[]): boolean => agents.some(a => isStr(a.workflow?.runId))

const muted = (v: Vocab): string | undefined => (v.color ? TOKENS.dark.muted : undefined)
const sepText = (v: Vocab): string => (v.ascii ? ' ---- ' : ' ──── ')

/** Estado da fase a partir dos agentes: falhou se algum falhou, concluída se todos concluíram, rodando se algum saiu da fila. */
function phaseState(agents: WfAgent[]): string {
  const sts = agents.map(a => a.state)
  if (sts.includes('failed')) return 'failed'
  if (sts.every(s => s === 'done')) return 'done'
  if (sts.some(s => s !== 'queued')) return 'running'
  return 'queued'
}

/** Fases pela ordem de aparição; só existem quando todo agente traz `workflow.phase`. */
function phasesOf(agents: WfAgent[]): Phase[] | undefined {
  if (!agents.every(a => isStr(a.workflow?.phase))) return undefined
  const names: string[] = []
  for (const a of agents) if (!names.includes(a.workflow!.phase!)) names.push(a.workflow!.phase!)
  return names.map(name => {
    const list = agents.filter(a => a.workflow!.phase === name)
    return { name, agents: list, state: phaseState(list) }
  })
}

/** Linha das fases: `✓ Decompor ──── ⠹ Executar ──── ○ Validar`, cada uma na cor do seu estado. */
function phaseLine(ps: Phase[], v: Vocab): Line {
  const line: Line = []
  ps.forEach((p, i) => {
    if (i) line.push({ t: sepText(v), fg: muted(v) })
    const sv = stateView(p.state, v, 'dark')
    line.push({ t: `${sv.glyph} ${p.name}`, fg: sv.color })
  })
  return line
}

/** Contagens `concluídos/total` de cada fase, alinhadas à coluna do glifo da fase na linha acima. */
function countLine(ps: Phase[], v: Vocab): Line {
  let out = ''
  let col = 0
  ps.forEach((p, i) => {
    const sv = stateView(p.state, v, 'dark')
    out = padWidth(out, col) + `${p.agents.filter(a => a.state === 'done').length}/${p.agents.length}`
    col += strWidth(`${sv.glyph} ${p.name}`) + (i < ps.length - 1 ? strWidth(sepText(v)) : 0)
  })
  return [{ t: out, fg: muted(v) }]
}

/** Linha dos agentes: rótulo (fase atual ou "Agentes") e cada agente com o seu glifo. */
function agentsLine(label: string, agents: WfAgent[], v: Vocab): Line {
  const line: Line = [{ t: label, bold: true }, { t: '  ' }]
  agents.forEach((a, i) => {
    if (i) line.push({ t: '  ' })
    const sv = stateView(a.state, v, 'dark')
    line.push({ t: `${sv.glyph} ${a.name}`, fg: sv.color })
  })
  return line
}

/** Um bloco por execução: nome · X/Y agentes, fases, contagens e fase atual. */
function runBlock(r: WfRun, v: Vocab): Line[] {
  const done = r.agents.filter(a => a.state === 'done').length
  const head: Line = [{ t: r.runId, bold: true }, { t: ` · ${done}/${r.agents.length} agentes`, fg: muted(v) }]
  const phases = phasesOf(r.agents)
  if (!phases) return [head, [{ t: PHASES_UNAVAILABLE, fg: muted(v) }], agentsLine('Agentes', r.agents, v)]
  const cur = phases.find(p => p.state !== 'done') ?? phases[phases.length - 1]!
  return [head, phaseLine(phases, v), countLine(phases, v), agentsLine(cur.name, cur.agents, v)]
}

/** Linhas da visão Workflow para o modo de cards compacto; sem execução, a mensagem de sempre. */
export function workflowView(agents: readonly WfAgent[], v: Vocab): Line[] {
  const runs = workflowRuns(agents)
  if (!runs.length) return [[{ t: NO_WORKFLOW, fg: muted(v) }]]
  return runs.flatMap((r, i) => (i ? [[], ...runBlock(r, v)] : runBlock(r, v)))
}

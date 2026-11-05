// T-009: detalhe de um agente na ordem do Padrão (spec/05-ui-design.md) e progresso honesto.
// Puro: texto de saída, sem engine, sem disco. Só campos mascarados entram no texto (maskText).
import { buildGraph, durationOf } from './run-model'
import type { AgentLike } from './office'
import { nodeView } from './vocabulary'
import { maskText } from './mask'

const BAR_CELLS = 10
const fmt = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`
}
const dash = (v: string | undefined): string => (v && v.length ? v : '—')

// Progresso só com total conhecido (`3/5 tarefas`). Sem total: só os segmentos feitos, sem %, sem previsão.
export function progressText(done: number, total: number | undefined): string {
  if (total === undefined || total <= 0) {
    return done > 0 ? `${'▰'.repeat(done)} · sem total conhecido` : 'sem total conhecido'
  }
  const filled = Math.min(BAR_CELLS, Math.max(0, Math.round((done / total) * BAR_CELLS)))
  return `${'▰'.repeat(filled)}${'▱'.repeat(BAR_CELLS - filled)} ${done}/${total} tarefas`
}

export type DetailScreen = { lines: string[]; back: boolean; warning?: string }

// Agente que sumiu da lista (saiu do limite, foi resetado): volta à lista com aviso, sem exceção.
export function detailScreen(agents: AgentLike[], id: string, now: number): DetailScreen {
  const a = agents.find(x => x.id === id)
  const g = a ? buildGraph(agents, now) : undefined
  const n = g?.nodes.get(id)
  if (!a || !g || !n) return { lines: [], back: true, warning: 'O agente saiu da lista; voltando à lista.' }

  const parent = g.nodes.get(n.parentId)
  const kids = n.children.filter(k => k.kind === 'agent')
  const trail = `Office › ${parent && parent.kind === 'agent' ? parent.name + ' › ' : ''}${n.name}`
  const persona = [n.persona, n.model, n.effort].filter(Boolean).join(' · ')
  const total = a.todos?.length ? a.todos.length : undefined
  const done = a.todos?.length
    ? a.todos.filter(t => t.status === 'completed').length
    : kids.filter(k => k.state === 'done').length

  const lines: string[] = [
    trail,
    `Estado: ${nodeView(n.state, { ascii: true, color: false }).label}`,
    `Progresso: ${progressText(done, total)}`,
    `Persona e modelo: ${dash(persona)}`,
    `Worktree: ${n.git?.worktree ? '⧉ ' + n.git.worktree : '—'}`,
    `Tempo: ${fmt(durationOf(n, now))}`,
    `Tokens: ${a.usage?.tokens !== undefined ? String(a.usage.tokens) : '—'}`,
    `Custo: —`,
    `Erro: ${n.error ? maskText(n.error) : '—'}`,
    '',
    'Linha do tempo',
  ]
  const steps = a.steps ?? []
  if (steps.length) {
    for (const s of steps) lines.push(`  ${s.tool} ${maskText(s.label)}${s.durationMs !== undefined ? ' ' + Math.round(s.durationMs / 1000) + 's' : ''}`)
  } else if (a.recent?.length) {
    for (const r of [...a.recent].reverse()) lines.push(`  ${maskText(r)}`)
  } else lines.push('  —')

  const blocked = n.dependsOn.map(d => g.nodes.get(d)).filter(x => x && x.state !== 'done')
  lines.push(
    '',
    'Dependências',
    `  Pai: ${parent && parent.kind === 'agent' ? parent.name : 'sessão'}`,
    `  Filhos: ${kids.length ? kids.map(k => k.name).join(', ') : '—'}`,
    `  Bloqueado por: ${blocked.length ? blocked.map(x => x!.name).join(', ') : '—'}`,
    '',
    'Prompt · segredos mascarados',
    a.prompt ? maskText(a.prompt) : '—',
    '',
    'b voltar',
  )
  return { lines, back: false }
}

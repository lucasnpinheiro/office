// Visão Worktrees (T-007, Rodada 5): um divisor de largura cheia por worktree/branch, com contagem, saúde
// (falhas, concluídos) e, só quando provado, `base <base> +N commits` (AC-023); abaixo, uma linha recuada com os
// agentes. Pure: a base e a contagem chegam prontas (`ahead`, por chave de grupo); sem elas a linha não aparece.
import type { Line } from './monitor'
import { WORKTREE_COLOR, STATE_COLOR, stateIcon, strWidth } from './monitor'
import type { AgentLike } from './office'
import type { AheadInfo } from './git'
import type { State } from './run-model'
import { worktreeFromPath } from './git'
import { maskText } from './mask'

const DIM = '#A9ADB5' // mesmo DIM de monitor.ts

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Raiz do worktree do agente: pelo cwd ou pelo primeiro arquivo tocado (AC-022: isolamento vindo da definição).
export const worktreeOfAgent = (a: AgentLike): string | undefined => worktreeFromPath(a.cwd ?? '') ?? worktreeFromPath(a.files?.[0] ?? '')

/** Estado do agente para glifo e cor (working → running, done, error → failed). */
export const stateOfAgent = (a: AgentLike): State => (a.status === 'error' ? 'failed' : a.status === 'done' ? 'done' : 'running')

export type WtGroup = { key: string; name: string; agents: AgentLike[]; failed: number; files: number; cwd?: string }

// Um grupo por worktree; agentes na branch principal entram por branch. Quem não tem git conhecido vai em `rest`
// (continua visível, sem divisor de worktree).
export function worktreePartition(agents: AgentLike[]): { groups: WtGroup[]; rest: AgentLike[] } {
  const by = new Map<string, WtGroup>()
  const rest: AgentLike[] = []
  for (const a of agents) {
    const wt = worktreeOfAgent(a)
    const key = wt ?? (a.git?.branch ? `branch:${a.git.branch}` : undefined)
    if (!key) { rest.push(a); continue }
    const name = a.git?.branch ?? key.split('/').pop() ?? key
    const g = by.get(key) ?? { key, name, agents: [], failed: 0, files: 0, cwd: wt ?? a.cwd }
    g.agents.push(a)
    by.set(key, g)
  }
  for (const g of by.values()) {
    g.failed = g.agents.filter(a => a.status === 'error').length
    g.files = new Set(g.agents.flatMap(a => a.files ?? [])).size
  }
  return { groups: [...by.values()], rest }
}

export const worktreeGroups = (agents: AgentLike[]): WtGroup[] => worktreePartition(agents).groups

/**
 * Divisor de um grupo em largura cheia: `━━ ⧉ nome · 2 agentes · 1 falha · base main +3 commits ━━━…` (ramo principal
 * usa ⎇). Falha/concluídos só aparecem quando > 0; base só com contagem finita (AC-023). ASCII: `== wt: nome … ==`.
 */
export function groupDivider(g: Pick<WtGroup, 'key' | 'name' | 'agents' | 'failed'>, ahead?: AheadInfo, o: { width?: number; ascii?: boolean } = {}): Line[] {
  const done = g.agents.filter(a => a.status === 'done').length
  const parts = [plural(g.agents.length, 'agente', 'agentes')]
  if (g.failed > 0) parts.push(plural(g.failed, 'falha', 'falhas'))
  if (done > 0) parts.push(`${done} concluído${done === 1 ? '' : 's'}`)
  if (g.agents.length > 0 && done === g.agents.length && g.failed === 0) parts.push('pronto')
  if (ahead && typeof ahead.ahead === 'number' && Number.isFinite(ahead.ahead) && ahead.base) parts.push(`base ${maskText(ahead.base)} +${ahead.ahead} commits`)
  const isBranch = g.key.startsWith('branch:')
  const name = maskText(g.name)
  const prefix = o.ascii ? (isBranch ? '== ' : '== wt: ') : `━━ ${isBranch ? '⎇' : '⧉'} `
  const body = `${prefix}${name} · ${parts.join(' · ')} `
  const fill = o.ascii ? '=' : '━'
  const n = o.width ? Math.max(2, o.width - strWidth(body)) : 2
  return [[{ t: body + fill.repeat(n), fg: WORKTREE_COLOR, bold: true }]]
}

/**
 * Linha recuada dos agentes de um grupo: `  ⠹ Nome  ✓ Nome  ✗ Nome`. Glifo e cor pelo estado; ASCII usa a
 * coluna ASCII de stateIcon.
 */
export function agentsLine(agents: AgentLike[], ascii = false): Line {
  const out: Line = [{ t: '  ' }]
  agents.forEach((a, i) => {
    const s = stateOfAgent(a)
    if (i) out.push({ t: '  ' })
    out.push({ t: `${stateIcon(s, { ascii, color: true }).trimEnd()} `, fg: STATE_COLOR[s] })
    out.push({ t: maskText(a.description ?? a.id) })
  })
  return out
}

export function restDivider(n: number): Line[] {
  return [[{ t: `━━ sem worktree conhecido · ${plural(n, 'agente', 'agentes')} ━━`, fg: DIM, bold: true }]]
}

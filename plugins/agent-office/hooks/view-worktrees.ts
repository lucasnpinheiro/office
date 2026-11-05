// Visão Worktrees (T-007): agentes agrupados por worktree sob um divisor com quantidade, falhas, arquivos e, só
// quando provado, `base <base> +N commits` (AC-023). Pure: a base e a contagem chegam prontas (`ahead`, por chave de
// grupo); sem elas a linha não aparece. A base é a real (upstream ou origin/HEAD), nunca o nome da própria branch.
import type { Line } from './monitor'
import type { AgentLike } from './office'
import type { AheadInfo } from './git'
import { worktreeFromPath } from './git'
import { maskText } from './mask'

const DIM = '#9ca3af'
const BRANCH = '#a855f7' // mesma cor da marca worktree (WORKTREE_COLOR)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Raiz do worktree do agente: pelo cwd ou pelo primeiro arquivo tocado (AC-022: isolamento vindo da definição).
export const worktreeOfAgent = (a: AgentLike): string | undefined => worktreeFromPath(a.cwd ?? '') ?? worktreeFromPath(a.files?.[0] ?? '')

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

// Divisor de um grupo (branch, caminho e base mascarados: vêm do agente e do disco) e, quando a contagem existe e é finita, `base <base> +N commits`.
export function groupDivider(g: Pick<WtGroup, 'name' | 'agents' | 'failed' | 'files'>, ahead?: AheadInfo): Line[] {
  const parts = [plural(g.agents.length, 'agente', 'agentes'), plural(g.failed, 'falha', 'falhas'), plural(g.files, 'arquivo', 'arquivos')]
  const out: Line[] = [[{ t: `━━ ⧉ ${maskText(g.name)} · ${parts.join(' · ')} ━━`, fg: BRANCH, bold: true }]]
  if (ahead && typeof ahead.ahead === 'number' && Number.isFinite(ahead.ahead) && ahead.base) out.push([{ t: `  base ${maskText(ahead.base)} +${ahead.ahead} commits`, fg: DIM }])
  return out
}

export function restDivider(n: number): Line[] {
  return [[{ t: `━━ sem worktree conhecido · ${plural(n, 'agente', 'agentes')} ━━`, fg: DIM, bold: true }]]
}

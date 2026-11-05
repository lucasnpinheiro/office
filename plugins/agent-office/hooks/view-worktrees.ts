// Visão Worktrees (T-007): agentes agrupados por branch sob um divisor com quantidade, falhas, arquivos e
// `base <branch> +N commits`. Pure: a contagem de commits chega pronta (`ahead`); sem ela a linha não aparece (AC-023).
import type { Line } from './monitor'
import type { AgentLike } from './office'
import { worktreeFromPath } from './git'

const DIM = '#9ca3af'
const BRANCH = '#a855f7' // mesma cor da marca worktree (WORKTREE_COLOR)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Raiz do worktree do agente: pelo cwd ou pelo primeiro arquivo tocado (AC-022: isolamento vindo da definição).
export const worktreeOfAgent = (a: AgentLike): string | undefined => worktreeFromPath(a.cwd ?? '') ?? worktreeFromPath(a.files?.[0] ?? '')

export type WtGroup = { key: string; name: string; agents: AgentLike[]; failed: number; files: number }

// Um grupo por worktree; agentes na branch principal (sem worktree) entram por branch. Sem git, o agente fica de fora.
export function worktreeGroups(agents: AgentLike[]): WtGroup[] {
  const by = new Map<string, WtGroup>()
  for (const a of agents) {
    const wt = worktreeOfAgent(a)
    const key = wt ?? (a.git?.branch ? `branch:${a.git.branch}` : undefined)
    if (!key) continue
    const name = a.git?.branch ?? key.split('/').pop() ?? key
    const g = by.get(key) ?? { key, name, agents: [], failed: 0, files: 0 }
    g.agents.push(a)
    by.set(key, g)
  }
  for (const g of by.values()) {
    g.failed = g.agents.filter(a => a.status === 'error').length
    g.files = new Set(g.agents.flatMap(a => a.files ?? [])).size
  }
  return [...by.values()]
}

// Linhas do modo agrupado: divisor por worktree e, quando a contagem existe e é finita, `base <branch> +N commits`.
export function worktreeLines(agents: AgentLike[], ahead?: Record<string, number>): Line[] {
  const out: Line[] = []
  for (const g of worktreeGroups(agents)) {
    const parts = [plural(g.agents.length, 'agente', 'agentes'), plural(g.failed, 'falha', 'falhas'), plural(g.files, 'arquivo', 'arquivos')]
    out.push([{ t: `━━ ⧉ ${g.name} · ${parts.join(' · ')} ━━`, fg: BRANCH, bold: true }])
    const n = ahead?.[g.name]
    if (typeof n === 'number' && Number.isFinite(n)) out.push([{ t: `  base ${g.name} +${n} commits`, fg: DIM }])
  }
  return out
}

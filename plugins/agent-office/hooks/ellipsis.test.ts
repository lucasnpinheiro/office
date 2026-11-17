import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { AgentLike } from './office'

const caps = detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' })
const T = 1_000_000
const mk = (n: number): AgentLike[] => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, description: `Implementar uma descricao bem longa do agente numero ${i} para estourar a largura`, status: 'working', startedAt: T, seenAt: T + 5000, cwd: '/repo/.claude/worktrees/feature-um-nome-bem-longo', git: { branch: 'feat/branch-muito-longa', worktree: '/repo/.claude/worktrees/feature-um-nome-bem-longo' } } as AgentLike))
const text = (mode: string, width: number, n = 4) => renderCompact(mk(n), T + 6000, { width, caps, mode, query: '', expanded: new Set(), maxCardRows: 4, sort: 'time', filter: 'all' } as any).map(l => l.map(x => x.t).join(''))

test('T-606 no line is wider than the pane and a cut line ends with …', () => {
  for (const mode of ['map', 'tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow']) for (const w of [60, 80, 120]) {
    for (const row of text(mode, w)) expect([...row].length).toBeLessThanOrEqual(w)
  }
  const wt = text('grouped', 80).find(r => r.includes('Implementar'))!
  expect(wt.endsWith('…')).toBe(true)
  const legend = text('map', 80).find(r => r.includes('barramento'))!
  expect(legend.endsWith('…')).toBe(true)
})

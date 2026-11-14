import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, CARD_W } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'
import { appMap } from './app-cards'

// Spec .specs/features/office-org-tree-2d: depth 1 = one horizontal row under the Orquestrador; depth >= 2 = stacked
// vertically in the parent's own column (reference screenshot 2026-11-14 13.24.21).
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const rows = (ag: AgentLike[], width = 200) => renderCompact(ag, T + 5000, { width, caps, mode: 'cards', query: '', expanded: new Set<string>(), maxCardRows: 999 }).map(l => l.map(s => s.t).join(''))
const tops = (l: string) => [...l].flatMap((ch, i, a) => (ch === '╭' && /[─┴]/.test(a[i + 1] ?? '') ? [strWidth(a.slice(0, i).join(''))] : []))
const tree = [mk('a'), mk('b'), mk('c'), mk('d'), mk('t1', { parentAgentId: 'g-a' }), mk('t2', { parentAgentId: 'g-a' }), mk('n1', { parentAgentId: 'g-b' })]

test('terminal: the 4 agents share one row, the subagents stack under their own parent column', () => {
  const t = rows(tree)
  const cardRows = t.map(tops).filter(x => x.length)
  expect(cardRows.map(r => r.length)).toEqual([1, 4, 2, 1]) // root, agents, t1+n1, t2 (never t1 beside t2)
  const [ag, l2, l3] = [cardRows[1]!, cardRows[2]!, cardRows[3]!]
  expect(l2).toEqual([ag[0]!, ag[1]!]) // t1 straight under a, n1 straight under b
  expect(l3).toEqual([l2[0]!]) // t2 in the same column as t1
  for (const id of ['a', 'b', 'c', 'd', 't1', 't2', 'n1']) expect(t.join('\n')).toContain(`Dev: ${id}`)
})

test('terminal: a single subagent hangs straight under its parent, bottom ┬ and top ┴ in the same column', () => {
  const t = rows([mk('a'), mk('b'), mk('s', { parentAgentId: 'g-a' })])
  const y = t.findIndex(l => tops(l).length === 1 && t.indexOf(l) > 3 && l.includes('┴') && !t.slice(0, t.indexOf(l)).every(x => tops(x).length < 2))
  const above = t.slice(0, y).reverse().find(l => l.includes('┬'))!
  const ub = [...above].findIndex(ch => ch === '┬'), dt = [...t[y]!].findIndex(ch => ch === '┴')
  expect(strWidth([...t[y]!].slice(0, dt).join(''))).toBe(strWidth([...above].slice(0, ub).join('')))
  expect(t[y - 1]!.trim()).toBe('┊')
})

test('terminal: a narrow pane keeps every card (wraps, never drops)', () => {
  const t = rows(tree, CARD_W * 2 + 10).join('\n')
  for (const id of ['a', 'b', 'c', 'd', 't1', 't2', 'n1']) expect(t).toContain(`Dev: ${id}`)
})

test('orchestrator card: 🧭 Squad Leader · Opus · baixo (design), never 🎯 Orquestrador', () => {
  const t = rows([mk('a'), mk('b')]).join('\n')
  expect(t).toMatch(/🧭 Squad Leader · .*Opus/); expect(t).not.toContain('🎯')
  expect(appMap([], T, {}).card.chips).toEqual(['🧭 Squad Leader', '👑 Opus', '🟢 baixo'])
})

test('app: depth 1 lays out in a row, depth >= 2 in a column; the Orquestrador box is always the root', () => {
  const m = appMap(tree, T + 5000, {})
  expect(m.card.title).toBe('Orquestrador'); expect(m.layout).toBe('row')
  const a = m.children.find(n => n.card.id === 'a')!
  expect(a.layout).toBe('column'); expect(a.children.map(n => n.card.id)).toEqual(['t1', 't2'])
  expect(appMap([mk('solo')], T + 5000, {}).card.title).toBe('Orquestrador')
})


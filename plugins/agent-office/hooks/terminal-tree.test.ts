import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'

// Spec .specs/features/office-map-mock-style T-001: rows of 6 under every parent, width per parent, depth 10.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const rows = (ag: AgentLike[], width = 200) => renderCompact(ag, T + 5000, { width, caps, mode: 'cards', query: '', expanded: new Set<string>(), maxCardRows: 9999 }).map(l => l.map(s => s.t).join(''))
// card tops: x of each ╭ followed by ─ or ┴ and the card width
const tops = (l: string) => [...l.matchAll(/╭[─┴]+╮/g)].map(m => ({ x: strWidth(l.slice(0, m.index)), w: strWidth(m[0]) }))
const kids = (p: string, n: number, pre = 'k') => Array.from({ length: n }, (_, i) => mk(`${pre}${i}`, { parentAgentId: `g-${p}` }))

test('U-001 7 root children: rows [6,1], 7th opens row 2', () => {
  const t = rows(Array.from({ length: 7 }, (_, i) => mk(`a${i}`)), 200).map(tops).filter(x => x.length)
  expect(t.map(r => r.length)).toEqual([1, 6, 1])
})
test('U-002 grandchildren also partition [6,2] under their parent', () => {
  const t = rows([mk('a'), ...kids('a', 8)], 240).map(tops).filter(x => x.length)
  expect(t.map(r => r.length)).toEqual([1, 1, 6, 2])
})
test('U-003 one child hangs straight (single vertical, no double bus)', () => {
  const t = rows([mk('a'), mk('s', { parentAgentId: 'g-a' })]).join('\n')
  expect(t).not.toMatch(/[╭╮]┄/)
  expect(t).toContain('Dev: s')
})
test('U-004 width dynamic between 18 and 34', () => {
  const w = (cols: number, n: number) => rows(Array.from({ length: n }, (_, i) => mk(`a${i}`)), cols).map(tops).filter(r => r.length > 1)[0]
  expect(w(200, 3)![0]!.w).toBe(34)
  expect(w(130, 6)).toHaveLength(6); expect(w(130, 6)![0]!.w).toBe(20)
  expect(w(100, 6)).toHaveLength(5); expect(w(100, 6)![0]!.w).toBe(18) // below 18 only the columns shrink
})
test('U-005 avail below 18: 1 column, nothing dropped, no row wider than the pane', () => {
  const ag = [mk('a'), ...kids('a', 3), ...kids('k0', 3, 'z')]
  const t = rows(ag, 60)
  for (const id of ['a', 'k0', 'k1', 'k2', 'z0', 'z1', 'z2']) expect(t.join('\n')).toContain(`Dev: ${id}`)
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(60)
})
test('U-006 chain of 12 levels: 10 drawn, level 10 shows +N ocultos', () => {
  const ag = Array.from({ length: 12 }, (_, i) => mk(`c${i}`, i ? { parentAgentId: `g-c${i - 1}` } : {}))
  const t = rows(ag, 80).join('\n')
  expect(t).toContain('Dev: c9'); expect(t).not.toContain('Dev: c11')
  expect(t).toMatch(/\+\d+ ocultos/)
})
test('U-008 grandchild sits under its parent: no side trunk', () => {
  const t = rows([mk('a'), mk('b'), mk('c'), mk('s', { parentAgentId: 'g-a' })])
  expect(t.join('\n')).not.toMatch(/├/)
  const y = t.findIndex(l => l.trim() === '┊' && !l.includes('┬')), up = t[y - 1]!
  expect(t[y]!.indexOf('┊')).toBe(up.indexOf('┬')) // the drop is in the parent's own column
})

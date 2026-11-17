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
const rows = (ag: AgentLike[], width = 200) => renderCompact(ag, T + 5000, { width, caps, mode: 'map', query: '', expanded: new Set<string>(), maxCardRows: 999 }).map(l => l.map(s => s.t).join(''))
const tops = (l: string) => [...l].flatMap((ch, i, a) => (ch === '╭' && /[─┴]/.test(a[i + 1] ?? '') ? [strWidth(a.slice(0, i).join(''))] : []))
const tree = [mk('a'), mk('b'), mk('c'), mk('d'), mk('t1', { parentAgentId: 'g-a' }), mk('t2', { parentAgentId: 'g-a' }), mk('n1', { parentAgentId: 'g-b' })]

test('terminal: the 4 agents share one row, a parent\'s subagents share one row under it (T-001 U-002)', () => {
  const t = rows(tree)
  const cardRows = t.map(tops).filter(x => x.length)
  expect(cardRows.map(r => r.length)).toEqual([1, 4, 3]) // root, agents, then t1+t2 (under a) and n1 (under b) side by side
  expect(cardRows[2]!.length).toBe(3)
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
  expect(t.match(/Dev: /g)?.length).toBe(7) // T-004: narrow titles cut to Dev: …
})

test('orchestrator card: 🧭 Squad Leader · Opus · baixo (design), never 🎯 Orquestrador', () => {
  const t = rows([mk('a'), mk('b')]).join('\n')
  expect(t).toMatch(/🧭 Squad Leader · .*Opus/); expect(t).not.toContain('🎯')
  expect(appMap([], T, {}).card.chips).toEqual(['🧭 Squad Leader', '👑 Opus', '🟢 baixo'])
})

test('app: every parent partitions its children; the session is the root (Claude Code over several top agents, Orquestrador over one)', () => {
  const m = appMap(tree, T + 5000, {})
  expect(m.card.title).toBe('Claude Code')
  const a = m.children.find(n => n.card.id === 'a')!
  expect(a.children.map(n => n.card.id)).toEqual(['t1', 't2'])
  expect(appMap([mk('solo')], T + 5000, {}).card.title).toBe('Orquestrador')
})


// 0.28.7: the 4 remaining gaps vs the reference image
const ascii = detectCaps({ OFFICE_ASCII: '1', LANG: 'en_US.UTF-8' })
const at = (ag: AgentLike[], o: object = {}) => renderCompact(ag, T + 5000, { width: 200, caps, mode: 'map', query: '', expanded: new Set<string>(), maxCardRows: 999, ...o }).map(l => l.map(s => s.t).join(''))

test('gap 1: a long branch wraps onto a second row (role on the first), then …', () => {
  const t = at([mk('a', { git: { branch: 'spec/checkout-api-muito-longa-de-verdade-mesmo-sim-e-ainda-mais-longa', worktree: '/w/x' } })])
  const i = t.findIndex(l => l.includes('⧉ spec/checkout-api'))
  expect(i).toBeGreaterThan(0)
  expect(t[i]).toMatch(/agente\s*│/)
  expect(t[i + 1]).toMatch(/│\S+/) // continuation row
  expect(t[i + 1]).toContain('…')
})

test('gap 2: card height follows content: short chips and no branch = no blank row', () => {
  const t = at([mk('a')])
  expect(t.some(l => /^\s*│\s+│\s*$/.test(l))).toBe(false)
})

test('gap 2: siblings of different heights keep connectors meeting and all cards', () => {
  const ag = [mk('a', { git: { branch: 'spec/checkout-api-muito-longa-de-verdade', worktree: '/w/x' } }), mk('b'), mk('s', { parentAgentId: 'g-b' })]
  const t = at(ag)
  for (const id of ['a', 'b', 's']) expect(t.join('\n')).toContain(`Dev: ${id}`)
  const y = t.findIndex(l => l.includes('Dev: s'))
  expect(t[y - 1]).toMatch(/┴/)
  expect(t[y - 2]).toMatch(/┊\s*$/) // the taller sibling may still be drawn beside it
})

test('gap 3: orchestrator shows ⎇ branch from the session git', () => {
  const t = at([mk('a')], { branch: 'main' })
  const root = t.findIndex(l => l.includes('orquestrador'))
  expect(t[root]).toMatch(/⎇ main\s+orquestrador/)
})

test('gap 4: progress bar is segmented even without step data (done = green gaps)', () => {
  const t = at([mk('a', { status: 'done', endedAt: T + 3000 } as Partial<AgentLike>)])
  const bar = t.find(l => /━/.test(l) && l.includes('Dev') === false && !l.includes('Orquestrador'))
  expect(t.some(l => /│━+ ━+/.test(l))).toBe(true)
  expect(bar).toBeDefined()
  const a = at([mk('a')], { caps: ascii })
  expect(a.some(l => /\|=+ [=-]+/.test(l) || /\|[-]+ [-]+/.test(l))).toBe(true)
})

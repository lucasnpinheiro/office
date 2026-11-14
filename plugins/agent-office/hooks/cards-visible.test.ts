import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, scrollInfo } from './compact'
import { strWidth } from './monitor'
import { buildGraph, durationOf, elapsedOf } from './run-model'
import type { AgentLike } from './office'

// B1-B5 (spec .specs/features/office-cards-always-visible): every card visible, whole, at any pane height and width
const T = 1_000_000
const mk = (id: string, o: object = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const lines = (ag: AgentLike[], o: object = {}, now = T + 5000) => renderCompact(ag, now, { ...base, ...o }).map(l => l.map(s => s.t).join(''))
const kids = (n: number) => Array.from({ length: n }, (_, i) => mk(`c${i}`))

test('B1 19 children in a 130-row pane: all visible without scroll (denser cards), footer on the last row', () => {
  const ag = kids(19)
  const t = lines(ag, { maxLines: 130 })
  for (let i = 0; i < 19; i++) expect(t.join('\n')).toContain(`Dev: c${i}`)
  expect(scrollInfo.max).toBe(0)
  expect(t.join('\n')).not.toMatch(/[↑↓]/)
  expect(t.length).toBe(130)
})

test('B1 pane too short for every card: scrolls in whole cards, no card cut mid-way at any step', () => {
  const ag = kids(19)
  lines(ag, { maxLines: 40 })
  expect(scrollInfo.max).toBeGreaterThan(0)
  for (let scroll = 0; scroll <= scrollInfo.max; scroll += 7) { // 7 rows: lands mid-card too
    const t = lines(ag, { maxLines: 40, scroll }).join('\n')
    const names = [...t.matchAll(/Dev: c\d+/g)].length
    const status = [...t.matchAll(/executando/g)].length
    expect(status).toBe(names) // every visible title has its status row: no card is cut
  }
})

// 0.28.10 (user): Concluído cards leave the panel 30 s after they end; Falhou and Precisa de você stay; a parent stays while a child shows.
test('B2 done cards disappear 30 s after they end (cards and tree), the header still counts them', () => {
  const ag = [mk('a', { status: 'done', endedAt: T + 1000 })]
  for (const mode of ['cards', 'tree'] as const) {
    expect(lines(ag, { mode }, T + 1000 + 29_000).join('\n')).toContain('Dev: a')
    const gone = lines(ag, { mode }, T + 1000 + 31_000).join('\n')
    expect(gone).not.toContain('Dev: a')
    expect(gone).toContain('1 concluído')
  }
})

test('B2 failed cards are never auto-removed', () => {
  const ag = [mk('f', { status: 'failed', endedAt: T + 1000 })]
  for (const mode of ['cards', 'tree'] as const) expect(lines(ag, { mode }, T + 3_600_000).join('\n')).toContain('Dev: f')
})

test('B2 a done parent with a live child stays; once the subtree is done it leaves 30 s after the last child ended', () => {
  const parent = mk('p', { status: 'done', endedAt: T + 1000 })
  const live = mk('k', { parentAgentId: 'g-p' })
  expect(lines([parent, live], { mode: 'cards' }, T + 100_000).join('\n')).toContain('Dev: p')
  const kDone = mk('k', { parentAgentId: 'g-p', status: 'done', endedAt: T + 50_000 })
  expect(lines([parent, kDone], { mode: 'cards' }, T + 70_000).join('\n')).toContain('Dev: p') // child ended 20 s ago
  expect(lines([parent, kDone], { mode: 'cards' }, T + 81_000).join('\n')).not.toContain('Dev: p') // 31 s
})

test('B5 orchestrator card is Concluído when every agent is done, and its time matches the header elapsed', () => {
  const done = Array.from({ length: 2 }, (_, i) => mk(`d${i}`, { status: 'done', endedAt: T + 11_000 }))
  const now = T + 16_000
  const g = buildGraph(done, now)
  expect(g.root.state).toBe('done')
  expect(durationOf(g.root, now)).toBe(elapsedOf(g, now))
  const t = lines(done, {}, now)
  const card = t.find(l => l.includes('Claude Code') && !l.includes('🧭'))!
  expect(card).toContain('Concluído')
  expect(card).not.toContain('Rodando')
  expect(t.join('\n')).toContain('0 rodando')
})

test('B4 a long branch wraps to a second row (design), the role stays on the first; past 2 rows it ends in …', () => {
  const ag = [mk('b0', { git: { branch: 'spec/andamento-2026-11-14-long-branch-name' } } as object)]
  const t = lines(ag, { width: 120 }), i = t.findIndex(l => l.includes(' agente'))
  expect(t[i]).toMatch(/⎇ spec\/andamento-2026-11-\s+agente│/)
  expect(t[i + 1]).toMatch(/│14-long-branch-name\s*│/)
  const t2 = lines([mk('b1', { git: { branch: 'spec/' + 'x'.repeat(80) } } as object)], { width: 120 }), j = t2.findIndex(l => l.includes(' agente'))
  expect(t2[j + 1]).toMatch(/…│/)
})

test('R2 a deep card at a narrow pane keeps its right border: nothing clipped by the pane edge', () => {
  const chain = Array.from({ length: 45 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const t = lines(chain, { width: 64, maxLines: 2000 })
  const row = t.find(l => l.includes('Dev: d44'))!
  expect(row).toBeDefined()
  expect(strWidth(row)).toBeLessThanOrEqual(64)
  expect(row.trimEnd().endsWith('│')).toBe(true)
})

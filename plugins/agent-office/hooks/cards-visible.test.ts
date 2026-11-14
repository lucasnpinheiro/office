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

test('B2 tree view: a finished agent older than 30 s stays visible, like in the cards view', () => {
  const old = Array.from({ length: 3 }, (_, i) => mk(`o${i}`, { status: 'done', endedAt: T + 1000 }))
  const t = lines(old, { mode: 'tree' }, T + 3_600_000).join('\n')
  for (let i = 0; i < 3; i++) expect(t).toContain(`Dev: o${i}`)
})

test('B5 orchestrator card is Concluído when every agent is done, and its time matches the header elapsed', () => {
  const done = Array.from({ length: 2 }, (_, i) => mk(`d${i}`, { status: 'done', endedAt: T + 11_000 }))
  const now = T + 16_000
  const g = buildGraph(done, now)
  expect(g.root.state).toBe('done')
  expect(durationOf(g.root, now)).toBe(elapsedOf(g, now))
  const t = lines(done, {}, now)
  const card = t.find(l => l.includes('Claude Code'))!
  expect(card).toContain('Concluído')
  expect(card).not.toContain('Rodando')
  expect(t.join('\n')).toContain('0 rodando')
})

test('B4 a branch cut by the card width ends in an ellipsis, with a gap before the role', () => {
  const ag = [mk('b0', { git: { branch: 'spec/andamento-2026-11-14-long-branch-name' } } as object)]
  const row = lines(ag, { width: 120 }).find(l => l.includes('agente L1'))!
  expect(row).toMatch(/…\s+agente L1/)
})

test('R2 a deep card at a narrow pane keeps its right border: nothing clipped by the pane edge', () => {
  const chain = Array.from({ length: 45 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const t = lines(chain, { width: 64, maxLines: 2000 })
  const row = t.find(l => l.includes('Dev: d44'))!
  expect(row).toBeDefined()
  expect(strWidth(row)).toBeLessThanOrEqual(64)
  expect(row.trimEnd().endsWith('│')).toBe(true)
})

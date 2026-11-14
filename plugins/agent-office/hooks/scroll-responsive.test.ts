import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import { strWidth } from './monitor'
import { paneBodyLines } from './office'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const rows = (ag: AgentLike[], o: object = {}) => renderCompact(ag, T + 5000, { ...base, ...o }).map(l => l.map(s => s.t).join(''))
const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))

test('pane height follows the terminal rows, not a 30-row cap', () => {
  expect(paneBodyLines({ bodyRows: 60 }, { rows: 40 })).toBe(51)
  expect(paneBodyLines(undefined, { rows: 80 })).toBe(71)
  expect(paneBodyLines(undefined, undefined)).toBeGreaterThan(0)
})

test('overflowing cards draw a scrollbar: track and thumb on the last column, width never exceeded', () => {
  const t = rows(many, { maxLines: 30 })
  const last = t.filter(l => /[█░]$/.test(l))
  expect(last.length).toBeGreaterThan(5)
  expect(last.join('')).toContain('█')
  expect(last.join('')).toContain('░')
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(120)
})

test('thumb moves down when scrolling', () => {
  const pos = (scroll: number) => rows(many, { maxLines: 30, scroll }).findIndex(l => l.endsWith('█'))
  expect(pos(64)).toBeGreaterThan(pos(0))
})

test('no scrollbar when everything fits; a stale scroll offset is clamped after a resize', () => {
  const t = rows(many.slice(0, 2), { maxLines: 200, scroll: 80 })
  expect(t.some(l => /[█░]$/.test(l))).toBe(false)
  expect(t.join('\n')).not.toContain('mais cards')
  expect(t.join('\n')).toContain('Dev: n0')
})

test('narrow pane wraps cards to fewer columns and stays inside the width', () => {
  for (const width of [60, 75, 100]) for (const l of rows(many.slice(0, 6), { width, maxLines: 40 })) expect(strWidth(l)).toBeLessThanOrEqual(width)
})

test('tabs scroll horizontally on a narrow pane and keep the active one visible', () => {
  const wf = { ...mk('w'), workflow: { runId: 'r1', agentIndex: 0 } } as unknown as AgentLike
  const t = rows([wf], { width: 60, mode: 'tools' })
  const tabs = t.find(l => l.includes('Ferramentas'))!
  expect(tabs).toContain('‹')
  expect(strWidth(tabs)).toBeLessThanOrEqual(60)
})

test('50 sub-levels: every card reachable by scrolling, none hidden, L badge and n/total shown', () => {
  const chain = Array.from({ length: 50 }, (_, i) => ({ ...mk(`d${i}`), ...(i ? { parentAgentId: `g-d${i - 1}` } : {}) }) as AgentLike)
  const seen = new Set<string>()
  for (let scroll = 0; scroll <= 420; scroll += 96) {
    const t = rows(chain, { maxLines: 130, scroll }).join('\n')
    for (const m of t.matchAll(/Dev: d\d+/g)) seen.add(m[0])
    expect(t).toMatch(/\d+\/\d+/)
  }
  expect(seen.size).toBe(50)
  expect(rows(chain, { maxLines: 500 }).join('\n')).toContain('L49')
})

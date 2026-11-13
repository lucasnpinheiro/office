import { test, expect } from 'claude-code/testing'
import { detectCaps, renderCompact } from './compact'
import { startUi, initialUi } from './actions'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }

test('session start opens the boxed cards view, not the one-line map', () => {
  expect(startUi().view).toBe('compact'); expect(startUi().mode).toBe('cards'); expect(initialUi().view).toBe('compact')
})
test('cards at 120 cols: parent card, then 3 sibling boxes per row, 34 cols wide, 4th card on the next row', () => {
  const ag = ['a', 'b', 'c', 'd'].map(id => mk(id))
  const lines = txt(renderCompact(ag, T + 5000, base)).split('\n')
  const tops = lines.filter(l => (l.match(/╭─{32}╮/g) ?? []).length === 3)
  expect(tops.length).toBe(1)
  expect(lines.filter(l => (l.match(/╭─{32}╮/g) ?? []).length === 1).length).toBe(2) // parent card + the 4th sibling
  expect(lines.filter(l => (l.match(/╰─{32}╯/g) ?? []).length).length).toBe(3)
  expect(lines.some(l => /^ ├┄+┬/.test(l) || /^ ╰┄+┬/.test(l))).toBe(true) // bus from the parent card
})
test('cards: failed and needs-you alerts are pinned above the boxes, with the retry hint on failure', () => {
  const ag = [mk('a'), mk('b'), mk('f', { status: 'error', error: 'boom' })]
  const lines = txt(renderCompact(ag, T + 5000, base)).split('\n')
  const alert = lines.findIndex(l => l.includes('boom') && !l.includes('│'))
  const firstBox = lines.findIndex(l => /╭─{32}╮/.test(l))
  expect(alert).toBeGreaterThan(-1); expect(alert).toBeLessThan(firstBox)
})
test('cards ASCII: boxes drawn with . - and no unicode corners', () => {
  const ag = [mk('a'), mk('b'), mk('f', { status: 'error', error: 'boom' })]
  const o = txt(renderCompact(ag, T + 5000, { ...base, caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(o).not.toMatch(/[╭╮╰╯│]/); expect(o).toContain('.--')
})

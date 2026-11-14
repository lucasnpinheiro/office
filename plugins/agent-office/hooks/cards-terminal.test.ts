import { test, expect } from 'claude-code/testing'
import { detectCaps, renderCompact } from './compact'
import { startUi, initialUi } from './actions'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }

test('session start opens the map; cards stay the default mode behind v', () => {
  expect(startUi().view).toBe('map'); expect(startUi().mode).toBe('cards'); expect(initialUi().view).toBe('map')
})
test('cards at 120 cols: parent card, then 3 sibling boxes per row, 34 cols wide, 4th card on the next row', () => {
  const ag = ['a', 'b', 'c', 'd'].map(id => mk(id))
  const lines = txt(renderCompact(ag, T + 5000, base)).split('\n')
  const tops = lines.filter(l => (l.match(/╭[─┴]{32}╮/g) ?? []).length === 3)
  expect(tops.length).toBe(1)
  expect(lines.filter(l => (l.match(/╭[─┴]{32}╮/g) ?? []).length === 1).length).toBe(2) // parent card + the 4th sibling
  expect(lines.filter(l => (l.match(/╰─[^╰╭]{31}╯/g) ?? []).length).length).toBe(3)
  expect(lines.some(l => /^ *[╭╰]┄+/.test(l))).toBe(true) // bus from the parent card
})
test('cards: a failure is a boxed banner above the tabs and the cards, with [Ver] to open it', () => {
  const ag = [mk('a'), mk('b'), mk('f', { status: 'error', error: 'boom' })]
  const out = renderCompact(ag, T + 5000, base)
  const lines = txt(out).split('\n')
  const alert = lines.findIndex(l => /^│✗ Dev: f falhou  boom +.*\[Ver\]│$/.test(l))
  const tabs = lines.findIndex(l => l.includes('Árvore') && l.includes('Mapa'))
  const firstBox = lines.findIndex(l => /^ *╭─{32}╮/.test(l) && !l.startsWith('╭'))
  expect(alert).toBeGreaterThan(-1); expect(alert).toBeLessThan(tabs); expect(tabs).toBeLessThan(firstBox)
  expect(out.flat().some(x => x.t === '[Ver]' && x.node === 'f')).toBe(true)
  // more than two alerts: two boxes, the rest on one line
  const many = txt(renderCompact([0, 1, 2, 3].map(i => mk('e' + i, { status: 'error', error: 'x' })), T + 5000, base))
  expect((many.match(/falhou/g) ?? []).length).toBe(2); expect(many).toContain('+2 outros alertas')
})
test('cards ASCII: boxes drawn with . - and no unicode corners', () => {
  const ag = [mk('a'), mk('b'), mk('f', { status: 'error', error: 'boom' })]
  const o = txt(renderCompact(ag, T + 5000, { ...base, caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(o).not.toMatch(/[╭╮╰╯│]/); expect(o).toContain('.--')
})

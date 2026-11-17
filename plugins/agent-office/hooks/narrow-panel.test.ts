import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { CView } from './compact'
import { paneBodyLines } from './office'
import type { AgentLike } from './office'

// Real sizes seen in a live Claude Code session (PTY): 120x40 gives the side panel 53 columns; 80x24 gives a short bottom panel.
const T = 1_000_000
const mk = (id: string): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'done', startedAt: T, endedAt: T + 5_000, seenAt: T + 5_000 })
const six = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map(mk)
const NOW = T + 8_000
const view = (over: Partial<CView>): CView => ({ width: 53, caps: detectCaps({ LANG: 'pt_BR.UTF-8', COLORTERM: 'truecolor' }), mode: 'cards', query: '', expanded: new Set<string>(), maxCardRows: 4, ...over })
const frame = (v: CView) => renderCompact(six, NOW, v).map(l => l.map(s => s.t).join(''))

test('53-column side panel (120x40): cards mode draws bordered boxes, not one line per agent', () => {
  const f = frame(view({ width: 53, maxLines: 34 }))
  expect(f.some(l => /^╭─+╮/.test(l))).toBe(true)
  expect(f.some(l => /^ *├─|^ *└─/.test(l))).toBe(false)
  expect(f.filter(l => l.includes('╭')).length).toBeGreaterThanOrEqual(3) // 34-wide cards: one per row at 53, the rest scroll
  expect(Math.max(...f.map(l => [...l].length))).toBeLessThanOrEqual(53)
})
test('53-column side panel: map mode draws boxes too', () => {
  const f = frame(view({ width: 53, mode: 'map', maxLines: 34 }))
  expect(f.some(l => l.includes('╭'))).toBe(true)
  expect(f.some(l => /^ *├─✓|^ *└─✓/.test(l))).toBe(false)
})
test('below 36 columns only the list stays', () => {
  const f = frame(view({ width: 35, maxLines: 34 }))
  expect(f.some(l => l.includes('╭'))).toBe(false)
  expect(f.some(l => l.includes('A1'))).toBe(true)
})
test('short bottom panel (80x24, ~8 rows): header is one line, so the first card starts on row 3', () => {
  const f = frame(view({ width: 78, maxLines: 8 }))
  const tabs = f.findIndex(l => l.includes('Árvore') && l.includes('Mapa'))
  expect(tabs).toBe(1) // title+counts on row 0, tabs on row 1
  expect(f[2]!.includes('╭')).toBe(true)
})
test('tall panel keeps the full 4-line header', () => {
  const f = frame(view({ width: 120, maxLines: 40 }))
  expect(f.findIndex(l => l.includes('Árvore') && l.includes('Mapa'))).toBeGreaterThanOrEqual(3)
})
test('paneBodyLines: the rows the host really shows (scroll.bodyRows) win over the terminal rows', () => {
  expect(paneBodyLines({ scroll: { bodyRows: 6 } }, { rows: 24 })).toBe(6)
  expect(paneBodyLines({ bodyRows: 9, scroll: { bodyRows: 6 } }, { rows: 24 })).toBe(9)
  expect(paneBodyLines(undefined, { rows: 24 })).toBe(24)
})

// 80x24 real frame: the host gives the inline pane 6 body rows. A full 8-row card never fit; a short pane gets a 4-row card.
const withModel = (id: string): AgentLike => ({ ...mk(id), model: 'haiku' })
const shortFrame = (mode: 'cards' | 'map', maxLines: number) =>
  renderCompact(['A1', 'A2'].map(withModel), NOW, view({ width: 78, mode, maxLines })).map(l => l.map(s => s.t).join('')).slice(0, maxLines)
for (const mode of ['cards', 'map'] as const) {
  test(`short pane (6 body rows), ${mode}: one whole bordered card with name, status and model fits`, () => {
    const f = shortFrame(mode, 6)
    const top = f.findIndex(l => l.includes('╭')), bot = f.findIndex((l, i) => i > top && l.includes('╰'))
    expect(f.join('\n')).toContain('╰')
    expect(top).toBeGreaterThanOrEqual(0)
    expect(bot).toBeGreaterThan(top) // the bottom border is inside the 6 rows
    const box = f.slice(top, bot + 1).join('\n')
    expect(box).toMatch(/A1|Claude Code/); expect(box).toMatch(/Concluído/); expect(box).toMatch(/Haiku|Opus/) // map starts on the root card
  })
}
test('a pane taller than 8 rows keeps the full card (more than the 4-row short card)', () => {
  const f = renderCompact([withModel('A1')], NOW, view({ width: 78, mode: 'cards', maxLines: 30 })).map(l => l.map(s => s.t).join(''))
  const top = f.findIndex(l => l.includes('╭')), bot = f.findIndex((l, i) => i > top && l.includes('╰'))
  expect(bot - top + 1).toBeGreaterThanOrEqual(6)
})

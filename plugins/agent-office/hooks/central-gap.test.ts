import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'

// User decision 2026-11-15: when a parent's children span 2+ rows, every full row leaves a free central gap;
// the parent's vertical descends from its bottom centre through the gaps to the next row's bus, never crossing a card.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const rows = (ag: AgentLike[], width = 200) => renderCompact(ag, T + 5000, { width, caps, mode: 'cards', query: '', expanded: new Set<string>(), maxCardRows: 9999 }).map(l => l.map(s => s.t).join(''))
const kids = (p: string, n: number) => Array.from({ length: n }, (_, i) => mk(`k${i}`, { parentAgentId: `g-${p}` }))
const col = (l: string, x: number) => [...l].reduce((a, ch) => (a.w < x ? { w: a.w + strWidth(ch), c: ch } : a), { w: 0, c: ' ' }).c
const cells = (l: string) => { const o: string[] = []; for (const ch of l) { o.push(ch); for (let i = 1; i < strWidth(ch); i++) o.push('') } return o }

for (const n of [7, 8]) {
  test(`gap: ${n} children at 120 cols, vertical in the central gap, no card border there`, () => {
    const t = rows([mk('a'), ...kids('a', n)], 120)
    const y1 = t.findIndex(l => l.includes('┼')) // row 1 bus: the parent's line crosses it
    const px = cells(t[y1]!).findIndex(ch => ch === '┼')
    const y2 = t.findIndex((l, i) => i > y1 && (l.match(/╭/g) ?? []).length <= 2 && /╭.*┴/.test(l)) // top of row 2's cards
    expect(y1).toBeGreaterThan(0); expect(y2).toBeGreaterThan(y1 + 8)
    for (let y = y1 + 1; y < y2 - 1; y++) expect(cells(t[y]!)[px]).toBe('┊') // straight vertical in the gap on every row of row 1, never a card border
    expect(cells(t[y2 - 1]!)[px]).toMatch(/[┊┴┬┼]/) // lands on row 2's bus
    for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(120)
  })
}

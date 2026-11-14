import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, CARD_W } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'

// Centered card tree (user decision 2026-11-13: "TELA 8 centralizada"): the parent card sits centred over its children,
// the whole block is centred in the pane, roles and worktrees ride on the bottom border, the bus is animated.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const rows = (ag: AgentLike[], o: object = {}) => renderCompact(ag, T + 5000, { ...base, ...o }).map(l => l.map(s => s.t).join(''))
const lead = (l: string) => strWidth(l.slice(0, l.search(/\S/)))
const tree = [mk('a'), mk('b'), mk('c'), mk('s', { parentAgentId: 'g-b' })]

test('centred: the parent card is centred over its children and the block is centred in the pane', () => {
  const t = rows(tree)
  const tops = t.filter(l => /╭[─┴]{32}╮/.test(l) && !l.startsWith('╭'))
  const kidsRow = tops.find(l => (l.match(/╭/g) ?? []).length === 3)!
  const blockW = 3 * CARD_W + 2 * 2
  expect(lead(kidsRow)).toBe(Math.floor((120 - blockW) / 2))
  expect(lead(tops[0]!)).toBe(Math.floor((120 - blockW) / 2) + (blockW - CARD_W) / 2)
})

test('centred: connectors leave the parent bottom centre (┬) and enter each child top centre (┴); a grandchild hangs under its own parent', () => {
  const t = rows(tree)
  const y = t.findIndex(l => l.includes('╰') && l.includes('┬'))
  expect(y).toBeGreaterThan(-1)
  const col = strWidth(t[y]!.slice(0, t[y]!.indexOf('┬')))
  expect(col).toBe(lead(t[y]!) + CARD_W / 2)
  const kidsTop = t.find(l => (l.match(/╭/g) ?? []).length === 3)!
  expect((kidsTop.match(/┴/g) ?? []).length).toBe(3)
  // grandchild: its top ┴ is in the same column as its parent's bottom ┬
  const gy = t.findIndex((l, i) => i > t.indexOf(kidsTop) && (l.match(/╭/g) ?? []).length === 1)
  const gcol = strWidth(t[gy]!.slice(0, t[gy]!.indexOf('┴')))
  const pb = t.slice(0, gy).reverse().find(l => l.includes('┬') && l.includes('╰'))!
  expect([...pb].some((ch, i, a) => ch === '┬' && strWidth(a.slice(0, i).join('')) === gcol)).toBe(true)
})

test('roles on the bottom border: orquestrador (session), agente (top level), subagente (deeper); worktree badge', () => {
  const t = rows([...tree, mk('w', { git: { branch: 'feat/x', worktree: 'wt' } } as any)], { width: 200 })
  const bottoms = t.filter(l => l.includes('╰')).join('\n')
  expect(bottoms).toContain('orquestrador'); expect(bottoms).toContain(' agente '); expect(bottoms).toContain('subagente')
  expect(bottoms).toMatch(/⧉ feat\/x/)
  const a = rows(tree, { caps: detectCaps({ OFFICE_ASCII: '1' }) }).join('\n')
  expect(a).toContain('subagente'); expect(a).not.toMatch(/[╭╮╰╯│┬┴┄┊]/)
})

test('animated bus: a pulse runs along the dashed line while a child runs; reduced motion is static', () => {
  const sig = (frame: number, c = caps) => JSON.stringify(renderCompact(tree, T + 5000, { ...base, caps: c, frame }).filter(l => l.some(s => /[┄┊]/.test(s.t))))
  expect(sig(0)).not.toBe(sig(3))
  const still = { ...caps, reducedMotion: true }
  expect(sig(0, still)).toBe(sig(3, still))
})

for (const width of [60, 72, 80, 100, 120, 160, 200]) test(`responsive @${width}: no row is wider than the pane, every card closed, all agents drawn`, () => {
  const many = [mk('p'), ...Array.from({ length: 7 }, (_, i) => mk(`k${i}`, { parentAgentId: 'g-p' })), mk('z', { parentAgentId: 'g-k1' })]
  const t = rows(many, { width })
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(width)
  expect((t.join('\n').match(/╭[─┴]{32}╮/g) ?? []).length).toBe(10) // session + 9 agents
  expect((t.join('\n').match(/╰─[^╭╰]{31}╯/g) ?? []).length).toBe(10)
})

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

test('empty session: the orchestrator card and the waiting line are centred, under the Office Agent Monitor header', () => {
  const t = rows([])
  expect(t[1]).toContain('Office Agent Monitor')
  const top = t.find(l => /^ +╭─{32}╮/.test(l))!
  expect(lead(top)).toBe((120 - CARD_W) / 2)
  expect(t.join('\n')).toContain('orquestrador')
  const wait = t.find(l => l.includes('Aguardando agentes'))!
  expect(Math.abs(lead(wait) - (120 - strWidth(wait.trim())) / 2)).toBeLessThanOrEqual(1)
})

test('centred chrome: the Geral line and the legend are centred in the cards view', () => {
  const t = rows(tree)
  for (const key of ['Geral ', 'Concluído', 'barramento']) {
    const l = t.find(x => x.includes(key) && !x.includes('│'))!
    expect(Math.abs(lead(l) - (120 - strWidth(l.trim())) / 2)).toBeLessThanOrEqual(1)
  }
})

test('no card is ever hidden: when the pane is too short the cards go dense (3 rows each) and every agent stays drawn', () => {
  const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))
  const t = rows(many, { maxLines: 20 })
  const out = t.join('\n')
  expect(out).not.toContain('cards ocultos')
  for (let i = 0; i < 30; i++) expect(out).toContain(`Dev: n${i}`)
  // dense card: top border, one body row, bottom border
  const top = t.findIndex(l => /╭[─┴]{32}╮/.test(l) && !l.startsWith('╭'))
  expect(t[top + 1]).toContain('│'); expect(t[top + 2]).toContain('╰')
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(120)
  // tall enough pane: the full 7-row cards stay
  const full = rows(many.slice(0, 2), { maxLines: 200 })
  const ft = full.findIndex(l => /╭[─┴]{32}╮/.test(l) && !l.startsWith('╭'))
  expect(full[ft + 6]).toContain('╰')
})

test('depth: a chain of 20 nested agents is drawn, each under its parent', () => {
  const chain = Array.from({ length: 20 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const out = rows(chain, { maxLines: 9999 }).join('\n')
  for (let i = 0; i < 20; i++) expect(out).toContain(`Dev: d${i}`)
  expect((out.match(/╭[─┴]{32}╮/g) ?? []).length).toBe(21)
})

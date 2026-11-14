import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, CARD_W } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'
import { hotkeysFor, initialUi } from './actions'

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

test('roles beside the worktree row: orquestrador (session), agente (top level), subagente (deeper); worktree on the left', () => {
  const t = rows([...tree, mk('w', { git: { branch: 'feat/x', worktree: 'wt' } } as any)], { width: 200 }).join('\n')
  expect(t).toMatch(/ orquestrador L0│/); expect(t).toMatch(/ agente L1│/); expect(t).toMatch(/ subagente L2│/)
  expect(t).toMatch(/│⧉ feat\/x +agente L1│/)
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

test('empty session: the orchestrator card and the waiting line are centred, under the Office header', () => {
  const t = rows([])
  expect(t[0]).toMatch(/^Office · /)
  const top = t.find(l => /^ +╭─{32}╮/.test(l))!
  expect(lead(top)).toBe((120 - CARD_W) / 2)
  expect(t.join('\n')).toContain('orquestrador')
  const wait = t.find(l => l.includes('Aguardando agentes'))!
  expect(Math.abs(lead(wait) - (120 - strWidth(wait.trim())) / 2)).toBeLessThanOrEqual(1)
})

test('centred chrome: the legend is centred in the cards view', () => {
  const t = rows(tree)
  for (const key of ['✓ Concluído', 'barramento']) {
    const l = t.find(x => x.includes(key) && !x.includes('│'))!
    expect(Math.abs(lead(l) - (120 - strWidth(l.trim())) / 2)).toBeLessThanOrEqual(1)
  }
})

test('cards never shrink and none is dropped: a short pane shows a window of full 7-row cards that scrolls to every agent', () => {
  const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))
  const seen = new Set<string>()
  let last: string[] = []
  for (let scroll = 0; scroll <= 104; scroll += 8) {
    last = rows(many, { maxLines: 20, scroll })
    for (const m of last.join('\n').matchAll(/Dev: n\d+/g)) seen.add(m[0])
    for (const l of last) expect(strWidth(l)).toBeLessThanOrEqual(120)
  }
  expect(seen.size).toBe(30)
  const first = rows(many, { maxLines: 20 })
  expect(first.join('\n')).toMatch(/1\/\d+/); expect(first.join('\n')).not.toContain('cards ocultos')
  expect(last.join('\n')).toMatch(/(\d+)\/\1/)
  // a card is always 7 rows: top border, 5 body rows, bottom border
  const top = first.findIndex(l => /╭─{32}╮/.test(l) && !l.startsWith('╭'))
  for (let r = 1; r <= 5; r++) expect(first[top + r]).toContain('│')
  expect(first[top + 6]).toContain('╰')
})

test('design card anatomy: title + state pill, chips, worktree + role, step segments, status + cost and time', () => {
  const st = [{ tool: 'Read', label: 'a', startedAt: T, durationMs: 2000, ok: true }, { tool: 'Bash', label: 'b', startedAt: T, durationMs: 5000, ok: true }]
  const a = mk('api', { description: '🦉 Senior · 🎼 Sonnet · 🟢 baixo: API de cupom', status: 'done', endedAt: T + 16000, steps: st, usage: { tokens: 10, costUsd: 0.3 }, git: { branch: 'spec/checkout-api', worktree: 'wt' } } as any)
  const t = rows([a])
  const y = t.findIndex(l => l.includes('API de cupom') && l.includes('│'))
  expect(t[y]).toMatch(/│✓ API de cupom +Concluído│/)
  expect(t[y + 1]).toMatch(/│🦉 Senior · ◆ Sonnet ▁ *│/)
  expect(t[y + 2]).toMatch(/│⧉ spec\/checkout-api +agente L1│/)
  expect(t[y + 3]).toMatch(/│━+ ━+│/)
  expect(t[y + 4]).toMatch(/│concluído +~\$0,30 · 00:16│/)
})

test('no scroll buttons or j/k hotkeys: j/k scroll invisibly; the footer lists none', () => {
  const keys = (mode: any) => hotkeysFor({ ...initialUi(), view: 'compact', mode }, false).map(h => h.key)
  expect(keys('cards')).not.toContain('j'); expect(keys('cards')).not.toContain('k')
})

test('depth: a chain of 20 nested agents is drawn, each under its parent', () => {
  const chain = Array.from({ length: 20 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const out = rows(chain, { maxLines: 9999 }).join('\n')
  for (let i = 0; i < 20; i++) expect(out).toContain(`Dev: d${i}`)
  expect((out.match(/╭[─┴]{32}╮/g) ?? []).length).toBe(21)
})

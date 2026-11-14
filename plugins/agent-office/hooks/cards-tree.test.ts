import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, indentOf, scrollInfo } from './compact'
import { strWidth } from './monitor'
import { buildGraph } from './run-model'
import type { AgentLike } from './office'
import { hotkeysFor, initialUi } from './actions'

// Indented card tree (Grafo6): a child hangs under its parent, `└─▸` for the last child and `├─▸` for siblings,
// the rail `│` joins them. Indent 2 cols per level to L6, then 1 col per level to L50. Nothing is dropped or hidden.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const draw = (ag: AgentLike[], o: object = {}) => renderCompact(ag, T + 5000, { ...base, ...o } as any)
const rows = (ag: AgentLike[], o: object = {}) => draw(ag, o).map(l => l.map(s => s.t).join(''))
const at = (row: string, x: number) => Array.from(row)[x]
const titleRow = (t: string[], name: string) => t.find(l => l.includes(name)) ?? ''
const connector = (t: string[], name: string) => titleRow(t, name).match(/[├└]([─╌┄┈])▸/)?.[1]

test('connectors: a child hangs from its parent rail, └─▸ for the last child, ├─▸ for a sibling, │ joins them', () => {
  const t = rows([mk('p'), mk('c1', { parentAgentId: 'g-p' }), mk('c2', { parentAgentId: 'g-p' })])
  const y1 = t.findIndex(l => l.includes('Dev: c1')), y2 = t.findIndex(l => l.includes('Dev: c2'))
  expect(y2).toBeGreaterThan(y1)
  const x = Array.from(t[y1]!).indexOf('├')
  expect(x).toBeGreaterThan(-1)
  expect(at(t[y1]!, x + 2)).toBe('▸')
  expect(at(t[y2]!, x)).toBe('└') // c2 is the last child
  expect(at(t[y2]!, x + 2)).toBe('▸')
  expect(at(t[y1 - 1]!, x + 3)).toBe('╭') // the child card starts 3 cols right of the connector
  for (let r = y1 + 1; r < y2; r++) expect(at(t[r]!, x)).toBe('│') // the rail joins the siblings
  expect(at(t[y2 + 1]!, x)).not.toBe('│') // and stops at the last child
})

test('connectors: a grandchild hangs from its own parent, one level further right', () => {
  const t = rows([mk('p'), mk('c', { parentAgentId: 'g-p' }), mk('gc', { parentAgentId: 'g-c' })])
  const yc = t.findIndex(l => /└[─╌┄┈]▸/.test(l) && l.includes('Dev: c'))
  const ygc = t.findIndex(l => /└[─╌┄┈]▸/.test(l) && l.includes('Dev: gc'))
  expect(yc).toBeGreaterThan(-1); expect(ygc).toBeGreaterThan(yc)
  const xc = Array.from(t[yc]!).indexOf('└'), xgc = Array.from(t[ygc]!).indexOf('└')
  expect(xgc - xc).toBe(2) // indent step at L2
})

test('indent: 2 cols per level up to L6, 1 col per level up to L50 (L50 = 56 cols)', () => {
  expect(indentOf(0)).toBe(0)
  expect(indentOf(1)).toBe(2)
  expect(indentOf(6)).toBe(12)
  expect(indentOf(7)).toBe(13)
  expect(indentOf(50)).toBe(56)
  for (let d = 1; d <= 50; d++) expect(indentOf(d) - indentOf(d - 1)).toBe(d <= 6 ? 2 : 1)
})

test('depth 50: a chain of 50 nested agents is all drawn, every card closed, the deepest one at the indent bound', () => {
  const chain = Array.from({ length: 50 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const t = rows(chain, { width: 120, maxLines: 99999 })
  for (let i = 0; i < 50; i++) expect(t.join('\n')).toContain(`Dev: d${i}`)
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(120)
  expect((t.join('\n').match(/╭─+╮/g) ?? []).length).toBe(51) // session + 50 agents
  expect((t.join('\n').match(/╰─+╯/g) ?? []).length).toBe(51)
  expect(at(titleRow(t, 'Dev: d49'), 1 + indentOf(50))).toBe('│') // deepest card: left edge at col 1 + 56
})

test('depth 50 at a narrow pane: cards keep their minimum width, none is dropped', () => {
  const chain = Array.from({ length: 50 }, (_, i) => mk(`d${i}`, i ? { parentAgentId: `g-d${i - 1}` } : {}))
  const t = rows(chain, { width: 80, maxLines: 99999 })
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(80)
  expect(t.join('\n')).toContain('Dev: d49')
  expect((t.join('\n').match(/╭─+╮/g) ?? []).length).toBe(51)
})

test('running edge: only the connector into a running child changes its dash between frames', () => {
  const ag = [mk('p'), mk('run', { parentAgentId: 'g-p' }), mk('fin', { parentAgentId: 'g-p', status: 'done', endedAt: T + 1000 })]
  const conn = (name: string, frame: number, c = caps) => connector(rows(ag, { frame, caps: c }), name)
  expect(conn('Dev: run', 0)).not.toBe(conn('Dev: run', 1))
  expect(conn('Dev: run', 0)).toMatch(/[╌┄┈]/)
  expect(conn('Dev: fin', 0)).toBe('─')
  expect(conn('Dev: fin', 1)).toBe('─')
})

test('running edge: reduced motion and NO_COLOR keep every connector static', () => {
  const ag = [mk('p'), mk('run', { parentAgentId: 'g-p' })]
  const still = { ...caps, reducedMotion: true }
  const mono = detectCaps({ NO_COLOR: '1', LANG: 'en_US.UTF-8' })
  for (const c of [still, mono]) expect(connector(rows(ag, { caps: c, frame: 0 }), 'Dev: run')).toBe('─')
  expect(connector(rows(ag, { caps: still, frame: 1 }), 'Dev: run')).toBe('─')
})

test('workflow badge: an agent of a workflow run shows ⟳ <runId> in #FF8FB1; other agents show none', () => {
  const lines = draw([mk('w', { workflow: { runId: 'run-7', agentIndex: 0 } }), mk('o')])
  const badges = lines.flat().filter(s => s.t.startsWith('⟳'))
  expect(badges.length).toBe(1)
  expect(badges[0]!.t).toBe('⟳ run-7')
  expect(badges[0]!.fg).toBe('#FF8FB1')
})

test('run model: buildGraph carries the workflow run id on the agent node, from the WfAgent workflow data', () => {
  const g = buildGraph([mk('w', { workflow: { runId: 'run-7', agentIndex: 0 } }), mk('o')], T)
  expect(g.nodes.get('w')!.workflow).toBe('run-7')
  expect(g.nodes.get('o')!.workflow).toBeUndefined()
})

test('ASCII: the tree uses the ascii connectors only (+-> / `->, rail :) and no Unicode tree glyph', () => {
  const a = rows([mk('p'), mk('c1', { parentAgentId: 'g-p' }), mk('c2', { parentAgentId: 'g-p' })], { caps: detectCaps({ OFFICE_ASCII: '1' }) }).join('\n')
  expect(a).toMatch(/\+->|`->/)
  expect(a).toContain('subagente')
  expect(a).not.toMatch(/[╭╮╰╯│├└─▸┄╌┈⟳]/)
})

for (const width of [80, 100, 120, 160]) test(`responsive @${width}: no row wider than the pane, every card closed, all agents drawn`, () => {
  const many = [mk('p'), ...Array.from({ length: 7 }, (_, i) => mk(`k${i}`, { parentAgentId: 'g-p' })), mk('z', { parentAgentId: 'g-k1' })]
  const t = rows(many, { width })
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(width)
  expect((t.join('\n').match(/╭─+╮/g) ?? []).length).toBe(10) // session + 9 agents
  expect((t.join('\n').match(/╰─+╯/g) ?? []).length).toBe(10)
})

test('empty session: the orchestrator card and the waiting line under the Office header', () => {
  const t = rows([])
  expect(t[0]).toMatch(/^Office · /)
  expect(t.join('\n')).toContain('orquestrador')
  expect(t.find(l => l.includes('Aguardando agentes'))).toBeDefined()
})

test('legend: the cards footer names the tree connectors', () => {
  expect(rows([mk('a')]).join('\n')).toContain('└─▸ ├─▸ filho')
})

test('cards never shrink below their anatomy and none is dropped: a short pane scrolls to every agent', () => {
  const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))
  const seen = new Set<string>()
  let last: string[] = []
  rows(many, { maxLines: 20 })
  for (const scroll of scrollInfo.units) { // one card per scroll stop
    last = rows(many, { maxLines: 20, scroll })
    for (const m of last.join('\n').matchAll(/Dev: n\d+/g)) seen.add(m[0])
    for (const l of last) expect(strWidth(l)).toBeLessThanOrEqual(120)
  }
  expect(seen.size).toBe(30)
  const first = rows(many, { maxLines: 20 })
  expect(first.join('\n')).toMatch(/1\/\d+/)
  expect(last.join('\n')).toMatch(/(\d+)\/\1/)
  // room for the full card: top border, 5 body rows, bottom border; a short pane goes denser instead (B1), never cut
  const tall = rows(many.slice(0, 3), { maxLines: 100 })
  const top = tall.findIndex(l => /╭─{32}╮/.test(l))
  for (let r = 1; r <= 5; r++) expect(tall[top + r]).toContain('│')
  expect(tall[top + 6]).toContain('╰')
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
  expect(keys('cards')).not.toContain('j')
  expect(keys('cards')).not.toContain('k')
})

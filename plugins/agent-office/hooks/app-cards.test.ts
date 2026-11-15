import { test, expect } from 'claude-code/testing'
import { isAppSurface, appCards, appMap, appGrid, mapRows, APP_CARD_W, appCardW, appPerRow, appTreeRows, APP_CARD_MIN, segTone, barTone, cardBg, onCard, WAIT_WHITE } from './app-cards'
import type { AgentLike } from './office'
import { buildRunModel } from './run-model'
import { CAPABILITIES } from './capabilities'
import { renderCompact, detectCaps } from './compact'
import { STATE_TABLE } from './vocabulary'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })

test('surface: only the terminal keeps the text cards; desktop, vscode and mobile get graphical cards', () => {
  expect(isAppSurface('terminal')).toBe(false)
  expect(isAppSurface(undefined)).toBe(false)
  for (const s of ['desktop', 'vscode', 'mobile']) expect(isAppSurface(s)).toBe(true)
})

test('app card: task as title, persona/model/effort chips with icons, state tone', () => {
  const [c] = appCards([mk('a', { description: '🛠️ Mid-level · 🎼 Sonnet · 🟡 médio: Reading edit.php' })], T + 5000, {})
  expect(c!.title).toBe('Reading edit.php')
  expect(c!.chips).toEqual(['🛠️ Mid-level', '🎼 Sonnet', '🟡 médio'])
  expect(c!.state).toBe('running')
  expect(c!.tone).toBe('suggestion')
})

test('app card: no format falls back to the 🤖 Agente chip and the whole description as title', () => {
  const [c] = appCards([mk('a', { description: 'Find files' })], T + 5000, {})
  expect(c!.title).toBe('Find files')
  expect(c!.chips).toEqual(['🤖 Agente'])
})

test('app card: failed and done carry their own tone and glyph, not color alone', () => {
  const cs = appCards([mk('f', { status: 'error' }), mk('d', { status: 'done', endedAt: T + 5000 })], T + 9000, {})
  const f = cs.find(c => c.id === 'f')!, d = cs.find(c => c.id === 'd')!
  expect([f.tone, f.glyph]).toEqual(['error', '✗'])
  expect([d.tone, d.glyph, d.pct]).toEqual(['success', '✓', 1])
})

test('app card: query filters cards', () => {
  const cs = appCards([mk('alfa'), mk('beta')], T + 1000, { query: 'beta' })
  expect(cs.map(c => c.id)).toEqual(['beta'])
})

test('app card: real description fixture and subagent_type fallback feed the chips', () => {
  const [a] = appCards([mk('a', { description: '🎨 UX/UI · 🎼 Sonnet · 🟢 baixo: Render HTML no app Claude Code' })], T + 5000, {})
  expect([a!.title, ...a!.chips]).toEqual(['Render HTML no app Claude Code', '🎨 UX/UI', '🎼 Sonnet', '🟢 baixo'])
  const [b] = appCards([mk('b', { description: 'Varrer docs', subagentType: 'padrao' })], T + 5000, {})
  expect(b!.chips).toEqual(['🤖 Agente', '🎼 Sonnet', '🟢 baixo'])
})

test('appMap: session root, agents under their parent, tones and pct never invented', () => {
  const m = appMap([mk('p', { description: 'Dev: pai', agentId: 'g-p' }), mk('c', { description: 'Dev: filho', parentAgentId: 'g-p' }), mk('x', { description: 'Dev: x', status: 'error' })], T + 5000, {})
  expect(m.card.title).toBe('Claude Code') // two top-level agents
  const top = m.children.map(n => n.card.title)
  expect(top).toContain('Dev: pai'); expect(top).toContain('Dev: x')
  const pai = m.children.find(n => n.card.title === 'Dev: pai')!
  expect(pai.children.map(n => n.card.title)).toEqual(['Dev: filho'])
  expect(pai.children[0]!.card.pct).toBeUndefined()
  expect(pai.children[0]!.card.tone).toBe('suggestion')
  expect(m.children.find(n => n.card.title === 'Dev: x')!.card.tone).toBe('error')
})

test('appMap: query prunes branches', () => {
  const m = appMap([mk('alfa'), mk('beta')], T + 1000, { query: 'beta' })
  expect(m.card.id).toBe('session'); expect(m.children.map(n => n.card.id)).toEqual(['beta']) // design 2026-11-14: Orquestrador always on top
})

test('appMap: several top-level agents hang under the session root titled Claude Code', () => {
  const m = appMap([mk('alfa'), mk('beta')], T + 1000, {})
  expect(m.card.title).toBe('Claude Code'); expect(m.children.map(n => n.card.id)).toEqual(['alfa', 'beta'])
})

test('app card: one segment per tool step when the timeline exists, else none', () => {
  const [c] = appCards([mk('a', { steps: [{ id: '1', tool: 'Bash', label: 'x', startedAt: T, durationMs: 4000 }, { id: '2', tool: 'Read', label: 'y', startedAt: T, durationMs: 1000, ok: false }] })], T + 9000, {})
  expect(c!.steps).toEqual([{ weight: 4000, tone: 'success' }, { weight: 1000, tone: 'error' }, { weight: 1000, tone: 'suggestion' }])
  expect(appCards([mk('b')], T, {})[0]!.steps).toBeUndefined()
})

test('appMap: every card carries its role by depth: orquestrador (session), agente (top level), subagente (deeper)', () => {
  const m = appMap([mk('p', { description: 'Dev: pai', agentId: 'g-p' }), mk('c', { description: 'Dev: filho', parentAgentId: 'g-p' }), mk('x', { description: 'Dev: x' })], T + 5000, {})
  expect(m.card.role).toBe('orquestrador')
  const pai = m.children.find(n => n.card.title === 'Dev: pai')!
  expect(pai.card.role).toBe('agente'); expect(pai.children[0]!.card.role).toBe('subagente')
  expect(appMap([mk('solo')], T + 1000, {}).children[0]!.card.role).toBe('agente')
})

test('parity: one RunModel, Terminal pills and App cards carry the same agents, states and stalled flags', () => {
  const agents = [
    mk('run'), mk('bad', { status: 'error', error: 'boom' }), mk('ok', { status: 'done', endedAt: T + 1000 }),
    mk('old', { seenAt: T - 11 * 60_000, startedAt: T - 11 * 60_000 }), mk('q', { active: false }),
  ]
  const now = T + 5000
  const model = buildRunModel(agents, now, CAPABILITIES)
  const cards = appCards(agents, now, { model })
  const term = renderCompact(agents, now, { width: 200, caps: detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' }), mode: 'cards', query: '', expanded: new Set<string>(), maxCardRows: 99, model })
    .map(l => l.map(s => s.t).join('')).join('\n')
  expect(cards.map(c => c.id).sort()).toEqual(model.nodes.map(n => n.id).sort())
  for (const r of model.nodes) {
    const c = cards.find(x => x.id === r.id)!
    expect(c.runState).toBe(r.state)
    expect(c.stalled).toBe(r.state === 'stalled')
    expect(term).toContain(STATE_TABLE[r.state].label) // Terminal draws the same state from the same node
  }
  expect(cards.find(c => c.id === 'old')!.stalled).toBe(true)
})

test('appMap: orchestrator card matches the design: title Orquestrador, chips persona · modelo · esforço', () => {
  const m = appMap([], T, {})
  expect([m.card.title, ...m.card.chips]).toEqual(['Orquestrador', '🧭 Squad Leader', '👑 Opus', '🟢 baixo'])
})

test('grid: cards wrap into rows by pane width (horizontal and vertical), never one endless row', () => {
  const ids = Array.from({ length: 7 }, (_, i) => String(i))
  const rowsOf = (cols: number) => appGrid(ids, cols).map(r => r.length)
  expect(rowsOf(120)).toEqual([4, 3]) // 26-wide cards + gap 2: 4 fit in 120
  expect(rowsOf(200)).toEqual([6, 1]) // never more than 6 side by side
  expect(rowsOf(10)).toEqual([1, 1, 1, 1, 1, 1, 1]) // narrower than one card: one per row, none dropped
  expect(appGrid(['a'], 120)).toEqual([['a']])
  expect(appGrid([], 120)).toEqual([])
})

test('map wrap: siblings that fit one row get a solid bus; otherwise rows of floor((w-2+2)/28) hang off a dashed trunk, one dashed bus per row', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  expect(mapRows(ids.slice(0, 3), 112)).toEqual({ bus: 'solid', rows: [['a', 'b', 'c']] }) // 4 per row at 112 cols
  expect(mapRows(ids, 112)).toEqual({ bus: 'dashed', rows: [['a', 'b', 'c', 'd'], ['e', 'f', 'g']] })
  expect(mapRows(ids.slice(0, 5), 112).bus).toBe('dashed')
  expect(mapRows(ids.slice(0, 2), 10)).toEqual({ bus: 'dashed', rows: [['a'], ['b']] }) // narrower than a card: one per row
  expect(mapRows([], 112)).toEqual({ bus: 'solid', rows: [] })
})

test('root rule (design legend): one top agent keeps the Orquestrador root; two or more get a "Claude Code" root above them', () => {
  const one = appMap([mk('a')], T + 5000, {})
  expect(one.card.id).toBe('session'); expect(one.card.title).toBe('Orquestrador'); expect(one.children.map(c => c.card.id)).toEqual(['a'])
  for (const ag of [[mk('a'), mk('b')], [mk('a'), mk('b'), mk('c')]]) {
    const m = appMap(ag, T + 5000, {})
    expect(m.card.id).toBe('session'); expect(m.card.title).toBe('Claude Code'); expect(m.children.map(c => c.card.id)).toEqual(ag.map(x => x.id))
  }
  expect(appMap([], T, {}).card.title).toBe('Orquestrador')
  // subagents do not count: one top agent with two children is still a single top-level agent
  expect(appMap([mk('a'), mk('k1', { parentAgentId: 'g-a', agentId: 'g-k1' }), mk('k2', { parentAgentId: 'g-a', agentId: 'g-k2' })].map((x, i) => i === 0 ? { ...x, agentId: 'g-a' } : x), T + 5000, {}).card.title).toBe('Orquestrador')
})

test('cards 25% smaller: 26-wide (was 34), line blinks while running, white while waiting, red card on failure', () => {
  expect(APP_CARD_W).toBe(26)
  expect(appGrid(Array.from({ length: 7 }, (_, i) => i), 120).map(r => r.length)).toEqual([4, 3])
  expect([segTone('suggestion', 0), segTone('suggestion', 1), segTone('success', 1)]).toEqual(['suggestion', 'subtle', 'success'])
  expect(barTone('pending')).toBe(WAIT_WHITE)
  expect(barTone('attention')).toBe(WAIT_WHITE)
  expect(barTone('running')).toBe('suggestion')
  expect(cardBg('failed')).toBe('error')
  expect(cardBg('running')).toBeUndefined()
  expect([barTone('failed'), onCard('failed', 'error'), onCard('running', 'error')]).toEqual([WAIT_WHITE, WAIT_WHITE, 'error']) // review: no red line on the red card
})

test('dynamic width: cards shrink with the sibling count so up to 6 sit side by side; never wider than 26 nor narrower than 15', () => {
  const six = Array.from({ length: 6 }, (_, i) => i)
  expect(appCardW(3, 120)).toBe(26) // few cards keep full width
  expect(appCardW(6, 120)).toBe(18)
  expect(appGrid(six, 120, appCardW(6, 120)).map(r => r.length)).toEqual([6])
  expect(appGrid(Array.from({ length: 9 }, (_, i) => i), 120, appCardW(9, 120)).map(r => r.length)).toEqual([6, 3]) // cap 6 per row
  expect(appCardW(6, 60)).toBe(18) // narrow pane: floor 18, then wraps (U-010)
  expect(appGrid(six, 60, appCardW(6, 60)).map(r => r.length)).toEqual([3, 3])
  expect(appPerRow(300)).toBe(6)
})

test('U-009/U-010/U-011: APP_CARD_MIN 18; appCardW(9,60)=18; appPerRow(30,18)=1; appMap has no column layout', () => {
  expect(APP_CARD_MIN).toBe(18); expect(appCardW(9, 60)).toBe(18); expect(appPerRow(30, 18)).toBe(1)
  const m = appMap([mk('a', { agentId: 'g-a' }), mk('b')], T + 5000, {})
  expect('layout' in m).toBe(false); expect('layout' in m.children[0]!).toBe(false)
})

test('U-009 appTreeRows: every parent splits children in rows of 6 by its own avail; below 18 only cols shrink, never under 18 wide', () => {
  const k = (n: number) => Array.from({ length: n }, (_, i) => i)
  const a = appTreeRows(k(8), 120); expect(a.rows.map(r => r.length)).toEqual([6, 2]); expect(a.w).toBe(18)
  expect(appTreeRows(k(7), 300).rows.map(r => r.length)).toEqual([6, 1])
  expect(appTreeRows(k(2), 120).w).toBe(26) // few kids keep full width
  const n = appTreeRows(k(3), 18); expect(n.rows.map(r => r.length)).toEqual([1, 1, 1]); expect(n.w).toBe(18) // avail < 18: one column
  expect(appTreeRows(k(4), 30).rows.map(r => r.length)).toEqual([1, 1, 1, 1]); expect(appTreeRows([], 120).rows).toEqual([])
})

test('U-012: depth 10 drops deeper agents and records how many are hidden (+N ocultos)', () => {
  const chain = Array.from({ length: 12 }, (_, i) => mk(`n${i + 1}`, { agentId: `g${i + 1}`, ...(i ? { parentAgentId: `g${i}` } : {}) }))
  let n = appMap(chain, T + 5000, {}); for (let d = 0; d < 10; d++) n = n.children[0]!
  expect(n.card.id).toBe('n10'); expect(n.children).toEqual([]); expect(n.hidden).toBe(2)
  expect(appMap(chain.slice(0, 5), T + 5000, {}).hidden).toBeUndefined()
})

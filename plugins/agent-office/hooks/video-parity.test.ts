import { test, expect } from 'claude-code/testing'
import { DEFAULT_MODE, MODES, NEXT_MODE, detectCaps, renderCompact } from './compact'
import type { Mode } from './compact'
import type { AgentLike } from './office'
import { VIEW_TABS } from './vocabulary'

// office-video-parity: U-301..U-306, B-301
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 150, caps, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const draw = (ag: AgentLike[], mode: Mode, o: object = {}) => renderCompact(ag, T + 5000, { ...base, mode, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')

test('U-301 tab strip lists the 8 tabs in video order, each clickable', () => {
  const ls = draw([mk('a')], 'map')
  const tabs = ls.find(l => l.some(s => s.act === 'mode:map'))!
  expect(tabs.map(s => s.t).join('')).toMatch(/\[?Mapa\]? +Árvore +Worktrees +Cards +Waterfall +Custo +Ferramentas +Workflow/)
  expect(tabs.filter(s => s.act).map(s => s.act)).toEqual(VIEW_TABS.map(([m]) => `mode:${m}`))
  expect(VIEW_TABS.map(([m]) => m)).toEqual(['map', 'tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow'])
  expect(tabs.find(s => s.act === 'mode:map')!.variant).toBe('primary')
})
test('U-302 without a workflow the workflow tab is dimmed, not hidden', () => {
  const tabs = draw([mk('a')], 'map').find(l => l.some(s => s.act === 'mode:workflow'))!
  const wf = tabs.find(s => s.act === 'mode:workflow')!
  expect(wf.fg).toBeDefined()
  const withWf = draw([mk('a', { workflow: { runId: 'r1', agentIndex: 0 } })], 'map').find(l => l.some(s => s.act === 'mode:workflow'))!
  expect(withWf.find(s => s.act === 'mode:workflow')!.fg).toBeUndefined()
})
test('U-303 default is map (bus); cards is a plain grid without bus', () => {
  expect(DEFAULT_MODE).toBe('map')
  const ag = [mk('p', { agentId: 'P' }), mk('c1', { parentAgentId: 'P' }), mk('c2', { parentAgentId: 'P' })]
  expect(txt(draw(ag, 'map'))).toMatch(/[┬┴]/)
  const grid = txt(draw(ag, 'cards'))
  expect(grid).not.toMatch(/[┬┴┄]/)
  expect(grid).toContain('Dev: c1'); expect(grid).toContain('Dev: c2')
  const rowOf = (s: string) => txt(draw(ag, 'cards')).split('\n').findIndex(l => l.includes(s))
  expect(rowOf('Dev: c1')).toBe(rowOf('Dev: c2')) // same grid row
})
test('U-304 g cycles the 8 modes and returns to map', () => {
  expect(MODES).toEqual(['map', 'tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow'])
  let m: Mode = 'map'; const seen: Mode[] = []
  for (let i = 0; i < 8; i++) { m = NEXT_MODE[m]; seen.push(m) }
  expect(seen).toEqual(['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow', 'map'])
})
test('U-305 grouped without worktrees: dividers per state with counts', () => {
  const ag = [mk('r1'), mk('r2'), mk('r3'), mk('d1', { status: 'done', endedAt: T + 100 }), mk('f1', { status: 'error', endedAt: T + 100 }), mk('q1', { active: false })]
  const t = txt(draw(ag, 'grouped'))
  for (const d of ['Rodando ×3', 'Concluído ×1', 'Falhou ×1']) expect(t).toContain(d)
  expect(t.indexOf('Falhou ×1')).toBeLessThan(t.indexOf('Rodando ×3'))
  expect(t.indexOf('Rodando ×3')).toBeLessThan(t.indexOf('Concluído ×1'))
})
test('U-306 attention pill reads Atenção', () => {
  const ag = [mk('a', { status: 'error', endedAt: T + 100, error: 'usage limit reached' })]
  const t = txt(draw(ag, 'map'))
  expect(t).toContain('Atenção'); expect(t).not.toContain('Aguarda você')
})

// office-video-gaps: U-401..U-405, B-401
const wf = (ag: AgentLike[], o: object = {}) => draw(ag, 'waterfall', { width: 100, ...o })
const rowsOf = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join(''))
test('U-401 now column crosses the filler cells of the rows; U-402 label sits under it', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 1000 }), mk('b', { startedAt: T + 1000, status: 'done', endedAt: T + 2000 })]
  const r = rowsOf(wf(ag))
  const tail = r.find(l => l.includes('agora'))!
  expect(tail).toContain('agora')
  const col = tail.indexOf('agora') + 4 // label ends under the mark
  expect(r.filter(l => l.includes('▕')).every(l => [...l][col] === '│')).toBe(true)
})
test('U-403 the latest end carries ◂ fim; U-404 a lone agent does not', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 1000 }), mk('b', { startedAt: T, status: 'done', endedAt: T + 4000 })]
  const r = rowsOf(wf(ag)).filter(l => l.includes('▕'))
  expect(r[0]).not.toContain('◂ fim'); expect(r[1]).toContain('◂ fim')
  expect(rowsOf(wf([mk('a')])).join('\n')).not.toContain('fim')
  expect(rowsOf(wf(ag, { caps: detectCaps({ OFFICE_ASCII: '1' }) })).join('\n')).toContain('< fim')
})
test('U-405 pending shows aguarda 1ª ação… and no bar', () => {
  const ag = [mk('a'), mk('p', { active: false })]
  const row = rowsOf(wf(ag)).find(l => l.includes('aguarda 1ª ação…'))!
  expect(row).toBeDefined(); expect(row).not.toMatch(/[█░]/)
})
test('B-401 tie on the end: the mark goes to the first agent in order', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 4000 }), mk('b', { startedAt: T, status: 'done', endedAt: T + 4000 })]
  const r = rowsOf(wf(ag)).filter(l => l.includes('▕'))
  expect(r[0]).toContain('◂ fim'); expect(r[1]).not.toContain('◂ fim')
})
test('V-401 ASCII caps: bar and now column are ASCII, no unicode glyphs in the waterfall rows', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 1000 }), mk('b', { startedAt: T, status: 'done', endedAt: T + 4000 })]
  const r = rowsOf(wf(ag, { caps: detectCaps({ OFFICE_ASCII: '1' }) })).filter(l => l.includes('|'))
  expect(r.length).toBeGreaterThan(0)
  expect(r.join('\n')).not.toMatch(/[▕▏│█░◂]/)
  expect(r[1]).toContain('< fim')
})
test('S-401 a secret inside the agent name is masked in the waterfall label', () => {
  const ag = [mk('a', { description: 'Dev: usar ghp_abcdefghijklmnop1234', startedAt: T, status: 'done', endedAt: T + 1000 }), mk('b', { startedAt: T, status: 'done', endedAt: T + 2000 })]
  const t = rowsOf(wf(ag)).join('\n')
  expect(t).not.toContain('ghp_abcdefghijklmnop1234')
  expect(t).toContain('••••••••')
})

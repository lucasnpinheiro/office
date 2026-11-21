import { test, expect } from 'claude-code/testing'
import { detectCaps, renderCompact, scrollInfo } from './compact'
import type { AgentLike } from './office'
import { applyAction, initialUi, hotkeysFor } from './actions'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const v = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')

test('cards grid honours maxLines and scrolls through scrollInfo (finding 1)', () => {
  const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))
  const full = renderCompact(many, T + 9000, v)
  const short = renderCompact(many, T + 9000, { ...v, maxLines: 30 })
  expect(short.length).toBeLessThan(full.length)
  expect(scrollInfo.max).toBeGreaterThan(0)
  const moved = renderCompact(many, T + 9000, { ...v, maxLines: 30, scroll: scrollInfo.max })
  expect(txt(moved)).not.toBe(txt(short))
})
test('cards grid tags subagents as subagente, not agente (finding 8)', () => {
  const t = txt(renderCompact([mk('p', { agentId: 'P' }), mk('c', { parentAgentId: 'P' })], T + 9000, v))
  expect(t).toContain('subagente')
})
test('grouped filter button targets cards and highlights only in cards mode (finding 4)', () => {
  const ls = renderCompact([mk('a')], T + 9000, { ...v, mode: 'grouped' })
  const b = ls.flat().find(s => s.t.includes('Todos os cards'))!
  expect(b.act).toBe('mode:cards'); expect(b.variant).toBe('secondary')
})
test('g landing on map goes to the map view, leaving map mode keeps the view; g on Mapa goes to the tree view (finding 3)', () => {
  const w = { ...initialUi(), view: 'compact' as const, mode: 'workflow' as const }
  expect(applyAction(w, 'group', { workflow: true }).state).toMatchObject({ mode: 'map', view: 'map' })
  expect(applyAction({ ...initialUi(), view: 'map' as const }, 'group').state).toMatchObject({ mode: 'tree', view: 'compact' })
})
test('v hotkey label promises no sequence (finding 7)', () => {
  expect(hotkeysFor({ ...initialUi(), view: 'map' }, false).find(h => h.act === 'view')!.label).toBe('visão')
})

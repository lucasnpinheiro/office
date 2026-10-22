import { test, expect } from 'claude-code/testing'
import { applyAction, initialUi, hotkeysFor, startUi } from './actions'

const s0 = initialUi()

test('defaults: cards ungrouped, compact, not searching', async () => {
  expect(s0.mode).toBe('cards')
  expect(s0.view).toBe('compact')
  expect(s0.searching).toBe(false)
})

test('g cycles mode, f toggles failed, o cycles sort', async () => {
  expect(applyAction(s0, 'group').state.mode).toBe('waterfall')
  const f = applyAction(s0, 'failed').state
  expect(f.filter).toBe('failed')
  expect(applyAction(f, 'failed').state.filter).toBe('all')
  expect(applyAction(s0, 'sort').state.sort).toBe('state')
})

test('v toggles map and back (never stuck in map)', async () => {
  const m = applyAction(s0, 'view').state
  expect(m.view).toBe('map')
  expect(applyAction(m, 'view').state.view).toBe('compact')
})

test('s toggles search, back closes search, then attach, then detail', async () => {
  const s = applyAction(s0, 'search').state
  expect(s.searching).toBe(true)
  expect(applyAction(s, 'back').state.searching).toBe(false)
  const d = { ...s0, selected: 'a', attach: 'f.txt' }
  const d1 = applyAction(d, 'back').state
  expect(d1.attach).toBe('')
  expect(d1.selected).toBe('a')
  expect(applyAction(d1, 'back').state.selected).toBe('')
})

test('open selects an agent and clears attach; q asks close', async () => {
  const o = applyAction({ ...s0, attach: 'x' }, 'open:abc').state
  expect(o.selected).toBe('abc')
  expect(o.attach).toBe('')
  expect(applyAction(s0, 'close').close).toBe(true)
})

test('grp toggles expanded group; mode:cards resets filter', async () => {
  const e = applyAction(s0, 'grp:k').state
  expect(e.expanded).toEqual(['k'])
  expect(applyAction(e, 'grp:k').state.expanded).toEqual([])
  expect(applyAction({ ...s0, filter: 'failed', mode: 'tree' }, 'mode:cards').state).toMatchObject({ mode: 'cards', filter: 'all' })
})

test('hotkeys are unique per view and off while searching', async () => {
  for (const st of [s0, { ...s0, selected: 'a' }, { ...s0, view: 'map' as const }, { ...s0, selected: 'a', view: 'map' as const }]) {
    for (const side of [false, true]) {
      const keys = hotkeysFor(st, side).map(h => h.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(keys).toContain('q')
      for (const k of keys) expect(k).toMatch(/^[a-z0-9]$/)
    }
  }
  expect(hotkeysFor({ ...s0, searching: true }, false)).toEqual([])
  expect(hotkeysFor(s0, false).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'q'])
  expect(hotkeysFor({ ...s0, selected: 'a' }, false).map(h => h.key)).toEqual(['b', 'q'])
  expect(hotkeysFor({ ...s0, selected: 'a' }, true).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'b', 'q'])
  expect(hotkeysFor({ ...s0, view: 'map' }, false).map(h => h.key)).toEqual(['v', 'q'])
})

test('session start always opens compact + cards, clearing persisted filters and search', async () => {
  const st = startUi()
  expect(st.view).toBe('compact')
  expect(st.mode).toBe('cards')
  expect(st.searching).toBe(false)
  expect(st.query).toBe('')
  expect(st.filter).toBe('all')
  expect(st.selected).toBe('')
  expect(st.attach).toBe('')
  expect(st.expanded).toEqual([])
})

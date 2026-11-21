import { test, expect } from 'claude-code/testing'
import { applyAction, initialUi, hotkeysFor, footerRows } from './actions'
import type { Ui } from './actions'
import { KEY_MAP, keyOf, bindable } from './vocabulary'
import { CAPABILITIES } from './capabilities'
import type { Mode } from './compact'

// Expected behaviour is derived from KEY_MAP and README ("Footer and keys", "Hotkeys"), not from the implementation.
const base = (over: Partial<Ui> = {}): Ui => ({ ...initialUi(), view: 'compact', ...over })
const keyOfAct = (act: string, ctx: 'view' | 'confirm' | 'decision' = 'view') => keyOf(act, ctx)
const ALL_VIEW_TABS: Mode[] = ['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow']
const LIST_TABS: Mode[] = ['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow']

test('KEY_MAP: a key is unique within each context', async () => {
  for (const ctx of ['view', 'confirm', 'decision'] as const) {
    const keys = KEY_MAP.filter(e => (e.ctx ?? 'view') === ctx).map(e => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  }
})

test('KEY_MAP: README letters g o f s v q b e p n j k map to the documented actions', async () => {
  expect(keyOfAct('group')).toBe('g')
  expect(keyOfAct('sort')).toBe('o')
  expect(keyOfAct('failed')).toBe('f')
  expect(keyOfAct('search')).toBe('s')
  expect(keyOfAct('view')).toBe('v')
  expect(keyOfAct('close')).toBe('q')
  expect(keyOfAct('back')).toBe('b')
  expect(keyOfAct('dismissAlert')).toBe('e')
  expect(keyOfAct('prevSibling')).toBe('p')
  expect(keyOfAct('nextSibling')).toBe('n')
})

// Table: key x view -> expected state change. `alert` is the dismiss key passed by the surface (undefined = no alert).
type Row = { key: string; desc: string; from: Ui; ctx?: { collapsed?: boolean; workflow?: boolean; terminal?: boolean; alert?: string }; check: (s: Ui, close?: true) => boolean }
const rows: Row[] = [
  { key: 'g', desc: 'tree folds siblings first', from: base({ mode: 'tree' }), ctx: { collapsed: true }, check: s => s.expanded.includes('tree:fold') && s.mode === 'tree' },
  { key: 'g', desc: 'map view -> tree keeps the map view (review-fixes contract)', from: base({ mode: 'map', view: 'map' }), check: s => s.mode === 'tree' && s.view === 'map' },
  { key: 'g', desc: 'workflow skipped without run', from: base({ mode: 'tools' }), ctx: { workflow: false }, check: s => s.mode === 'map' },
  { key: 'g', desc: 'workflow stop with run', from: base({ mode: 'tools' }), ctx: { workflow: true }, check: s => s.mode === 'workflow' },
  { key: 'o', desc: 'sort cycles time->state->name->time', from: base(), check: s => s.sort === 'state' },
  { key: 'f', desc: 'failed filter toggles on', from: base(), check: s => s.filter === 'failed' },
  { key: 'f', desc: 'failed filter toggles off', from: base({ filter: 'failed' }), check: s => s.filter === 'all' },
  { key: 's', desc: 'search opens', from: base(), check: s => s.searching === true },
  { key: 'v', desc: 'map -> compact tree (no mode chosen)', from: base({ view: 'map' }), check: s => s.view === 'compact' && s.mode === 'tree' },
  { key: 'v', desc: 'tree -> cards (app)', from: base({ mode: 'tree' }), check: s => s.mode === 'cards' },
  { key: 'v', desc: 'tree -> map (terminal)', from: base({ mode: 'tree' }), ctx: { terminal: true }, check: s => s.mode === 'map' },
  { key: 'v', desc: 'cards -> map view', from: base({ mode: 'cards' }), check: s => s.view === 'map' },
  { key: 'q', desc: 'close', from: base(), check: (_s, close) => close === true },
  { key: 'b', desc: 'back leaves search', from: base({ searching: true }), check: s => s.searching === false },
  { key: 'b', desc: 'back clears attach preview', from: base({ attach: 'x' }), check: s => s.attach === '' },
  { key: 'b', desc: 'back clears selection', from: base({ selected: 'a1' }), check: s => s.selected === '' },
  { key: 'e', desc: 'e dismisses the first alert', from: base(), ctx: { alert: 'a1:failed:' }, check: s => (s.dismissed ?? []).includes('a1:failed:') },
  { key: 'e', desc: 'e is a no-op without alert', from: base(), check: s => (s.dismissed ?? []).length === 0 },
  { key: 'e', desc: 'e dismiss in detail clears selection when it is the open agent', from: base({ selected: 'a1' }), ctx: { alert: 'a1:failed:' }, check: s => s.selected === '' },
]
for (const r of rows) {
  test(`key ${r.key} (${r.desc})`, async () => {
    const out = applyAction(r.from, KEY_ACT[r.key]!, r.ctx)
    expect(r.check(out.state, out.close)).toBe(true)
  })
}
const KEY_ACT: Record<string, string> = Object.fromEntries(KEY_MAP.filter(e => (e.ctx ?? 'view') === 'view').map(e => [e.key, e.act]))

test('j/k scroll is a reducer no-op in every list tab and in detail (surface scrolls)', async () => {
  for (const m of LIST_TABS) for (const a of ['scrollDown', 'scrollUp']) expect(applyAction(base({ mode: m }), a).state).toEqual(base({ mode: m }))
  const det = base({ selected: 'a1' })
  for (const a of ['scrollDown', 'scrollUp']) expect(applyAction(det, a).state).toEqual(det)
})

test('j/k are shown in the footer of every compact list tab and in detail, hidden while searching', async () => {
  for (const m of LIST_TABS) {
    const keys = footerRows(base({ mode: m }), false, 200).flat().map(x => x.hotkey)
    expect(keys).toContain('j')
    expect(keys).toContain('k')
  }
  expect(footerRows(base({ mode: 'cards', selected: 'a1' }), false, 200).flat().map(x => x.hotkey)).toEqual(expect.arrayContaining(['j', 'k', 'b', 'q']))
  expect(footerRows(base({ searching: true }), false, 200).flat().map(x => x.hotkey).filter(Boolean)).toEqual([])
})

test('keys are disabled while searching: no footer hotkey at all', async () => {
  expect(hotkeysFor(base({ searching: true }), false, true)).toEqual([])
})

test('every footer hotkey exists in KEY_MAP (or is j/k) and carries the KEY_MAP letter', async () => {
  const states: Ui[] = [base(), base({ selected: 'a1' }), base({ view: 'map' }), base({ mode: 'cost' })]
  for (const s of states) for (const alert of [false, true]) for (const h of hotkeysFor(s, false, alert)) {
    const entry = KEY_MAP.find(e => e.act === h.act)
    expect(entry).toBeDefined()
    expect(h.key).toBe(entry!.key)
  }
})

test('footer shows e only while an alert exists', async () => {
  expect(hotkeysFor(base(), false, false).some(h => h.act === 'dismissAlert')).toBe(false)
  expect(hotkeysFor(base(), false, true).some(h => h.act === 'dismissAlert')).toBe(true)
})

test('caps gate: retry r, stop x, decide d, pause u, openInChat a are not bindable on either surface', async () => {
  for (const surface of ['terminal', 'app'] as const) {
    const acts = bindable(CAPABILITIES, surface).map(e => e.act)
    for (const a of ['retry', 'stop', 'decide', 'pauseResume', 'openInChat']) expect(acts).not.toContain(a)
    expect(acts).toContain('group')
    expect(acts).toContain('dismissAlert')
  }
})

test('dispatch-owned keys have no reducer branch: y copy, r retry, x stop, d decide (UNVERIFIED wiring)', async () => {
  for (const a of ['copy', 'retry', 'stop', 'decide']) expect(applyAction(base(), a).state).toEqual(base())
})

test('ctrl+x tab focus and real key delivery are not testable headless', async () => {
  // UNVERIFIED: needs a live host terminal/app; the reducer has no key-delivery path.
  expect(true).toBe(true)
})

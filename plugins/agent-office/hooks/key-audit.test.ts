import { test, expect } from 'claude-code/testing'
import { applyAction, initialUi, hotkeysFor, footerRows } from './actions'
import type { Ui } from './actions'
import { KEY_MAP, keyOf, bindable } from './vocabulary'
import { CAPABILITIES } from './capabilities'

// Literal expectations: letters and actions are pinned here, not read back from KEY_MAP (that would be circular).
const LIT: [string, string][] = [['g', 'group'], ['o', 'sort'], ['f', 'failed'], ['s', 'search'], ['v', 'view'], ['q', 'close'], ['b', 'back'], ['e', 'dismissAlert'], ['p', 'prevSibling'], ['n', 'nextSibling'], ['j', 'scrollDown'], ['k', 'scrollUp']]
const ACT_OF = Object.fromEntries(LIT.map(([k, a]) => [k, a])) as Record<string, string>
const base = (over: Partial<Ui> = {}): Ui => ({ ...initialUi(), view: 'compact', ...over })
const hotkeysOf = (s: Ui, alert = false) => hotkeysFor(s, false, alert).map(h => h.key).sort()
const rowKeys = (s: Ui, alert = false) => footerRows(s, false, 200, alert).flat().map(x => x.hotkey).filter(Boolean).sort()

test('KEY_MAP pins the literal letter of every documented action', async () => {
  for (const [k, a] of LIT) if (a !== 'scrollDown' && a !== 'scrollUp') expect(keyOf(a)).toBe(k)
})

test('KEY_MAP: a key is unique within each context', async () => {
  for (const ctx of ['view', 'confirm', 'decision'] as const) {
    const keys = KEY_MAP.filter(e => (e.ctx ?? 'view') === ctx).map(e => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  }
})

// README text is checked against these pinned literals by a grep in the PR run (hooks cannot import node:fs).
const DOC_LABELS = ['g: modo', 'o: ordenar', 'f: só falhas', 's: buscar', 'v: visão', 'q: fechar', 'b: voltar', 'j: desce', 'k: sobe', 'p/n irmão']
test('footer labels pinned to the README literals', async () => {
  const code = [...hotkeysFor(base({ mode: 'tree' }), false, true), ...hotkeysFor(base({ selected: 'a1' }), false)].map(h => `${h.key}: ${h.label}`)
  for (const t of ['g: modo', 'o: ordenar', 'f: só falhas', 's: buscar', 'v: visão', 'q: fechar', 'b: voltar']) expect(code).toContain(t)
  expect(footerRows(base({ mode: 'tree' }), false, 200).flat().map(x => x.t)).toEqual(expect.arrayContaining(['j: desce', 'k: sobe']))
  expect(DOC_LABELS.length).toBe(10)
})

test('f and s are shown in every tab (Cost, Tools, Workflow included)', async () => {
  for (const m of ['cost', 'tools', 'workflow'] as const) expect(hotkeysOf(base({ mode: m }))).toEqual(expect.arrayContaining(['f', 's']))
})

// Table: key x view -> expected state change. ctx.alert = the surface's dismiss key (undefined = no alert).
type Row = { key: string; desc: string; from: Ui; ctx?: { collapsed?: boolean; workflow?: boolean; terminal?: boolean; alert?: string }; check: (s: Ui, close?: true) => boolean }
const rows: Row[] = [
  { key: 'g', desc: 'tree folds siblings first when collapsed', from: base({ mode: 'tree' }), ctx: { collapsed: true }, check: s => s.expanded.includes('tree:fold') && s.mode === 'tree' },
  { key: 'g', desc: 'tree goes to grouped when nothing collapsed', from: base({ mode: 'tree' }), ctx: { collapsed: false }, check: s => s.mode === 'grouped' && !s.expanded.includes('tree:fold') },
  { key: 'g', desc: 'map view -> tree keeps the map view (review-fixes contract)', from: base({ mode: 'map', view: 'map' }), check: s => s.mode === 'tree' && s.view === 'map' },
  { key: 'g', desc: 'tools -> map when no workflow run', from: base({ mode: 'tools' }), ctx: { workflow: false }, check: s => s.mode === 'map' },
  { key: 'g', desc: 'tools -> workflow with a run', from: base({ mode: 'tools' }), ctx: { workflow: true }, check: s => s.mode === 'workflow' },
  { key: 'o', desc: 'sort time -> state', from: base(), check: s => s.sort === 'state' },
  { key: 'o', desc: 'sort state -> name', from: base({ sort: 'state' }), check: s => s.sort === 'name' },
  { key: 'o', desc: 'sort name -> time (wrap)', from: base({ sort: 'name' }), check: s => s.sort === 'time' },
  { key: 'f', desc: 'failed filter on', from: base(), check: s => s.filter === 'failed' },
  { key: 'f', desc: 'failed filter off', from: base({ filter: 'failed' }), check: s => s.filter === 'all' },
  { key: 's', desc: 'search opens', from: base(), check: s => s.searching === true },
  { key: 'v', desc: 'map -> compact tree (no mode chosen)', from: base({ view: 'map' }), check: s => s.view === 'compact' && s.mode === 'tree' },
  { key: 'v', desc: 'map -> chosen mode kept (modeChosen)', from: base({ view: 'map', mode: 'cards', modeChosen: true }), check: s => s.view === 'compact' && s.mode === 'cards' },
  { key: 'v', desc: 'tree -> cards (app)', from: base({ mode: 'tree' }), check: s => s.mode === 'cards' },
  { key: 'v', desc: 'tree -> map (terminal)', from: base({ mode: 'tree' }), ctx: { terminal: true }, check: s => s.mode === 'map' },
  { key: 'v', desc: 'cards -> map view', from: base({ mode: 'cards' }), check: s => s.view === 'map' },
  { key: 'q', desc: 'close', from: base(), check: (_s, close) => close === true },
  { key: 'b', desc: 'back leaves search', from: base({ searching: true }), check: s => s.searching === false },
  { key: 'b', desc: 'back clears attach preview', from: base({ attach: 'x' }), check: s => s.attach === '' },
  { key: 'b', desc: 'back clears selection', from: base({ selected: 'a1' }), check: s => s.selected === '' },
  { key: 'e', desc: 'e dismisses the first alert', from: base(), ctx: { alert: 'a1:failed:' }, check: s => (s.dismissed ?? []).includes('a1:failed:') },
  { key: 'e', desc: 'e is a no-op without alert', from: base(), check: s => (s.dismissed ?? []).length === 0 },
  { key: 'e', desc: 'e in detail of alerted agent clears selection', from: base({ selected: 'a1' }), ctx: { alert: 'a1:failed:' }, check: s => s.selected === '' },
  { key: 'p', desc: 'p is a reducer no-op (surface moves sibling)', from: base({ selected: 'a1' }), check: s => s.selected === 'a1' },
  { key: 'n', desc: 'n is a reducer no-op (surface moves sibling)', from: base({ selected: 'a1' }), check: s => s.selected === 'a1' },
  { key: 'j', desc: 'j is a reducer no-op in list tabs', from: base({ mode: 'tree' }), check: s => s.mode === 'tree' && s.selected === '' },
  { key: 'k', desc: 'k is a reducer no-op in detail', from: base({ selected: 'a1' }), check: s => s.selected === 'a1' },
]
for (const r of rows) {
  test(`key ${r.key} (${r.desc})`, async () => {
    const out = applyAction(r.from, ACT_OF[r.key]!, r.ctx)
    expect(r.check(out.state, out.close)).toBe(true)
  })
}

test('g full cycle map -> tree -> ... -> workflow -> map, modeChosen true from the first press', async () => {
  let s = base({ view: 'map', mode: 'map' })
  const seen: string[] = []
  for (let i = 0; i < 8; i++) { s = applyAction(s, 'group', { collapsed: false, workflow: true }).state; seen.push(s.mode); expect(s.modeChosen).toBe(true) }
  expect(seen).toEqual(['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow', 'map'])
})

test('y, n, 1-3 (confirm/decision/copy) are no-ops in the view reducer', async () => {
  const s = base({ selected: 'a1', mode: 'cost' })
  for (const a of ['copy', 'confirm', 'cancel', 'option1', 'option2', 'option3']) expect(applyAction(s, a).state).toEqual(s)
})

test('footer exact sets: list tab, map with selection, detail, searching, alert', async () => {
  expect(rowKeys(base({ mode: 'tree' }))).toEqual(['f', 'g', 'j', 'k', 'o', 'q', 's', 'v'])
  expect(hotkeysOf(base({ view: 'map', selected: 'a1' }))).toEqual(['b', 'q', 'v'])
  expect(hotkeysOf(base({ selected: 'a1' }))).toEqual(['b', 'q'])
  expect(footerRows(base({ selected: 'a1' }), false, 200).flat().map(x => x.t).join('')).toContain('p/n irmão')
  expect(hotkeysOf(base({ searching: true }), true)).toEqual([])
  expect(hotkeysOf(base(), true)).toContain('e')
  expect(hotkeysOf(base(), false)).not.toContain('e')
  expect(hotkeysOf(base({ selected: 'a1' }), true)).not.toContain('e')
})

test('j/k shown in every compact list tab and in detail', async () => {
  for (const m of ['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow'] as const) expect(rowKeys(base({ mode: m }))).toEqual(expect.arrayContaining(['j', 'k']))
  expect(rowKeys(base({ selected: 'a1' }))).toEqual(expect.arrayContaining(['j', 'k']))
})

test('keys disabled while searching: no footer hotkey', async () => {
  expect(hotkeysOf(base({ searching: true }), true)).toEqual([])
  expect(rowKeys(base({ searching: true }), true)).toEqual([])
})

test('caps gate: retry r, stop x, decide d, pause u, openInChat a not bindable on either surface', async () => {
  for (const surface of ['terminal', 'app'] as const) {
    const acts = bindable(CAPABILITIES, surface).map(e => e.act)
    for (const a of ['retry', 'stop', 'decide', 'pauseResume', 'openInChat']) expect(acts).not.toContain(a)
    expect(acts).toContain('group')
    expect(acts).toContain('dismissAlert')
  }
})

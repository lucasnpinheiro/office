import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, alertsOf } from './compact'
import type { CView } from './compact'
import type { AgentLike } from './office'
import { applyAction, initialUi, hotkeysFor, footerText } from './actions'
import { hiddenIds, buildGraph, dismissKey } from './run-model'

const T = 1_000_000
const failed = (endedAt = T + 1000): AgentLike => ({ id: 'a1', description: 'Dev: a1', status: 'error', error: 'boom', startedAt: T, seenAt: T, endedAt } as AgentLike)
const keyOf = (ag: AgentLike) => dismissKey(buildGraph([ag], T + 9000).nodes.get('a1')!)
const view = (dismissed?: Set<string>): CView => ({ width: 100, caps: detectCaps({ TERM: 'xterm-256color' }), mode: 'tree', query: '', expanded: new Set(), maxCardRows: 4, dismissed }) as CView
const segs = (ag: AgentLike, dismissed?: Set<string>) => renderCompact([ag], T + 9000, view(dismissed)).flat()

test('dismiss action adds the key to the persisted set', () => {
  const k = keyOf(failed())
  const s = applyAction(initialUi(), `dismiss:${k}`).state
  expect(s.dismissed).toEqual([k])
  expect(applyAction(s, `dismiss:${k}`).state.dismissed).toEqual([k])
})

test('dismissing the selected agent goes back to the list', () => {
  const s = applyAction({ ...initialUi(), selected: 'a1' }, `dismiss:${keyOf(failed())}`).state
  expect(s.selected).toBe('')
})

test('failed banner shows a [x] seg bound to dismiss:<key>', () => {
  const k = keyOf(failed())
  expect(segs(failed()).find(s => s.t === '[x]')?.act).toBe(`dismiss:${k}`)
})

test('dismissed failed banner and its card disappear', () => {
  const ag = failed()
  const k = new Set([keyOf(ag)])
  expect(segs(ag, k).map(s => s.t).join('').includes('falhou')).toBe(false)
  expect(segs(ag, k).some(s => s.act?.startsWith('dismiss:'))).toBe(false)
})

test('hiddenIds drops a dismissed failed node; another key does not hide it', () => {
  const ag = failed(), g = buildGraph([ag], T + 9000)
  expect(hiddenIds(g, T + 9000, new Set([keyOf(ag)])).has('a1')).toBe(true)
  expect(hiddenIds(g, T + 9000, new Set(['a1:failed:1'])).has('a1')).toBe(false)
})

test('a failure again after a retry reappears: the key carries the end time', () => {
  const k = keyOf(failed(T + 1000))
  expect(segs(failed(T + 5000), new Set([k])).map(s => s.t).join('').includes('falhou')).toBe(true)
})

test('alertsOf lists undismissed banners, attention first, and skips dismissed', () => {
  const ag = failed(), g = buildGraph([ag], T + 9000), keep = new Set(['a1'])
  expect(alertsOf(g, keep).map(n => n.id)).toEqual(['a1'])
  expect(alertsOf(g, keep, new Set([keyOf(ag)])).length).toBe(0)
})

test('hotkey e dispensa o primeiro alerta; sem alerta nada muda', () => {
  const k = keyOf(failed())
  expect(applyAction(initialUi(), 'dismissAlert', { alert: k }).state.dismissed).toEqual([k])
  expect(applyAction(initialUi(), 'dismissAlert').state.dismissed ?? []).toEqual([])
})

test('footer shows e: dispensar only while an alert exists', () => {
  expect(hotkeysFor(initialUi(), false, true).some(h => h.act === 'dismissAlert' && h.key === 'e')).toBe(true)
  expect(hotkeysFor(initialUi(), false).some(h => h.act === 'dismissAlert')).toBe(false)
  expect(footerText(initialUi(), false, true)).toContain('e: dispensar')
})

import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { CView } from './compact'
import type { AgentLike } from './office'
import { applyAction, initialUi } from './actions'
import { hiddenIds, buildGraph } from './run-model'

const T = 1_000_000
const failed: AgentLike = { id: 'a1', description: 'Dev: a1', status: 'error', startedAt: T, seenAt: T, error: 'boom' } as AgentLike
const view = (dismissed?: Set<string>): CView => ({ width: 100, caps: detectCaps({ TERM: 'xterm-256color' }), mode: 'tree', query: '', expanded: new Set(), maxCardRows: 4, dismissed }) as CView
const segs = (dismissed?: Set<string>) => renderCompact([failed], T + 1000, view(dismissed)).flat()

test('dismiss action adds id:state to the persisted set', () => {
  const s = applyAction(initialUi(), 'dismiss:a1:failed').state
  expect(s.dismissed).toEqual(['a1:failed'])
  expect(applyAction(s, 'dismiss:a1:failed').state.dismissed).toEqual(['a1:failed'])
})

test('dismissing the selected agent goes back to the list', () => {
  const s = applyAction({ ...initialUi(), selected: 'a1' }, 'dismiss:a1:failed').state
  expect(s.selected).toBe('')
})

test('failed banner shows a [x] seg bound to dismiss:<id>:<state>', () => {
  const x = segs().find(s => s.t === '[x]')
  expect(x?.act).toBe('dismiss:a1:failed')
  expect(segs().some(s => s.t.includes('falhou'))).toBe(true)
})

test('dismissed failed banner and its card disappear', () => {
  const all = segs(new Set(['a1:failed'])).map(s => s.t).join('')
  expect(all.includes('falhou')).toBe(false)
  expect(segs(new Set(['a1:failed'])).some(s => s.act === 'dismiss:a1:failed')).toBe(false)
})

test('hiddenIds drops a dismissed failed node; other state keys do not hide it', () => {
  const g = buildGraph([failed], T + 1000)
  expect(hiddenIds(g, T + 1000, new Set(['a1:failed'])).has('a1')).toBe(true)
  expect(hiddenIds(g, T + 1000, new Set(['a1:running'])).has('a1')).toBe(false)
})

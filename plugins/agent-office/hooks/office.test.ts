import { test, expect } from 'claude-code/testing'
import { parseSub, isRunning, frameFor, nextDelay, FRAME_MS, TICK_MS, paneWidth, drawSig } from './office'
import type { AgentLike } from './office'

const mk = (over: Partial<AgentLike> = {}): AgentLike => ({ id: 'a', description: 'x', status: 'working', startedAt: 0, ...over })

test('alias star = start, stop, toggle, collapse/expand, help', () => {
  expect(parseSub('start')).toBe('start')
  expect(parseSub('star')).toBe('start')
  expect(parseSub('stop')).toBe('stop')
  expect(parseSub('')).toBe('toggle')
  expect(parseSub('collapse')).toBe('collapse')
  expect(parseSub('expandir')).toBe('expand')
  expect(parseSub('banana')).toBe('help')
})

test('animation frame moves only while something runs; no timer when idle', () => {
  const run = [mk()]
  const idle = [mk({ status: 'done', endedAt: 5 })]
  expect(isRunning(run)).toBe(true)
  expect(frameFor(run, 1000)).not.toBe(frameFor(run, 1000 + FRAME_MS))
  expect(frameFor(idle, 1000)).toBe(frameFor(idle, 1000 + FRAME_MS))
  expect(nextDelay(run)).toBe(FRAME_MS)
  expect(nextDelay(idle)).toBeUndefined()
})

test('nextDelay keeps ticking while a finished agent waits to be hidden', () => {
  const done = { id: 'a', description: 'd', status: 'done' as const, startedAt: 0, endedAt: 1000 }
  expect(nextDelay([done], 5000)).toBe(TICK_MS)
  expect(nextDelay([done], 40_000)).toBeUndefined()
})

test('paneWidth prefers the pane body columns over the whole-surface viewport', () => {
  expect(paneWidth({ bodyColumns: 58 }, { columns: 200 })).toBe(58)
  expect(paneWidth(undefined, { columns: 90 })).toBe(90)
  expect(paneWidth(undefined, undefined)).toBe(80)
})

test('parseSub: status and reset', () => {
  expect(parseSub('status')).toBe('status')
  expect(parseSub('reset')).toBe('reset')
})

test('drawSig: equal for the same frame/second/data, different when any changes', () => {
  const a = [{ id: 'a', description: 'd', status: 'working' as const, startedAt: 0 }]
  expect(drawSig(a, 1000)).toBe(drawSig(a, 1010))
  expect(drawSig(a, 1000)).not.toBe(drawSig(a, 1200))
  expect(drawSig(a, 1000)).not.toBe(drawSig([{ ...a[0]!, status: 'done' as const }], 1000))
})

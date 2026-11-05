import { test, expect } from 'claude-code/testing'
import { parseSub, isRunning, frameFor, nextDelay, FRAME_MS, TICK_MS, paneWidth, drawSig } from './office'
import type { AgentLike } from './office'
import { SPIN_FRAME_MS, REDUCED_FRAME_MS } from './motion'

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

test('T-014: running redraw is 6 frames/s in app and compact; reduced is 1 frame/s', () => {
  const run = [mk()]
  expect(nextDelay(run, 0, { compact: true })).toBe(SPIN_FRAME_MS)
  expect(nextDelay(run, 0, { reducedMotion: true, compact: true })).toBe(REDUCED_FRAME_MS)
  expect(nextDelay(run, 0, { reducedMotion: true })).toBe(REDUCED_FRAME_MS)
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
  const t = 6 * FRAME_MS // início exato de um quadro (FRAME_MS = 167 desde T-014)
  expect(drawSig(a, t)).toBe(drawSig(a, t + 1))
  expect(drawSig(a, t)).not.toBe(drawSig(a, t + FRAME_MS))
  expect(drawSig(a, t)).not.toBe(drawSig([{ ...a[0]!, status: 'done' as const }], t))
})

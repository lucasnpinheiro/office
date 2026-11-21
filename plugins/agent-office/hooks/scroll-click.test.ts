import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { AgentLike } from './office'

// the host has no wheel event on Box (plugin validator refuses onWheel/onEvent): the scrollbar and the mais notes are click targets instead
const T = 1_000_000
const mk = (id: string): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'map' as const, query: '', expanded: new Set<string>(), maxCardRows: 99, maxLines: 30 }
const many = Array.from({ length: 30 }, (_, i) => mk(`n${i}`))
const acts = (scroll: number) => renderCompact(many, T + 5000, { ...base, scroll }).flat().filter(s => s.act).map(s => s.act)

test('a scrolled list offers a click up (the ↑ mais note) and a click down (the ↓ mais note)', () => {
  const a = acts(3)
  expect(a).toContain('scrollUp')
  expect(a).toContain('scrollDown')
})

test('at the top there is no up target; at the end there is no down target', () => {
  expect(acts(0)).not.toContain('scrollUp')
  expect(acts(99999)).not.toContain('scrollDown')
})

test('the scrollbar track is clickable: above the thumb scrolls up, below scrolls down; the thumb does nothing', () => {
  const trackOf = (scroll: number) => renderCompact(many, T + 5000, { ...base, scroll }).map(l => l[l.length - 1]!).filter(s => s.t === '░' || s.t === '█')
  const top = trackOf(0), end = trackOf(99999)
  expect(top.some(s => s.act === 'scrollDown')).toBe(true) // thumb at the top: the track below it pages down
  expect(top.some(s => s.act === 'scrollUp')).toBe(false)
  expect(end.some(s => s.act === 'scrollUp')).toBe(true) // thumb at the end: the track above it pages up
  expect(end.some(s => s.act === 'scrollDown')).toBe(false)
  expect([...top, ...end].filter(s => s.t === '█').every(s => !s.act)).toBe(true)
})

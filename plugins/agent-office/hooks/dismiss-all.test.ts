import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, MODES } from './compact'
import type { CView, Mode } from './compact'
import type { AgentLike } from './office'
import { hiddenIds, buildGraph, dismissKey } from './run-model'
import { appCards, appMap } from './app-cards'

const T = 1_000_000, NOW = T + 300_000
const step = { id: 's', tool: 'Bash', label: 'x', startedAt: T, durationMs: 1000 }
const mk = (id: string, extra: Partial<AgentLike>): AgentLike => ({ id, description: `Dev: ${id}`, startedAt: T, seenAt: NOW, steps: [step], workflow: { runId: 'r1', agentIndex: 0 }, ...extra } as AgentLike)
const old = mk('oldfail', { status: 'error', error: 'boom', endedAt: NOW - 130_000 }) // past 2 min
const fresh = mk('freshfail', { status: 'error', error: 'boom', endedAt: NOW - 5000 })
const run = mk('runner', { status: 'running', active: true, seenAt: NOW })
const all = [old, fresh, run]
const keyOf = (ag: AgentLike) => dismissKey(buildGraph(all, NOW).nodes.get(ag.id)!)
const dis = new Set([keyOf(fresh)])
const text = (mode: Mode, width = 200) => renderCompact(all, NOW, { width, caps: detectCaps({ TERM: 'xterm-256color' }), mode, query: '', expanded: new Set(), maxCardRows: 4, dismissed: dis } as CView).flat().map(s => s.t).join('')

for (const mode of MODES) {
  test(`${mode}: failed past 2 min and a dismissed agent vanish, a running one stays`, () => {
    const t = text(mode)
    expect(t.includes('oldfail')).toBe(false)
    expect(t.includes('freshfail')).toBe(false)
    expect(t.includes('runner')).toBe(true)
  })
}
test('cost: session total keeps removed agents and says so', () => {
  expect(text('cost')).toContain('(inclui removidos)')
  expect(text('cost', 80)).toContain('(inclui removidos)')
})
test('app cards and app map drop removed agents', () => {
  expect(appCards(all, NOW, { dismissed: dis }).map(c => c.id).sort()).toEqual(['runner'])
  const ids = (n: ReturnType<typeof appMap>): string[] => [n.card.id, ...n.children.flatMap(ids)]
  expect(ids(appMap(all, NOW, { dismissed: dis })).filter(i => /fail/.test(i))).toEqual([])
})
test('a dismissed attention agent is hidden; undismissed attention is never auto-hidden', () => {
  const q = mk('quota', { status: 'error', error: 'rate limit', endedAt: NOW - 600_000 })
  const g = buildGraph([q], NOW)
  expect(hiddenIds(g, NOW).has('quota')).toBe(false)
  expect(hiddenIds(g, NOW, new Set([dismissKey(g.nodes.get('quota')!)])).has('quota')).toBe(true)
})

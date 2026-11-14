import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, scrollInfo } from './compact'
import type { AgentLike } from './office'

// Video 2026-11-14 (plugin 0.25.0 installed): titles cut mid-word with no ellipsis, finished cards dropped from the cards view,
// cards cut at the pane bottom. Scenario: orchestrator + 12 long-named children in a 150-col, 55-row pane (spec office-cards-always-visible).
const T = 1_000_000
const mk = (id: string, o: object = {}): AgentLike => ({ id, agentId: `g-${id}`, description: id, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 150, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99, maxLines: 55 }
const lines = (ag: AgentLike[], o: object = {}, now = T + 5000) => renderCompact(ag, now, { ...base, ...o } as any).map(l => l.map(s => s.t).join(''))
const NAMES = [
  'Calc trigonometria', 'Calc logaritmos', 'Calc estatística', 'Calc complexos/matriz', 'Calc fatorial/combinatória',
  'Calc conversão de bases', 'Operações bitwise 0b1010 e shifts', 'Conversões bin/oct/hex 255 e 42',
  'média, mediana e moda de [2,4,4,7]', 'desvio padrão populacional, amostral', 'Raízes de x^3-6x^2+11x-6 #1', 'Determinante e inversa de matriz 3x3',
]
const scene = () => [mk('root', { description: 'Claude Code' }), ...NAMES.map((n, i) => mk(`c${i}`, { description: n, parentAgentId: 'g-root' }))]

// every scroll step the window can take: the titles visible at each step, with the status row of the same card
const steps = (ag: AgentLike[], o: object = {}, now = T + 5000) => {
  lines(ag, o, now)
  const starts = scrollInfo.units.length ? [0, ...scrollInfo.units] : [0]
  return starts.map(scroll => lines(ag, { ...o, scroll }, now).join('\n'))
}

test('video layout: the pane body is filled to 55 rows, footer in the last row, every child title whole in some step', () => {
  const ag = scene()
  const t = lines(ag)
  expect(t.length).toBe(55)
  const all = steps(ag).join('\n')
  for (const n of NAMES) expect(all).toContain(n.slice(0, 8)) // a 34-col card holds the title or its start, then …
})

test('video layout: a title is never cut mid-word without an ellipsis (Operações bitwise…, desvio padrão…, am)', () => {
  const ag = scene()
  for (const step of steps(ag)) {
    for (const n of NAMES) {
      const head = n.slice(0, 8)
      for (const row of step.split('\n')) {
        const at = row.indexOf(head)
        if (at < 0) continue
        const seg = row.slice(at, at + n.length + 1)
        expect(seg.startsWith(n) || seg.includes('…')).toBe(true)
      }
    }
  }
})

test('video layout: every visible card is whole in each step (status row present with each visible title)', () => {
  const ag = scene()
  for (const step of steps(ag)) {
    const titles = NAMES.filter(n => step.includes(n.slice(0, 8))).length
    const status = [...step.matchAll(/executando/g)].length
    expect(status).toBeGreaterThanOrEqual(titles)
  }
})

test('video layout: 24 finished children stay in the cards view long after they end (no 30 s expiry)', () => {
  const done = Array.from({ length: 24 }, (_, i) => mk(`d${i}`, { status: 'done', endedAt: T + 10_000, description: `Calc ${i}`, parentAgentId: 'g-root' }))
  const ag = [mk('root', { description: 'Claude Code' }), ...done]
  const all = steps(ag, {}, T + 200_000).join('\n')
  for (let i = 0; i < 24; i++) expect(all).toContain(`Calc ${i}`)
})
